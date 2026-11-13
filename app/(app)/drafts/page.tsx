import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DraftsView } from "@/components/drafts/drafts-view";
import { PageEnter } from "@/components/layout/page-enter";
import { getCurrentUser } from "@/lib/auth";
import type { Draft } from "@/lib/types";

export const metadata: Metadata = { title: "Drafts" };

export default async function DraftsPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("drafts")
    .select("id, user_id, content_id, title, body, platform, tone, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <PageEnter>
      <DraftsView initialDrafts={(data ?? []) as Draft[]} />
    </PageEnter>
  );
}
