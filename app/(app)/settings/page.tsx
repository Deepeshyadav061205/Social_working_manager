import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageEnter } from "@/components/layout/page-enter";
import { SettingsView } from "@/components/settings/settings-view";
import { getCurrentUser } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, default_platform, default_tone, blog_cms_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = (data as Profile | null) ?? {
    id: user.id,
    full_name: (user.user_metadata?.full_name as string | undefined) ?? "",
    avatar_url: null,
    default_platform: "LINKEDIN",
    default_tone: "PROFESSIONAL",
    blog_cms_url: null,
    created_at: new Date().toISOString(),
  };

  return (
    <PageEnter>
      <SettingsView email={user.email ?? ""} initialProfile={profile} />
    </PageEnter>
  );
}
