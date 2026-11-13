import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HistoryView } from "@/components/history/history-view";
import { PageEnter } from "@/components/layout/page-enter";
import { getCurrentUser } from "@/lib/auth";
import type { GeneratedContent } from "@/lib/types";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("generated_content")
    .select("id, user_id, request_id, raw_body, refined_body, platform, tone, version, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <PageEnter>
      <HistoryView initialHistory={(data ?? []) as GeneratedContent[]} />
    </PageEnter>
  );
}
