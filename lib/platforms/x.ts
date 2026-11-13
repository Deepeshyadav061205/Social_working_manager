import { fetchWithTimeout, type OAuthCapable, type PlatformApi } from "@/lib/platforms/types";
import { splitXPosts } from "@/lib/text";

export const X_SCOPES = "tweet.read tweet.write users.read offline.access";
export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_USERS_ME_URL = "https://api.x.com/2/users/me";
export const X_TWEETS_URL = "https://api.x.com/2/tweets";

/**
 * True when X_MOCK=true and NODE_ENV is not production (B3).
 * Simulates X OAuth connect and direct publishing without live credentials or API credits.
 */
export function isXMockEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.X_MOCK ?? "").split("#")[0].trim().toLowerCase() === "true";
}

interface XErrorBody {
  title?: string;
  detail?: string;
  type?: string;
  reason?: string;
  error?: string;
  error_description?: string;
  errors?: { title?: string; detail?: string; message?: string }[];
}

/**
 * Map an X v2 API error response to a clear, actionable message (B2).
 * Never includes tokens or sensitive headers.
 */
export function mapXPublishError(status: number, body: unknown, headers?: Headers | { get(name: string): string | null }): string {
  const errObj = (body && typeof body === "object" ? body : {}) as XErrorBody;
  const parts = [
    errObj.title ?? "",
    errObj.detail ?? "",
    errObj.type ?? "",
    errObj.reason ?? "",
    errObj.error ?? "",
    errObj.error_description ?? "",
    ...(Array.isArray(errObj.errors)
      ? errObj.errors.map((e) => `${e.title ?? ""} ${e.detail ?? ""} ${e.message ?? ""}`)
      : []),
  ];
  const combined = parts.join(" ").toLowerCase();

  if (status === 401) {
    return "X token expired. Please reconnect your X account.";
  }

  if (
    status === 402 ||
    /credit|billing|enroll|client-not-enrolled|usage cap|payment|subscription|not enrolled|depleted/i.test(combined)
  ) {
    return "Your X developer account has no API credits or the app is not enrolled. Add credits in the X Developer Console, or use Transfer mode.";
  }

  if (status === 403) {
    if (/duplicate/i.test(combined)) {
      return "X rejected this as a duplicate post. Change the text and try again.";
    }
    return "Set your X app permissions to Read and write, then reconnect.";
  }

  if (status === 429) {
    const resetHeader = headers?.get("x-rate-limit-reset")?.trim();
    if (resetHeader) {
      const epochSec = Number.parseInt(resetHeader, 10);
      if (Number.isFinite(epochSec) && epochSec > 0) {
        const resetIso = new Date(epochSec * 1000).toISOString();
        return `X rate limit reached (resets at ${resetIso}).`;
      }
      return `X rate limit reached (resets at ${resetHeader}).`;
    }
    return "X rate limit reached.";
  }

  const detail = (errObj.detail || errObj.title || "").trim();
  return detail ? `X API error (${status}): ${detail}` : `X API error (${status}).`;
}

/**
 * X (Twitter) adapter.
 * - OAuth 2.0 Authorization Code with PKCE; scopes: tweet.read tweet.write users.read offline.access
 * - Refresh token support with rotation (grant_type=refresh_token).
 * - Direct publish via POST https://api.x.com/2/tweets (threads posted as a reply chain).
 * - Transfer fallback: tweet intent URL (always available).
 */
export class XTwitterAdapter implements PlatformApi, OAuthCapable {
  readonly platform = "X_TWITTER" as const;

  isConfigured(): boolean {
    if (isXMockEnabled()) return true;
    return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
  }

  usesPkce(): boolean {
    return true;
  }

  getAuthorizeUrl({ state, redirectUri, codeChallenge }: { state: string; redirectUri: string; codeChallenge?: string }): string {
    if (isXMockEnabled()) {
      const p = new URLSearchParams({ code: "mock_x_auth_code", state });
      return `${redirectUri}?${p.toString()}`;
    }
    const p = new URLSearchParams({
      response_type: "code",
      client_id: process.env.X_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: X_SCOPES,
      state,
      code_challenge: codeChallenge ?? "",
      code_challenge_method: "S256",
    });
    return `${X_AUTHORIZE_URL}?${p.toString()}`;
  }

  async exchangeCode({ code, redirectUri, codeVerifier }: { code: string; redirectUri: string; codeVerifier?: string }) {
    if (isXMockEnabled()) {
      return {
        accessToken: "mock_x_access_token",
        refreshToken: "mock_x_refresh_token",
        expiresIn: 7200,
      };
    }

    const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
    const res = await fetchWithTimeout(X_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier ?? "",
        client_id: process.env.X_CLIENT_ID ?? "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description ?? `X token exchange failed (${res.status}).`);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    if (isXMockEnabled()) {
      return {
        accessToken: "mock_x_access_token_refreshed",
        refreshToken: "mock_x_refresh_token_rotated",
        expiresIn: 7200,
      };
    }

    const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
    const res = await fetchWithTimeout(X_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.X_CLIENT_ID ?? "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description ?? `X token refresh failed (${res.status}).`);
    }
    return {
      accessToken: data.access_token,
      // X rotates refresh tokens on every refresh; always save the newly returned refresh_token if provided.
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    };
  }

  private async me(token: string): Promise<{ id: string; username: string } | null> {
    if (isXMockEnabled()) {
      return { id: "mock_user_id", username: "mock_user" };
    }
    const res = await fetchWithTimeout(X_USERS_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { id: string; username: string } };
    return data.data ?? null;
  }

  async fetchAccountLabel(token: string): Promise<string | null> {
    if (isXMockEnabled()) return "@mock_user";
    const me = await this.me(token).catch(() => null);
    return me ? `@${me.username}` : null;
  }

  async verifyConnection(token?: string): Promise<boolean> {
    if (!token) return false;
    if (isXMockEnabled()) return true;
    return Boolean(await this.me(token).catch(() => null));
  }

  supportsDirectPublish(): boolean {
    return this.isConfigured();
  }

  async publishPost(content: string, token: string) {
    const posts = splitXPosts(content);
    if (posts.length === 0) return { ok: false, error: "Nothing to post." };

    if (isXMockEnabled()) {
      const mockId = "mock_post_1234567890";
      return {
        ok: true,
        postId: mockId,
        url: `https://x.com/mock_user/status/${mockId}`,
      };
    }

    let firstId: string | undefined;
    let firstUrl: string | undefined;
    let prevId: string | undefined;
    let currentPart = 1;

    try {
      for (let i = 0; i < posts.length; i++) {
        currentPart = i + 1;
        const text = posts[i];
        const res = await fetchWithTimeout(X_TWEETS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(prevId ? { text, reply: { in_reply_to_tweet_id: prevId } } : { text }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const baseMsg = mapXPublishError(res.status, errBody, res.headers);

          if (firstId && i > 0) {
            const liveParts = i === 1 ? "part 1 is already live" : `parts 1–${i} are already live`;
            return {
              ok: false,
              status: res.status,
              failedPart: currentPart,
              postId: firstId,
              url: firstUrl,
              error: `Part ${currentPart} of ${posts.length} failed: ${baseMsg} (${liveParts} at ${firstUrl} — do not re-post the earlier parts).`,
            };
          }

          return {
            ok: false,
            status: res.status,
            failedPart: posts.length > 1 ? currentPart : undefined,
            error: baseMsg,
          };
        }

        const data = (await res.json()) as { data?: { id: string } };
        prevId = data.data?.id;
        if (!firstId && prevId) {
          firstId = prevId;
          firstUrl = `https://x.com/i/web/status/${firstId}`;
        }
      }
      return { ok: true, postId: firstId, url: firstUrl };
    } catch {
      if (firstId && currentPart > 1) {
        const postedCount = currentPart - 1;
        const liveParts = postedCount === 1 ? "part 1 is already live" : `parts 1–${postedCount} are already live`;
        return {
          ok: false,
          failedPart: currentPart,
          postId: firstId,
          url: firstUrl,
          error: `Part ${currentPart} of ${posts.length} failed: Could not reach X (${liveParts} at ${firstUrl} — do not re-post the earlier parts).`,
        };
      }
      return { ok: false, error: "Could not reach X.", postId: firstId, url: firstUrl };
    }
  }

  buildTransferLink(content: string) {
    const posts = splitXPosts(content);
    const first = posts[0] ?? content;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(first)}`;
    const steps =
      posts.length > 1
        ? [
            `Your ${posts.length}-post thread has been copied to the clipboard.`,
            "X opens in a new tab with post 1 prefilled. Click “Post”.",
            "Open the post you just made, click “Reply”, and paste the next part.",
            "Repeat for each remaining part (use the per-post Copy buttons in the editor).",
          ]
        : [
            "Your post has been copied to the clipboard.",
            "X opens in a new tab with the post prefilled.",
            "Review it and click “Post”.",
          ];
    return { url, instructions: steps.join("\n") };
  }
}
