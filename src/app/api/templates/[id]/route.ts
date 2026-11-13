import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, isUuid, jsonError, parseBody } from "@/lib/api";
import { templateUpdateSchema } from "@/lib/validators";

const TEMPLATE_COLS = "id, user_id, name, structure_text, default_platform, default_tone, created_at";
type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Template not found.", 404);
  const { data, error } = await auth.supabase
    .from("templates")
    .select(TEMPLATE_COLS)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return dbError("Could not load the template.", error);
  if (!data) return jsonError("Template not found.", 404);
  return NextResponse.json({ template: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Template not found.", 404);
  const parsed = await parseBody(req, templateUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const p = parsed.data;
  const patch: Record<string, string> = {};
  if (p.name !== undefined) patch.name = p.name;
  if (p.structureText !== undefined) patch.structure_text = p.structureText;
  if (p.defaultPlatform !== undefined) patch.default_platform = p.defaultPlatform;
  if (p.defaultTone !== undefined) patch.default_tone = p.defaultTone;
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update.", 400);

  const { data, error } = await auth.supabase
    .from("templates")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select(TEMPLATE_COLS)
    .maybeSingle();
  if (error) return dbError("Could not update the template.", error);
  if (!data) return jsonError("Template not found.", 404);
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isUuid(params.id)) return jsonError("Template not found.", 404);
  const { data, error } = await auth.supabase
    .from("templates")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return dbError("Could not delete the template.", error);
  if (!data || data.length === 0) return jsonError("Template not found.", 404);
  return NextResponse.json({ ok: true });
}
