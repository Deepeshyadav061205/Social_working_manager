import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { setConnectionState } from "@/lib/connections";
import { OAUTH_COOKIE_PREFIX, appUrl, redirectUriFor } from "@/lib/oauth";
import { getPlatformAdapter, isOAuthCapable } from "@/lib/platforms";
import { platformFromSlug } from "@/lib/types";

type Ctx = { params: { platform: string } };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * GET /api/connections/[platform]/callback
 * Validates `state`, exchanges the code, encrypts and stores the token server-side.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const platform = platformFromSlug(params.platform);
  const cookieName = `${OAUTH_COOKIE_PREFIX}${params.platform}`;
  const finish = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/connections?${q}`);
    res.cookies.set(cookieName, "", { path: `/api/connections/${params.platform}`, maxAge: 0 });
    return res;
  };
  if (!platform) return finish("error=unknown_platform");

  const adapter = getPlatformAdapter(platform);
  if (!isOAuthCapable(adapter)) return finish("error=not_supported");

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const providerError = sp.get("error");

  let saved: { state?: string; verifier?: string; uid?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(cookieName)?.value ?? "{}");
  } catch {
    saved = {};
  }

  if (providerError) {
    await setConnectionState(auth.user.id, platform, providerError === "access_denied" ? "DISCONNECTED" : "AUTH_FAILED");
    return finish(`error=${providerError === "access_denied" ? "denied" : "auth_failed"}&platform=${params.platform}`);
  }

  // CSRF protection: state must match the cookie set by /connect for this same user.
  if (!code || !state || !saved.state || !safeEqual(state, saved.state) || saved.uid !== auth.user.id) {
    await setConnectionState(auth.user.id, platform, "AUTH_FAILED");
    return finish(`error=state_mismatch&platform=${params.platform}`);
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await adapter.exchangeCode({
      code,
      redirectUri: redirectUriFor(params.platform),
      codeVerifier: saved.verifier,
    });
    const label = await adapter.fetchAccountLabel(accessToken).catch(() => null);
    const id = await setConnectionState(auth.user.id, platform, "CONNECTED", {
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      externalAccount: label,
    });
    if (!id) return finish(`error=save_failed&platform=${params.platform}`);
    return finish(`connected=${params.platform}`);
  } catch (err) {
    console.error("[oauth] exchange failed", err instanceof Error ? err.message : err);
    await setConnectionState(auth.user.id, platform, "AUTH_FAILED");
    return finish(`error=auth_failed&platform=${params.platform}`);
  }
}
