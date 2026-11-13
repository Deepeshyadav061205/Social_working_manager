"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bookmark,
  Check,
  Copy,
  Eye,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PublishDialog } from "@/components/connections/publish-dialog";
import { SaveDraftDialog } from "@/components/drafts/save-draft-dialog";
import ShinyText from "@/components/reactbits/ShinyText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { PlatformBadge, ToneBadge } from "@/components/ui/meta-badges";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { countChars, countWords, splitXPosts } from "@/lib/text";
import { X_MAX_CHARS, type Draft, type Platform, type Tone } from "@/lib/types";
import { apiFetch, cn } from "@/lib/utils";

export function ContentEditor({
  body,
  onBodyChange,
  platform,
  tone,
  contentId,
  existingDraft,
  loading = false,
  onRegenerate,
  onDraftSaved,
}: {
  body: string;
  onBodyChange: (next: string) => void;
  platform: Platform;
  tone: Tone;
  contentId?: string | null;
  existingDraft?: Draft | null;
  loading?: boolean;
  onRegenerate?: () => void;
  onDraftSaved?: (draft: Draft) => void;
}) {
  const [previewMd, setPreviewMd] = useState(false);
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const words = countWords(body);
  const chars = countChars(body);
  const xPosts = platform === "X_TWITTER" ? splitXPosts(body) : [];
  const hasText = body.trim().length > 0;

  const copyAll = async () => {
    if (!hasText) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const copyPost = async (postText: string, index: number) => {
    try {
      await navigator.clipboard.writeText(postText);
      toast.success(`Copied post ${index + 1}.`);
    } catch {
      toast.error("Could not copy post.");
    }
  };

  const handleRefine = async () => {
    if (!hasText) return;
    setRefining(true);
    try {
      const res = await apiFetch<{ text: string }>("/api/refine", {
        method: "POST",
        body: JSON.stringify({ text: body, platform, tone }),
      });
      onBodyChange(res.text);
      toast.success("Refined for readability and flow.");
    } catch (err) {
      // Preserve current editor text on failure (FR-19, NFR-13).
      toast.error(err instanceof Error ? err.message : "Could not refine text.");
    } finally {
      setRefining(false);
    }
  };

  return (
    <Card className="flex flex-col p-5">
      {/* Toolbar header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={platform} />
          <ToneBadge tone={tone} />
          {existingDraft && <Badge tone="yellow">Saved draft</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{words} words</span>
          <span aria-hidden>·</span>
          <span>{chars} chars</span>
          {platform === "BLOG" && hasText && (
            <Button
              type="button"
              size="sm"
              variant={previewMd ? "primary" : "outline"}
              onClick={() => setPreviewMd((v) => !v)}
            >
              {previewMd ? (
                <>
                  <PenLine /> Edit Markdown
                </>
              ) : (
                <>
                  <Eye /> Preview
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main editor / loading skeleton / empty prompt */}
      <div className="relative mt-4 flex-1">
        {loading && !hasText ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[340px] flex-col justify-center gap-4 rounded-control border border-line bg-background p-6"
          >
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <Spinner label="Generating and refining your draft" />
              {process.env.NEXT_PUBLIC_BASIC_UI === "true" ? (
                <span>Drafting and refining for {platform === "X_TWITTER" ? "X" : platform.toLowerCase()}…</span>
              ) : (
                <ShinyText
                  text={`Drafting and refining for ${platform === "X_TWITTER" ? "X" : platform.toLowerCase()}…`}
                  color="var(--text)"
                  shineColor="var(--yellow)"
                  speed={1.8}
                />
              )}
            </div>
            <div className="space-y-2.5 pt-2">
              <Skeleton yellow className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton yellow className="mt-4 h-4 w-2/3" />
              <Skeleton className="h-3.5 w-10/12" />
              <Skeleton className="h-3.5 w-9/12" />
            </div>
          </div>
        ) : !hasText && !existingDraft ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-control border border-dashed border-line-strong bg-background/70 p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-foreground">
              <Sparkles className="h-5 w-5 text-yellow" aria-hidden />
            </div>
            <p className="font-serif text-lg font-semibold text-foreground">Your editor is ready</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Generate a draft from the panel on the left, or start typing directly below.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => onBodyChange(" ")}
            >
              Start from a blank page
            </Button>
          </div>
        ) : previewMd && platform === "BLOG" ? (
          <div className="prose-swm min-h-[340px] rounded-control border border-line bg-background p-5">
            {/* react-markdown skips raw HTML by default (no rehype-raw), satisfying Phase 7 sanitization */}
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        ) : (
          <Textarea
            aria-label="Content editor"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={15}
            placeholder="Write or edit your post here…"
            className="min-h-[340px] text-[15px] leading-relaxed"
          />
        )}
      </div>

      {/* Live X per-post character counter */}
      {platform === "X_TWITTER" && xPosts.length > 0 && !loading && (
        <div className="mt-4 space-y-2 rounded-control border border-line bg-background p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>
              {xPosts.length === 1
                ? "Single X post"
                : `X thread · ${xPosts.length} posts (separated by ---)`}
            </span>
            <span>Max {X_MAX_CHARS} chars / post</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {xPosts.map((p, idx) => {
              const len = countChars(p);
              const over = len > X_MAX_CHARS;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-control border px-3 py-1.5 text-xs",
                    over ? "border-danger/50 bg-danger/15 text-danger" : "border-line bg-surface-1 text-foreground"
                  )}
                >
                  <span className="truncate font-medium">
                    Post {idx + 1}: {len}/{X_MAX_CHARS} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => copyPost(p, idx)}
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" aria-hidden /> Copy
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {onRegenerate && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRegenerate}
              disabled={loading || refining}
            >
              <RefreshCw /> Regenerate
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRefine}
            loading={refining}
            disabled={!hasText || loading}
          >
            <Wand2 /> Refine flow
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={!hasText || loading}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSaveOpen(true)}
            disabled={!hasText || loading}
          >
            <Bookmark /> {existingDraft ? "Update Draft" : "Save Draft"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setPublishOpen(true)}
            disabled={!hasText || loading}
          >
            <Send /> Publish / Transfer
          </Button>
        </div>
      </div>

      <SaveDraftDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        body={body}
        platform={platform}
        tone={tone}
        contentId={contentId}
        existingDraft={existingDraft}
        onSaved={onDraftSaved}
      />

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        initialBody={body}
        platform={platform}
        contentId={contentId}
        draftId={existingDraft?.id ?? null}
        onBodyChange={onBodyChange}
      />
    </Card>
  );
}
