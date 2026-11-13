import { fetchWithTimeout, type OAuthCapable, type PlatformApi } from "@/lib/platforms/types";

/**
 * LinkedIn adapter.
 * - OAuth 2.0 (3-legged) with scopes: openid profile w_member_social
 * - Direct publish via the UGC Posts REST API.
 * - Transfer fallback: LinkedIn feed composer with prefilled text.
 */
export class LinkedInAdapter implements PlatformApi, OAuthCapable {
  readonly platform = "LINKEDIN" as const;

  isConfigured(): boolean {
    return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  usesPkce(): boolean {
    return false;
  }

  getAuthorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      state,
      scope: "openid profile w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const res = await fetchWithTimeout("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description ?? `LinkedIn token exchange failed (${res.status}).`);
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  private async userInfo(token: string): Promise<{ sub: string; name?: string } | null> {
    const res = await fetchWithTimeout("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { sub: string; name?: string };
  }

  async fetchAccountLabel(token: string): Promise<string | null> {
    const info = await this.userInfo(token).catch(() => null);
    return info?.name ?? null;
  }

  async verifyConnection(token?: string): Promise<boolean> {
    if (!token) return false;
    const info = await this.userInfo(token).catch(() => null);
    return Boolean(info?.sub);
  }

  supportsDirectPublish(): boolean {
    return this.isConfigured();
  }

  async publishPost(content: string, token: string) {
    try {
      const info = await this.userInfo(token);
      if (!info) return { ok: false, status: 401, error: "LinkedIn session expired. Please reconnect." };
      const res = await fetchWithTimeout("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: `urn:li:person:${info.sub}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: content },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });
      if (!res.ok) {
        const msg =
          res.status === 429
            ? "LinkedIn rate limit reached."
            : res.status === 401
              ? "LinkedIn token expired."
              : `LinkedIn API error (${res.status}).`;
        return { ok: false, status: res.status, error: msg };
      }
      const postId = res.headers.get("x-restli-id") ?? ((await res.json().catch(() => ({}))) as { id?: string }).id;
      return {
        ok: true,
        postId: postId ?? undefined,
        url: postId ? `https://www.linkedin.com/feed/update/${postId}/` : "https://www.linkedin.com/feed/",
      };
    } catch {
      return { ok: false, error: "Could not reach LinkedIn." };
    }
  }

  buildTransferLink(content: string) {
    // LinkedIn's composer accepts prefilled text via `shareActive&text=`.
    // Very long URLs can be truncated by the browser, so the content is also copied to the clipboard.
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(content.slice(0, 2900))}`;
    return {
      url,
      instructions: [
        "Your post has been copied to the clipboard.",
        "LinkedIn opens in a new tab with the post composer.",
        "If the text is not prefilled, click inside the composer and paste (Ctrl/⌘ + V).",
        "Review the post and click “Post”.",
      ].join("\n"),
    };
  }
}
