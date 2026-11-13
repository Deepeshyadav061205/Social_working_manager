import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, isUuid, jsonError } from "@/lib/api";
import { PLATFORMS, type Platform } from "@/lib/types";

const COLS = "id, user_id, request_id, raw_body, refined_body, platform, tone, version, created_at";

/**
 * GET /api/history            -> list (newest first), ?platform=&limit=&offset=
 * GET /api/history?id=<uuid>  -> single entry including the original input text
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;
  const sp = req.nextUrl.searchParams;

  const id = sp.get("id");
  if (id) {
    if (!isUuid(id)) return jsonError("History entry not found.", 404);
    const { data, error } = await supabase
      .from("generated_content")
      .select(`${COLS}, content_requests(input_text, template_id)`)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return dbError("Could not load the history entry.", error);
    if (!data) return jsonError("History entry not found.", 404);
    return NextResponse.json({ entry: data });
  }

  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 100);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);
  const platform = sp.get("platform");

  let query = supabase.from("generated_content").select(COLS, { count: "exact" }).eq("user_id", user.id);
  if (platform && (PLATFORMS as readonly string[]).includes(platform)) query = query.eq("platform", platform as Platform);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return dbError("Could not load history.", error);
  return NextResponse.json({ history: data, total: count ?? 0 });
}
