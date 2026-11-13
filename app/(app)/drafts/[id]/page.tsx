import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DraftEditorView } from "@/components/drafts/draft-editor-view";
import { isUuid } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { Draft } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Draft" };

export default async function DraftDetailPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isUuid(params.id)) notFound();

  const { data } = await supabase
    .from("drafts")
    .select("id, user_id, content_id, title, body, platform, tone, updated_at, created_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) notFound();
  return <DraftEditorView initialDraft={data as Draft} />;
}
