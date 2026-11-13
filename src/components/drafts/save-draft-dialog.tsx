"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { PlatformBadge, ToneBadge } from "@/components/ui/meta-badges";
import { suggestTitle } from "@/lib/text";
import type { Draft, Platform, Tone } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

export function SaveDraftDialog({
  open,
  onOpenChange,
  body,
  platform,
  tone,
  contentId,
  existingDraft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  body: string;
  platform: Platform;
  tone: Tone;
  contentId?: string | null;
  existingDraft?: Draft | null;
  onSaved?: (draft: Draft) => void;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(existingDraft?.title || suggestTitle(body, platform));
      setError(null);
    }
  }, [open, existingDraft, body, platform]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = existingDraft
        ? await apiFetch<{ draft: Draft }>(`/api/drafts/${existingDraft.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: trimmed, body, platform, tone }),
          })
        : await apiFetch<{ draft: Draft }>("/api/drafts", {
            method: "POST",
            body: JSON.stringify({ title: trimmed, body, platform, tone, contentId: contentId ?? null }),
          });
      toast.success(existingDraft ? "Draft updated." : "Draft saved.");
      onSaved?.(res.draft);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save draft.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingDraft ? "Update draft" : "Save as draft"}</DialogTitle>
          <DialogDescription>Give this draft a clear title so you can find it later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={platform} />
            <ToneBadge tone={tone} />
          </div>
          <Field label="Draft title" htmlFor="draft-title" error={error ?? undefined}>
            <Input
              id="draft-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {existingDraft ? "Update draft" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
