import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listConnections } from "@/lib/connections";

/** GET /api/connections — status per platform. Tokens are never included. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const connections = await listConnections(auth.supabase, auth.user.id);
  return NextResponse.json({ connections });
}
