import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, jsonError, parseBody } from "@/lib/api";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validators";

/** GET /api/settings — current user's profile. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, default_platform, default_tone, blog_cms_url, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return dbError("Could not load settings.", error);
  return NextResponse.json({ profile: data });
}

/** PATCH /api/settings — update profile preferences. */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const parsed = await parseBody(req, profileSchema);
  if (!parsed.ok) return parsed.response;
  const { fullName, defaultPlatform, defaultTone, blogCmsUrl } = parsed.data;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        default_platform: defaultPlatform,
        default_tone: defaultTone,
        blog_cms_url: blogCmsUrl ? blogCmsUrl : null,
      },
      { onConflict: "id" }
    )
    .select("id, full_name, avatar_url, default_platform, default_tone, blog_cms_url, created_at")
    .single();

  if (error || !data) return dbError("Could not save settings.", error);
  return NextResponse.json({ profile: data });
}

/**
 * DELETE /api/settings — permanently delete the user account and all rows
 * (tables have ON DELETE CASCADE from auth.users).
 */
export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  if (hasAdminClient()) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return jsonError("Could not delete the account. Please try again.", 500);
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  // Fallback when SUPABASE_SERVICE_ROLE_KEY is not configured: wipe all user rows and sign out.
  await Promise.all([
    supabase.from("publish_jobs").delete().eq("user_id", user.id),
    supabase.from("calendar_entries").delete().eq("user_id", user.id),
    supabase.from("drafts").delete().eq("user_id", user.id),
    supabase.from("generated_content").delete().eq("user_id", user.id),
    supabase.from("content_requests").delete().eq("user_id", user.id),
    supabase.from("templates").delete().eq("user_id", user.id),
    supabase.from("platform_connections").delete().eq("user_id", user.id),
    supabase.from("profiles").delete().eq("id", user.id),
  ]);
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
