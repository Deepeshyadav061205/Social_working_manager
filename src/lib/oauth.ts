import "server-only";
import { createHash } from "node:crypto";

export const OAUTH_COOKIE_PREFIX = "swm_oauth_";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUriFor(slug: string): string {
  return `${appUrl()}/api/connections/${slug}/callback`;
}

/** PKCE S256 code challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
