import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { setConnectionState } from "@/lib/connections";
import { hasAdminClient } from "@/lib/supabase/server";
import { platformFromSlug } from "@/lib/types";

type Ctx = { params: { platform: string } };

/** POST /api/connections/[platform]/disconnect — wipes the stored token. */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const platform = platformFromSlug(params.platform);
  if (!platform) return jsonError("Unknown platform.", 404);
  if (!hasAdminClient()) return jsonError("Connections are not configured on this server.", 503);

  const id = await setConnectionState(auth.user.id, platform, "DISCONNECTED", {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    externalAccount: null,
  });
  if (!id) return jsonError("Could not disconnect. Please try again.", 500);
  return NextResponse.json({ ok: true });
}
