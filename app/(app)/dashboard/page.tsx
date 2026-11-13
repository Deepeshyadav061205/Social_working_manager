import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  FileText,
  LayoutTemplate,
  PenSquare,
  Send,
  Sparkles,
} from "lucide-react";
import {
  DashboardStatCard,
  DashboardStatsGrid,
  DashboardStatValue,
} from "@/components/dashboard/dashboard-stats";
import { PlatformChart, type PlatformStatDatum } from "@/components/dashboard/platform-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlatformBadge } from "@/components/ui/meta-badges";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getCurrentUser } from "@/lib/auth";
import { suggestTitle } from "@/lib/text";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

interface ActivityItem {
  id: string;
  kind: "GENERATED" | "DRAFT" | "PUBLISHED";
  title: string;
  platform: Platform;
  at: string;
  href: string;
}

const quickActions: Array<{
  platform: Platform;
  title: string;
  description: string;
  accent: "yellow" | "blue" | "white";
}> = [
  {
    platform: "LINKEDIN",
    title: "LinkedIn post",
    description: "Hook-led update or insight for your network",
    accent: "blue",
  },
  {
    platform: "X_TWITTER",
    title: "X thread",
    description: "Sharp 280-char post or numbered thread",
    accent: "white",
  },
  {
    platform: "BLOG",
    title: "Blog article",
    description: "Structured long-form Markdown draft",
    accent: "yellow",
  },
];

export default async function DashboardPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: generatedRows, count: generatedCount },
    { data: draftRows, count: draftsCount },
    { data: publishRows, count: publishedCount },
    { count: templatesCount },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("generated_content")
      .select("id, refined_body, platform, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("drafts")
      .select("id, title, platform, updated_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("publish_jobs")
      .select("id, platform, mode, status, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .in("status", ["PUBLISHED", "TRANSFERRED"])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const firstName =
    ((profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? "")
      .trim()
      .split(/\s+/)[0] || "there";

  const chartData: PlatformStatDatum[] = PLATFORMS.map((p) => ({
    name: PLATFORM_LABEL[p],
    generated: (generatedRows ?? []).filter((r) => r.platform === p).length,
    published: (publishRows ?? []).filter((r) => r.platform === p).length,
  }));

  const activities: ActivityItem[] = [
    ...(generatedRows ?? []).slice(0, 6).map((g) => ({
      id: `gen-${g.id as string}`,
      kind: "GENERATED" as const,
      title: suggestTitle(g.refined_body as string, g.platform as Platform),
      platform: g.platform as Platform,
      at: g.created_at as string,
      href: `/create?history=${g.id as string}`,
    })),
    ...(draftRows ?? []).slice(0, 6).map((d) => ({
      id: `draft-${d.id as string}`,
      kind: "DRAFT" as const,
      title: d.title as string,
      platform: d.platform as Platform,
      at: d.updated_at as string,
      href: `/drafts/${d.id as string}`,
    })),
    ...(publishRows ?? []).slice(0, 6).map((p) => ({
      id: `pub-${p.id as string}`,
      kind: "PUBLISHED" as const,
      title:
        p.mode === "DIRECT_API"
          ? `Published directly to ${PLATFORM_LABEL[p.platform as Platform]}`
          : `Transferred to ${PLATFORM_LABEL[p.platform as Platform]}`,
      platform: p.platform as Platform,
      at: p.created_at as string,
      href: "/history",
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const stats = [
    {
      label: "Total generated",
      value: generatedCount ?? 0,
      icon: Sparkles,
      href: "/history",
      chipClass: "border-yellow/35 bg-yellow-dim text-yellow",
    },
    {
      label: "Saved drafts",
      value: draftsCount ?? 0,
      icon: FileText,
      href: "/drafts",
      chipClass: "border-blue/35 bg-blue-dim text-blue",
    },
    {
      label: "Published / transferred",
      value: publishedCount ?? 0,
      icon: Send,
      href: "/connections",
      chipClass: "border-yellow/35 bg-yellow-dim text-yellow",
    },
    {
      label: "Templates",
      value: templatesCount ?? 0,
      icon: LayoutTemplate,
      href: "/templates",
      chipClass: "border-blue/35 bg-blue-dim text-blue",
    },
  ];

  const recentDrafts = (draftRows ?? []).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Greeting + primary CTA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Hello, {firstName}.</h1>
          <p className="mt-1 text-sm text-muted">
            Here is a snapshot of your content workspace.
          </p>
        </div>
        <Button asChild variant="primary" size="lg">
          <Link href="/create">
            <PenSquare /> Create new post
          </Link>
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 md:grid-cols-3">
        {quickActions.map((qa) => (
          <Link
            key={qa.platform}
            href={`/create?platform=${qa.platform}`}
            className="card-hover-fx group flex items-center justify-between gap-3 rounded-card border border-line bg-surface-1 p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={
                  qa.accent === "blue"
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-blue/35 bg-blue-dim text-blue"
                    : qa.accent === "yellow"
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-yellow/35 bg-yellow-dim text-yellow"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line-strong bg-surface-2 text-foreground"
                }
              >
                <PlatformIcon platform={qa.platform} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{qa.title}</p>
                <p className="truncate text-xs text-muted">{qa.description}</p>
              </div>
            </div>
            <ArrowRight className="arrow-slide h-4 w-4 shrink-0 text-muted group-hover:text-yellow" aria-hidden />
          </Link>
        ))}
      </div>

      {/* Stat cards */}
      <DashboardStatsGrid>
        {stats.map((s) => (
          <DashboardStatCard key={s.label} href={s.href}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                {s.label}
              </span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-control border ${s.chipClass}`}>
                <s.icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <DashboardStatValue value={s.value} />
          </DashboardStatCard>
        ))}
      </DashboardStatsGrid>

      {/* Continue drafts + Posts per platform */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Continue your drafts</CardTitle>
              <CardDescription>Pick up where you left off.</CardDescription>
            </div>
            {recentDrafts.length > 0 && (
              <Link href="/drafts" className="text-xs font-medium text-blue hover:underline">
                View all
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {recentDrafts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No saved drafts yet"
                description="Generate a post and save it as a draft to keep refining later."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href="/create">Start a draft</Link>
                  </Button>
                }
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentDrafts.map((d) => (
                  <li key={d.id as string} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/drafts/${d.id as string}`}
                      className="flex items-center justify-between gap-3 rounded-control p-2 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <PlatformBadge platform={d.platform as Platform} />
                        <span className="truncate text-sm font-medium text-foreground">
                          {d.title as string}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {formatDistanceToNow(new Date(d.updated_at as string), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posts per platform</CardTitle>
            <CardDescription>
              Top platform highlighted in yellow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformChart data={chartData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest generations, draft updates, and transfers.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No activity yet"
              description="Generate your first post to see your workspace come to life."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link href="/create">Create new post</Link>
                </Button>
              }
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-line">
              {activities.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-control p-1.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlatformBadge platform={item.platform} />
                        <Badge
                          tone={
                            item.kind === "PUBLISHED"
                              ? "success"
                              : item.kind === "DRAFT"
                                ? "yellow"
                                : "muted"
                          }
                        >
                          {item.kind === "PUBLISHED"
                            ? "Published / Transferred"
                            : item.kind === "DRAFT"
                              ? "Draft"
                              : "Generated"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{item.title}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
