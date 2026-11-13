import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GENERATE_LIMIT_PER_HOUR = 20;

/**
 * Per-user generation rate limit, backed by the content_requests table
 * (works across serverless instances without extra infrastructure).
 */
export async function checkGenerateRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: true } | { allowed: false; retryAfterMinutes: number }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, count, error } = await supabase
    .from("content_requests")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    // Fail open on a transient DB issue rather than blocking the user entirely.
    console.error("[rate-limit] query failed", { message: error.message, code: error.code });
    return { allowed: true };
  }
  if ((count ?? 0) < GENERATE_LIMIT_PER_HOUR) return { allowed: true };

  const oldest = data?.[0]?.created_at ? new Date(data[0].created_at as string).getTime() : Date.now();
  const retryAfterMinutes = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - Date.now()) / 60000));
  return { allowed: false, retryAfterMinutes };
}
