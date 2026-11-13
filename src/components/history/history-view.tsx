"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Bookmark, Eye, History as HistoryIcon, PenSquare } from "lucide-react";
import { SaveDraftDialog } from "@/components/drafts/save-draft-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { PlatformBadge, ToneBadge } from "@/components/ui/meta-badges";
import { PLATFORMS, PLATFORM_LABEL, type GeneratedContent, type Platform } from "@/lib/types";

export function HistoryView({ initialHistory }: { initialHistory: GeneratedContent[] }) {
  const [platformFilter, setPlatformFilter] = useState<"ALL" | Platform>("ALL");
  const [viewItem, setViewItem] = useState<GeneratedContent | null>(null);
  const [saveItem, setSaveItem] = useState<GeneratedContent | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const filtered = useMemo(
    () =>
      initialHistory.filter((h) =>
        platformFilter === "ALL" ? true : h.platform === platformFilter
      ),
    [initialHistory, platformFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Generation history</h1>
          <p className="mt-1 text-sm text-muted">
            Every AI generation is saved automatically so you can revisit or branch from it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter history by platform"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as "ALL" | Platform)}
            className="w-44"
          >
            <option value="ALL">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
          <Button asChild variant="primary">
            <Link href="/create">
              <PenSquare /> Create new
            </Link>
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={initialHistory.length === 0 ? "No generation history yet" : "No entries for this platform"}
          description={
            initialHistory.length === 0
              ? "Whenever you generate a post in Create, both the first draft and refined version appear here."
              : "Switch the platform filter to see all past generations."
          }
          action={
            initialHistory.length === 0 ? (
              <Button asChild variant="primary">
                <Link href="/create">Generate your first post</Link>
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setPlatformFilter("ALL")}>
                Show all platforms
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformBadge platform={item.platform} />
                  <ToneBadge tone={item.tone} />
                  {item.version > 1 && <Badge tone="yellow">v{item.version}</Badge>}
                  <span className="text-xs text-muted">
                    {format(new Date(item.created_at), "MMM d, yyyy · h:mm a")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRaw(false);
                      setViewItem(item);
                    }}
                  >
                    <Eye /> View
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/create?history=${item.id}`}>
                      <PenSquare /> Open in editor
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => setSaveItem(item)}
                  >
                    <Bookmark /> Save as draft
                  </Button>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-foreground/85">
                {item.refined_body}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Full view modal */}
      <Dialog
        open={!!viewItem}
        onOpenChange={(v) => {
          if (!v) setViewItem(null);
        }}
      >
        {viewItem && (
          <DialogContent wide>
            <DialogHeader>
              <DialogTitle>Generated content</DialogTitle>
              <DialogDescription>
                {format(new Date(viewItem.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={viewItem.platform} />
                <ToneBadge tone={viewItem.tone} />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRaw((v) => !v)}
              >
                {showRaw ? "Show refined version" : "Compare initial raw pass"}
              </Button>
            </div>
            <div className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-control border border-line bg-surface-2 p-4 text-sm leading-relaxed text-foreground">
              {showRaw ? viewItem.raw_body : viewItem.refined_body}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setViewItem(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const target = viewItem;
                  setViewItem(null);
                  setSaveItem(target);
                }}
              >
                <Bookmark /> Save as draft
              </Button>
              <Button asChild variant="primary">
                <Link href={`/create?history=${viewItem.id}`}>
                  <PenSquare /> Open in editor
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {saveItem && (
        <SaveDraftDialog
          open={!!saveItem}
          onOpenChange={(v) => {
            if (!v) setSaveItem(null);
          }}
          body={saveItem.refined_body}
          platform={saveItem.platform}
          tone={saveItem.tone}
          contentId={saveItem.id}
        />
      )}
    </div>
  );
}
