"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, Info, Send } from "lucide-react";
import { toast } from "sonner";
import type { PublishResult } from "@/app/api/publish/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { PlatformBadge } from "@/components/ui/meta-badges";
import { countChars, splitXPosts, suggestTitle } from "@/lib/text";
import { PLATFORM_LABEL, X_MAX_CHARS, type Platform, type PlatformConnectionPublic } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Publish / Transfer dialog (FR-30 … FR-35, NFR-14).
 * Lets the user make final edits, picks Direct API when connected or falls back
 * to Transfer/Redirect (copy + open composer + step-by-step instructions).
 */
export function PublishDialog({
  open,
  onOpenChange,
  initialBody,
  platform,
  contentId,
  draftId,
  onBodyChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialBody: string;
  platform: Platform;
  contentId?: string | null;
  draftId?: string | null;
  onBodyChange?: (next: string) => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [conn, setConn] = useState<PlatformConnectionPublic | null>(null);
  const [forceTransfer, setForceTransfer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setBody(initialBody);
    setResult(null);
    setForceTransfer(false);
    apiFetch<{ connections: PlatformConnectionPublic[] }>("/api/connections")
      .then((d) => setConn(d.connections.find((c) => c.platform === platform) ?? null))
      .catch(() => setConn(null));
  }, [open, initialBody, platform]);

  const directAvailable = Boolean(conn?.status === "CONNECTED" && conn.supportsDirectPublish);
  const canDirect = Boolean(directAvailable && !forceTransfer);
  const label = PLATFORM_LABEL[platform];
  const xPosts = platform === "X_TWITTER" ? splitXPosts(body) : [];
  const xFirstOverIdx = platform === "X_TWITTER" ? xPosts.findIndex((p) => countChars(p) > X_MAX_CHARS) : -1;

  const handlePublish = async () => {
    if (!body.trim()) {
      toast.error("Content cannot be empty.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<PublishResult>("/api/publish", {
        method: "POST",
        body: JSON.stringify({
          body,
          platform,
          contentId: contentId ?? null,
          draftId: draftId ?? null,
          forceTransfer,
        }),
      });
      setResult(res);
      onBodyChange?.(body);

      if (res.mode === "DIRECT_API") {
        toast.success(res.message);
      } else {
        try {
          await navigator.clipboard.writeText(body);
        } catch {
          /* clipboard may require explicit click in some browsers */
        }
        if (platform === "BLOG") {
          const slug =
            suggestTitle(body, "BLOG")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "blog-post";
          downloadMarkdown(`${slug}.md`, body);
        } else if (res.url) {
          window.open(res.url, "_blank", "noopener,noreferrer");
        }
        if (res.reason) {
          toast.info(res.reason);
        } else {
          toast.success(
            platform === "BLOG"
              ? "Markdown copied & downloaded."
              : `Copied to clipboard & opened ${label}.`
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyAgain = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy automatically — please select and copy the text.");
    }
  };

  const saveMdAgain = () => {
    const slug =
      suggestTitle(body, "BLOG")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "blog-post";
    downloadMarkdown(`${slug}.md`, body);
    toast.success("Downloaded .md file.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Publish or transfer to {label}</DialogTitle>
          <DialogDescription>
            Review or tweak your final content below before sending it to {label}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface-2 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={platform} />
            <Badge tone={canDirect ? "success" : "yellow"}>
              {canDirect ? "Mode: Direct API publish" : "Mode: One-click transfer"}
            </Badge>
          </div>
          {directAvailable && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={forceTransfer}
                onChange={(e) => setForceTransfer(e.target.checked)}
                className="accent-yellow"
              />
              Use transfer link instead
            </label>
          )}
        </div>

        {platform === "X_TWITTER" && (
          <div className="mt-2 space-y-1 text-xs text-muted">
            {directAvailable && (
              <p>Direct publishing uses your X API credits. Posts containing a link cost more.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Thread: {xPosts.length} posts</span>
              {xFirstOverIdx >= 0 && (
                <span className="font-medium text-danger">
                  Part {xFirstOverIdx + 1} is over 280 characters ({countChars(xPosts[xFirstOverIdx])}/{X_MAX_CHARS})
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label htmlFor="publish-final-body" className="mb-1.5 block text-xs font-medium text-muted">
            Final content (editable)
          </label>
          <Textarea
            id="publish-final-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            className="font-sans text-sm"
          />
        </div>

        {result && result.mode === "DIRECT_API" && (
          <div className="mt-4 rounded-card border border-success/30 bg-success/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {result.message}
            </div>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue underline decoration-blue underline-offset-4 hover:text-foreground"
              >
                View post on {label} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {result && result.mode === "TRANSFER_REDIRECT" && (
          <div className="mt-4 space-y-3 rounded-card border border-line bg-surface-2 p-4 text-sm">
            {result.reason && (
              <div className="flex items-start gap-2 rounded-control border border-yellow/25 bg-yellow-dim p-2.5 text-xs text-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow" aria-hidden />
                <span>{result.reason}</span>
              </div>
            )}
            <p className="font-serif text-base font-semibold">Next steps</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
              {result.instructions
                .split("\n")
                .filter(Boolean)
                .map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="secondary" onClick={copyAgain}>
                <Copy /> Copy content
              </Button>
              {platform === "BLOG" && (
                <Button type="button" size="sm" variant="secondary" onClick={saveMdAgain}>
                  <Download /> Download .md
                </Button>
              )}
              {result.url && (
                <Button asChild size="sm" variant="primary">
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    {platform === "BLOG" ? "Open CMS" : `Open ${label}`} <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button type="button" variant="primary" onClick={handlePublish} loading={submitting}>
              <Send />
              {canDirect ? `Publish to ${label}` : platform === "BLOG" ? "Copy & download .md" : `Transfer to ${label}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
