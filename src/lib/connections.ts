import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getPlatformAdapter, isOAuthCapable } from "@/lib/platforms";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/server";
import { PLATFORMS, type ConnectionState, type Platform, type PlatformConnectionPublic } from "@/lib/types";

/**
 * Server-side helpers for platform connections.
 * - Status is read with the user's RLS-bound client (token column is not even granted to it).
 * - Token reads/writes go through the service-role client, always filtered by user_id.
 */

export async function listConnections(supabase: SupabaseClient, userId: string): Promise<PlatformConnectionPublic[]> {
  const { data } = await supabase
    .from("platform_connections")
    .select("platform, status, external_account, expires_at, updated_at")
    .eq("user_id", userId);

  const rows = new Map((data ?? []).map((r) => [r.platform as Platform, r]));
  return PLATFORMS.map((platform) => {
    const adapter = getPlatformAdapter(platform);
    const row = rows.get(platform);
    let status = (row?.status as ConnectionState | undefined) ?? "DISCONNECTED";
    // Surface expiry without waiting for a failed publish.
    if (status === "CONNECTED" && row?.expires_at && new Date(row.expires_at as string).getTime() < Date.now()) {
      status = "TOKEN_EXPIRED";
    }
    return {
      platform,
      status,
      external_account: (row?.external_account as string | null) ?? null,
      expires_at: (row?.expires_at as string | null) ?? null,
      updated_at: (row?.updated_at as string | null) ?? null,
      configured: isOAuthCapable(adapter) ? adapter.isConfigured() && hasAdminClient() && hasEncryptionKey() : false,
      supportsDirectPublish: adapter.supportsDirectPublish(),
    };
  });
}

export function hasEncryptionKey(): boolean {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return false;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

export async function setConnectionState(
  userId: string,
  platform: Platform,
  status: ConnectionState,
  extra: {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: string | null;
    externalAccount?: string | null;
  } = {}
): Promise<string | null> {
  const admin = createAdminClient();
  const row: Record<string, unknown> = { user_id: userId, platform, status };
  if (extra.accessToken !== undefined) row.access_token_enc = extra.accessToken ? encryptToken(extra.accessToken) : null;
  if (extra.refreshToken !== undefined) row.refresh_token_enc = extra.refreshToken ? encryptToken(extra.refreshToken) : null;
  if (extra.expiresAt !== undefined) row.expires_at = extra.expiresAt;
  if (extra.externalAccount !== undefined) row.external_account = extra.externalAccount;

  let { data, error } = await admin
    .from("platform_connections")
    .upsert(row, { onConflict: "user_id,platform" })
    .select("id")
    .single();

  // Graceful fallback if migration 003 (refresh_token_enc) has not been applied yet.
  if (error && "refresh_token_enc" in row && /refresh_token_enc/i.test(error.message)) {
    const fallbackRow = { ...row };
    delete fallbackRow.refresh_token_enc;
    const retry = await admin
      .from("platform_connections")
      .upsert(fallbackRow, { onConflict: "user_id,platform" })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[connections] upsert failed", error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

/** Load a connection + decrypted tokens for direct publishing. Returns null if unusable. */
export async function getConnectionWithToken(
  userId: string,
  platform: Platform
): Promise<{
  id: string;
  status: ConnectionState;
  expiresAt: string | null;
  token: string | null;
  refreshToken: string | null;
} | null> {
  if (!hasAdminClient() || !hasEncryptionKey()) return null;
  const admin = createAdminClient();

  let { data, error } = await admin
    .from("platform_connections")
    .select("id, status, expires_at, access_token_enc, refresh_token_enc")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (error && /refresh_token_enc/i.test(error.message)) {
    const retry = await admin
      .from("platform_connections")
      .select("id, status, expires_at, access_token_enc")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();
    data = retry.data ? { ...retry.data, refresh_token_enc: null } : null;
  }

  if (!data) return null;
  let token: string | null = null;
  if (data.access_token_enc) {
    try {
      token = decryptToken(data.access_token_enc as string);
    } catch {
      token = null; // key rotated or corrupted: treat as needing reconnection
    }
  }
  let refreshToken: string | null = null;
  if (data.refresh_token_enc) {
    try {
      refreshToken = decryptToken(data.refresh_token_enc as string);
    } catch {
      refreshToken = null;
    }
  }
  return {
    id: data.id as string,
    status: data.status as ConnectionState,
    expiresAt: (data.expires_at as string | null) ?? null,
    token,
    refreshToken,
  };
}

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Return a valid decrypted access token for (userId, platform).
 * When the token is expired or expires within 5 minutes, refreshes it via
 * adapter.refreshAccessToken (if supported), saves the rotated tokens + new expiry,
 * and returns the fresh access token. If refresh fails, marks TOKEN_EXPIRED and returns null.
 */
export async function getValidToken(userId: string, platform: Platform): Promise<string | null> {
  const conn = await getConnectionWithToken(userId, platform);
  if (!conn) return null;
  if (conn.status !== "CONNECTED" && conn.status !== "TOKEN_EXPIRED") return null;

  const expiresAtMs = conn.expiresAt ? new Date(conn.expiresAt).getTime() : null;
  const expiringOrExpired =
    conn.status === "TOKEN_EXPIRED" ||
    !conn.token ||
    (expiresAtMs !== null && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + REFRESH_WINDOW_MS);

  if (!expiringOrExpired && conn.token) {
    return conn.token;
  }

  const adapter = getPlatformAdapter(platform);
  if (!conn.refreshToken || !isOAuthCapable(adapter) || typeof adapter.refreshAccessToken !== "function") {
    await setConnectionState(userId, platform, "TOKEN_EXPIRED");
    return null;
  }

  try {
    const refreshed = await adapter.refreshAccessToken(conn.refreshToken);
    const newExpiresAt = refreshed.expiresIn
      ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
      : conn.expiresAt;
    await setConnectionState(userId, platform, "CONNECTED", {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? conn.refreshToken,
      expiresAt: newExpiresAt,
    });
    return refreshed.accessToken;
  } catch (err) {
    console.error("[connections] token refresh failed", {
      platform,
      message: err instanceof Error ? err.message : "refresh error",
    });
    await setConnectionState(userId, platform, "TOKEN_EXPIRED");
    return null;
  }
}
