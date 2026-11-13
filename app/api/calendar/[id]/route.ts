import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, isUuid, jsonError, parseBody } from "@/lib/api";
import { calendarEntryUpdateSchema } from "@/lib/validators";

const COLS = "id, user_id, draft_id, title, platform, scheduled_for, status, created_at";
type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Entry not found.", 404);
  const parsed = await parseBody(req, calendarEntryUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const p = parsed.data;
  const patch: Record<string, string | null> = {};
  if (p.title !== undefined) patch.title = p.title;
  if (p.platform !== undefined) patch.platform = p.platform;
  if (p.scheduledFor !== undefined) patch.scheduled_for = p.scheduledFor;
  if (p.status !== undefined) patch.status = p.status;
  if (p.draftId !== undefined) {
    if (p.draftId) {
      const { data: owned } = await auth.supabase
        .from("drafts")
        .select("id")
        .eq("id", p.draftId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!owned) return jsonError("The selected draft was not found.", 404);
    }
    patch.draft_id = p.draftId ?? null;
  }
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update.", 400);

  const { data, error } = await auth.supabase
    .from("calendar_entries")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select(COLS)
    .maybeSingle();
  if (error) return dbError("Could not update the entry.", error);
  if (!data) return jsonError("Entry not found.", 404);
  return NextResponse.json({ entry: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Entry not found.", 404);
  const { data, error } = await auth.supabase
    .from("calendar_entries")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return dbError("Could not delete the entry.", error);
  if (!data || data.length === 0) return jsonError("Entry not found.", 404);
  return NextResponse.json({ ok: true });
}
