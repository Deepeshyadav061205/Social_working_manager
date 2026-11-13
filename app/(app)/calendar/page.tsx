import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageEnter } from "@/components/layout/page-enter";
import { getCurrentUser } from "@/lib/auth";
import type { CalendarEntry, Draft } from "@/lib/types";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: entries }, { data: drafts }] = await Promise.all([
    supabase
      .from("calendar_entries")
      .select("id, user_id, draft_id, title, platform, scheduled_for, status, created_at")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true })
      .limit(500),
    supabase
      .from("drafts")
      .select("id, title, platform")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <PageEnter>
      <CalendarView
        initialEntries={(entries ?? []) as CalendarEntry[]}
        drafts={(drafts ?? []) as Pick<Draft, "id" | "title" | "platform">[]}
      />
    </PageEnter>
  );
}
