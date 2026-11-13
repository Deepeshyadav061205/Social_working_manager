import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";

// Every page in this group is user-specific — never statically cache it.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    (profile?.full_name as string | null | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    "";

  return <AppShell user={{ email: user.email ?? "", name }}>{children}</AppShell>;
}
