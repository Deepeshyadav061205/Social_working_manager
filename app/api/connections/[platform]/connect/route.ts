import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasEncryptionKey, setConnectionState } from "@/lib/connections";
import { randomToken } from "@/lib/crypto";
import { OAUTH_COOKIE_PREFIX, appUrl, pkceChallenge, redirectUriFor } from "@/lib/oauth";
import { getPlatformAdapter, isOAuthCapable } from "@/lib/platforms";
import { hasAdminClient } from "@/lib/supabase/server";
import { platformFromSlug } from "@/lib/types";

type Ctx = { params: { platform: string } };

/**
 * GET /api/connections/[platform]/connect
 * Starts OAuth 2.0: generates a `state` (and PKCE verifier for X), stores them in a
 * short-lived httpOnly cookie, marks the connection CONNECTING, then redirects.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const back = (q: string) => NextResponse.redirect(`${appUrl()}/connections?${q}`);
  const platform = platformFromSlug(params.platform);
  if (!platform) return back("error=unknown_platform");

  const adapter = getPlatformAdapter(platform);
  if (!isOAuthCapable(adapter)) return back(`error=not_supported&platform=${params.platform}`);
  if (!adapter.isConfigured() || !hasAdminClient() || !hasEncryptionKey()) {
    return back(`error=not_configured&platform=${params.platform}`);
  }

  const state = randomToken(24);
  const verifier = adapter.usesPkce() ? randomToken(48) : undefined;
  const url = adapter.getAuthorizeUrl({
    state,
    redirectUri: redirectUriFor(params.platform),
    codeChallenge: verifier ? pkceChallenge(verifier) : undefined,
  });

  await setConnectionState(auth.user.id, platform, "CONNECTING");

  const res = NextResponse.redirect(url);
  res.cookies.set(`${OAUTH_COOKIE_PREFIX}${params.platform}`, JSON.stringify({ state, verifier, uid: auth.user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: `/api/connections/${params.platform}`,
  });
  return res;
}
