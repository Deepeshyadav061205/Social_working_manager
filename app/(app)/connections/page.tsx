import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectionsView } from "@/components/connections/connections-view";
import { PageEnter } from "@/components/layout/page-enter";
import { getCurrentUser } from "@/lib/auth";
import { listConnections } from "@/lib/connections";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const [connections, { data: profile }] = await Promise.all([
    listConnections(supabase, user.id),
    supabase.from("profiles").select("blog_cms_url").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <PageEnter>
      <ConnectionsView
        initialConnections={connections}
        blogCmsUrl={(profile?.blog_cms_url as string | null) ?? null}
        flashConnected={searchParams.connected ?? null}
        flashError={searchParams.error ?? null}
      />
    </PageEnter>
  );
}
