import "server-only";
import { NextResponse } from "next/server";
import type { JWK, SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthOk = { ok: true; user: User; supabase: SupabaseClient };
export type AuthFail = { ok: false; response: NextResponse };

const JWKS_TTL_MS = 10 * 60 * 1000;
let cachedJwks: { keys: JWK[] } | null = null;
let cachedJwksAt = 0;

async function getProjectJwks(): Promise<{ keys: JWK[] } | undefined> {
  if (cachedJwks && Date.now() - cachedJwksAt < JWKS_TTL_MS) {
    return cachedJwks.keys.length > 0 ? cachedJwks : undefined;
  }
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) return undefined;
  try {
    const res = await fetch(`${baseUrl}/auth/v1/.well-known/jwks.json`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { keys?: JWK[] };
      cachedJwks = { keys: Array.isArray(data.keys) ? data.keys : [] };
      cachedJwksAt = Date.now();
      return cachedJwks.keys.length > 0 ? cachedJwks : undefined;
    }
  } catch {
    // Ignore and let getClaims / getUser handle verification
  }
  return undefined;
}

function userFromClaims(claims: Record<string, unknown>): User {
  return {
    id: String(claims.sub),
    aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
    role: typeof claims.role === "string" ? claims.role : "authenticated",
    email: typeof claims.email === "string" ? claims.email : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    app_metadata:
      claims.app_metadata && typeof claims.app_metadata === "object"
        ? (claims.app_metadata as Record<string, unknown>)
        : {},
    user_metadata:
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? (claims.user_metadata as Record<string, unknown>)
        : {},
    identities: [],
    created_at: "",
  };
}

async function resolveUser(supabase: SupabaseClient): Promise<User | null> {
  if (typeof supabase.auth.getClaims === "function") {
    try {
      const jwks = await getProjectJwks();
      const { data, error } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined);
      if (!error && data?.claims?.sub) {
        return userFromClaims(data.claims as Record<string, unknown>);
      }
      // No session present at all
      if (!error && data === null) {
        return null;
      }
    } catch {
      // Fall back to getUser() below
    }
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Verifies the session for an API route BEFORE any work happens (NFR-3).
 * Middleware already blocks unauthenticated requests; this is defence in depth
 * and gives route handlers a typed user + RLS-bound client.
 *
 * Usage:
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 */
export async function requireUser(): Promise<AuthOk | AuthFail> {
  const supabase = createClient();
  const user = await resolveUser(supabase);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
    };
  }
  return { ok: true, user, supabase };
}

/** For Server Components: returns the user or null (layout redirects). */
export async function getCurrentUser(): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const supabase = createClient();
  const user = await resolveUser(supabase);
  return { user, supabase };
}
