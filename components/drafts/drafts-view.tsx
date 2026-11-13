"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, FileText, PenSquare, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PublishDialog } from "@/components/connections/publish-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PlatformBadge, ToneBadge } from "@/components/ui/meta-badges";
import { PLATFORMS, PLATFORM_LABEL, type Draft, type Platform } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

export function DraftsView({ initialDrafts }: { initialDrafts: Draft[] }) {
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [sortAsc, setSortAsc] = useState(false);
  const [publishDraft, setPublishDraft] = useState<Draft | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drafts
      .filter((d) => (platformFilter === "ALL" ? true : d.platform === platformFilter))
      .filter((d) => (q ? d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const diff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        return sortAsc ? -diff : diff;
      });
  }, [drafts, search, platformFilter, sortAsc]);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/drafts/${id}`, { method: "DELETE" });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Draft deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete draft.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Drafts</h1>
          <p className="mt-1 text-sm text-muted">
            Reopen, refine, or publish any saved draft.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/create">
            <PenSquare /> Create new post
          </Link>
        </Button>
      </div>

      {/* Search, filter, sort bar */}
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            aria-label="Search drafts"
            placeholder="Search by title or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filter by platform"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as "ALL" | Platform)}
        >
          <option value="ALL">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSortAsc((v) => !v)}
          aria-label="Toggle sort order by updated date"
        >
          <ArrowUpDown /> {sortAsc ? "Oldest updated" : "Recently updated"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={drafts.length === 0 ? "No drafts saved yet" : "No drafts match your filters"}
          description={
            drafts.length === 0
              ? "Generate a post in Create and click Save Draft to keep a copy you can edit anytime."
              : "Try clearing the search query or switching the platform filter."
          }
          action={
            drafts.length === 0 ? (
              <Button asChild variant="primary">
                <Link href="/create">Create your first draft</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setPlatformFilter("ALL");
                }}
              >
                Reset filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((draft) => (
            <Card key={draft.id} className="card-hover-fx flex flex-col justify-between">
              <div>
                <CardHeader>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={draft.platform} />
                    <ToneBadge tone={draft.tone} />
                  </div>
                  <CardTitle className="line-clamp-1">
                    <Link href={`/drafts/${draft.id}`} className="hover:underline">
                      {draft.title}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Updated {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-foreground/85">
                    {draft.body}
                  </p>
                </CardContent>
              </div>
              <CardFooter className="justify-between border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/drafts/${draft.id}`}>Open & edit</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => setPublishDraft(draft)}
                  >
                    <Send /> Publish
                  </Button>
                </div>
                <ConfirmDialog
                  title="Delete this draft?"
                  description={`“${draft.title}” will be permanently removed.`}
                  onConfirm={() => handleDelete(draft.id)}
                >
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger hover:text-danger"
                    aria-label={`Delete ${draft.title}`}
                  >
                    <Trash2 />
                  </Button>
                </ConfirmDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {publishDraft && (
        <PublishDialog
          open={!!publishDraft}
          onOpenChange={(v) => {
            if (!v) setPublishDraft(null);
          }}
          initialBody={publishDraft.body}
          platform={publishDraft.platform}
          contentId={publishDraft.content_id}
          draftId={publishDraft.id}
          onBodyChange={(next) =>
            setDrafts((prev) =>
              prev.map((d) => (d.id === publishDraft.id ? { ...d, body: next } : d))
            )
          }
        />
      )}
    </div>
  );
}
