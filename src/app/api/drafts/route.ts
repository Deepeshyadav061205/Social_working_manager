import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, jsonError, parseBody } from "@/lib/api";
import { PLATFORMS, type Platform } from "@/lib/types";
import { draftCreateSchema } from "@/lib/validators";

const DRAFT_COLS = "id, user_id, content_id, title, body, platform, tone, updated_at, created_at";

/** GET /api/drafts?q=&platform=&sort=updated_desc|updated_asc */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const platform = sp.get("platform");
  const ascending = sp.get("sort") === "updated_asc";

  let query = supabase.from("drafts").select(DRAFT_COLS).eq("user_id", user.id);
  if (platform && (PLATFORMS as readonly string[]).includes(platform)) query = query.eq("platform", platform as Platform);
  if (q) {
    // Strip PostgREST filter / LIKE metacharacters from user input before building the filter.
    const safe = q.replace(/[%_,()"\\*.:]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }
  const { data, error } = await query.order("updated_at", { ascending }).limit(200);
  if (error) return dbError("Could not load drafts.", error);
  return NextResponse.json({ drafts: data });
}

/** POST /api/drafts — create a draft (Save Draft from the editor or history). */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const parsed = await parseBody(req, draftCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { title, body, platform, tone, contentId } = parsed.data;

  if (contentId) {
    const { data: owned } = await supabase
      .from("generated_content")
      .select("id")
      .eq("id", contentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) return jsonError("The generated content was not found.", 404);
  }

  const { data, error } = await supabase
    .from("drafts")
    .insert({ user_id: user.id, title, body, platform, tone, content_id: contentId ?? null })
    .select(DRAFT_COLS)
    .single();
  if (error || !data) return dbError("Could not save the draft.", error);
  return NextResponse.json({ draft: data }, { status: 201 });
}
