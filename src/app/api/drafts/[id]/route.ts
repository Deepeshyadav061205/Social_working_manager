import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, isUuid, jsonError, parseBody } from "@/lib/api";
import { draftUpdateSchema } from "@/lib/validators";

const DRAFT_COLS = "id, user_id, content_id, title, body, platform, tone, updated_at, created_at";
type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Draft not found.", 404);

  const { data, error } = await auth.supabase
    .from("drafts")
    .select(DRAFT_COLS)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return dbError("Could not load the draft.", error);
  if (!data) return jsonError("Draft not found.", 404);
  return NextResponse.json({ draft: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Draft not found.", 404);

  const parsed = await parseBody(req, draftUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update.", 400);

  const { data, error } = await auth.supabase
    .from("drafts")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select(DRAFT_COLS)
    .maybeSingle();
  if (error) return dbError("Could not update the draft.", error);
  if (!data) return jsonError("Draft not found.", 404);
  return NextResponse.json({ draft: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Draft not found.", 404);

  const { data, error } = await auth.supabase
    .from("drafts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return dbError("Could not delete the draft.", error);
  if (!data || data.length === 0) return jsonError("Draft not found.", 404);
  return NextResponse.json({ ok: true });
}
