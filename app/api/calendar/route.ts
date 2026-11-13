import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, jsonError, parseBody } from "@/lib/api";
import { calendarEntrySchema } from "@/lib/validators";

const COLS = "id, user_id, draft_id, title, platform, scheduled_for, status, created_at";

/** GET /api/calendar?from=ISO&to=ISO */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  let query = auth.supabase.from("calendar_entries").select(COLS).eq("user_id", auth.user.id);
  if (from && !Number.isNaN(Date.parse(from))) query = query.gte("scheduled_for", from);
  if (to && !Number.isNaN(Date.parse(to))) query = query.lt("scheduled_for", to);
  const { data, error } = await query.order("scheduled_for", { ascending: true }).limit(500);
  if (error) return dbError("Could not load calendar entries.", error);
  return NextResponse.json({ entries: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, calendarEntrySchema);
  if (!parsed.ok) return parsed.response;
  const { title, platform, scheduledFor, draftId, status } = parsed.data;

  if (draftId) {
    const { data: owned } = await auth.supabase
      .from("drafts")
      .select("id")
      .eq("id", draftId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!owned) return jsonError("The selected draft was not found.", 404);
  }

  const { data, error } = await auth.supabase
    .from("calendar_entries")
    .insert({
      user_id: auth.user.id,
      title,
      platform,
      scheduled_for: scheduledFor,
      draft_id: draftId ?? null,
      status: status ?? "PLANNED",
    })
    .select(COLS)
    .single();
  if (error || !data) return dbError("Could not create the calendar entry.", error);
  return NextResponse.json({ entry: data }, { status: 201 });
}
