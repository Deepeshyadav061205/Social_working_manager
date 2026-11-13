import type { Platform } from "@/lib/types";

/**
 * Contract every platform adapter implements (NFR-17).
 * Adding a new platform = add one adapter file and register it in index.ts.
 */
export interface PlatformApi {
  verifyConnection(token?: string): Promise<boolean>;
  supportsDirectPublish(): boolean;
  publishPost(
    content: string,
    token: string
  ): Promise<{
    ok: boolean;
    postId?: string;
    url?: string;
    error?: string;
    status?: number;
    failedPart?: number;
  }>;
  buildTransferLink(content: string): { url: string; instructions: string };
}

/** Optional OAuth 2.0 capability for adapters that support account connection. */
export interface OAuthCapable {
  /** True when client id/secret are present in the server env. */
  isConfigured(): boolean;
  /** Build the provider authorize URL. `codeChallenge` is used for PKCE providers. */
  getAuthorizeUrl(params: { state: string; redirectUri: string; codeChallenge?: string }): string;
  /** Whether this provider requires PKCE (code_verifier). */
  usesPkce(): boolean;
  /** Exchange an authorization code for an access token (and optional refresh token). */
  exchangeCode(params: { code: string; redirectUri: string; codeVerifier?: string }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  /** Optional: exchange a refresh token for a new access token (and rotated refresh token). */
  refreshAccessToken?(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  /** Fetch a human-readable account label (name/handle) for the connected account. */
  fetchAccountLabel(token: string): Promise<string | null>;
}

export type PlatformAdapter = PlatformApi & Partial<OAuthCapable> & { readonly platform: Platform };

export interface AdapterOptions {
  /** Blog only: user's CMS "new post" URL from Settings. */
  blogCmsUrl?: string | null;
}

export function isOAuthCapable(a: PlatformAdapter): a is PlatformApi & OAuthCapable & { platform: Platform } {
  return typeof a.getAuthorizeUrl === "function" && typeof a.exchangeCode === "function";
}

/** fetch with a timeout, shared by adapters. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
