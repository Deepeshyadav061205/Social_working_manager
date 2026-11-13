import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getValidToken, listConnections, setConnectionState } from "@/lib/connections";
import { getPlatformAdapter, isOAuthCapable } from "@/lib/platforms";
import { hasAdminClient } from "@/lib/supabase/server";
import { PLATFORM_LABEL, platformFromSlug } from "@/lib/types";

type Ctx = { params: { platform: string } };

/**
 * POST /api/connections/[platform]/verify
 * Verifies a platform connection using getValidToken (auto-refreshing if needed)
 * and adapter.verifyConnection(token).
 */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const platform = platformFromSlug(params.platform);
  if (!platform) return jsonError("Unknown platform.", 404);
  if (!hasAdminClient()) return jsonError("Connections are not configured on this server.", 503);

  const label = PLATFORM_LABEL[platform];
  const adapter = getPlatformAdapter(platform);
  const token = await getValidToken(auth.user.id, platform);

  if (!token) {
    const connections = await listConnections(auth.supabase, auth.user.id);
    const updated = connections.find((c) => c.platform === platform) ?? null;
    return NextResponse.json({
      ok: false,
      connection: updated,
      message: `Your ${label} token is expired or missing. Please reconnect.`,
    });
  }

  const verified = await adapter.verifyConnection(token);
  if (!verified) {
    await setConnectionState(auth.user.id, platform, "TOKEN_EXPIRED");
    const connections = await listConnections(auth.supabase, auth.user.id);
    const updated = connections.find((c) => c.platform === platform) ?? null;
    return NextResponse.json({
      ok: false,
      connection: updated,
      message: `${label} connection check failed. Please reconnect.`,
    });
  }

  if (isOAuthCapable(adapter)) {
    const handle = await adapter.fetchAccountLabel(token).catch(() => null);
    if (handle) {
      await setConnectionState(auth.user.id, platform, "CONNECTED", { externalAccount: handle });
    }
  }

  const connections = await listConnections(auth.supabase, auth.user.id);
  const updated = connections.find((c) => c.platform === platform) ?? null;

  return NextResponse.json({
    ok: true,
    connection: updated,
    message: `${label} connection verified${updated?.external_account ? ` (${updated.external_account})` : ""}.`,
  });
}
