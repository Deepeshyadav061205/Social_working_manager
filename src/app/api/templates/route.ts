import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, parseBody } from "@/lib/api";
import { templateSchema } from "@/lib/validators";

const TEMPLATE_COLS = "id, user_id, name, structure_text, default_platform, default_tone, created_at";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.supabase
    .from("templates")
    .select(TEMPLATE_COLS)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) return dbError("Could not load templates.", error);
  return NextResponse.json({ templates: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, templateSchema);
  if (!parsed.ok) return parsed.response;
  const { name, structureText, defaultPlatform, defaultTone } = parsed.data;

  const { data, error } = await auth.supabase
    .from("templates")
    .insert({
      user_id: auth.user.id,
      name,
      structure_text: structureText,
      default_platform: defaultPlatform,
      default_tone: defaultTone,
    })
    .select(TEMPLATE_COLS)
    .single();
  if (error || !data) return dbError("Could not create the template.", error);
  return NextResponse.json({ template: data }, { status: 201 });
}
