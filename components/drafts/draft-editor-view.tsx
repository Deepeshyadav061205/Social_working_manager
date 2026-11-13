"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ContentEditor } from "@/components/create/content-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { PlatformIcon } from "@/components/ui/platform-icon";
import {
  PLATFORMS,
  PLATFORM_LABEL,
  TONES,
  TONE_LABEL,
  type Draft,
  type Platform,
  type Tone,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";

export function DraftEditorView({ initialDraft }: { initialDraft: Draft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [title, setTitle] = useState(initialDraft.title);
  const [body, setBody] = useState(initialDraft.body);
  const [platform, setPlatform] = useState<Platform>(initialDraft.platform);
  const [tone, setTone] = useState<Tone>(initialDraft.tone);
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== draft.title ||
    body !== draft.body ||
    platform !== draft.platform ||
    tone !== draft.tone;

  const saveChanges = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Title is required.");
      return;
    }
    if (!body.trim()) {
      toast.error("Draft body cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ draft: Draft }>(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed, body, platform, tone }),
      });
      setDraft(res.draft);
      setTitle(res.draft.title);
      toast.success("Draft saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update draft.");
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    try {
      await apiFetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
      toast.success("Draft deleted.");
      router.push("/drafts");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete draft.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/drafts"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to drafts
        </Link>

        <div className="flex items-center gap-2">
          <ConfirmDialog
            title="Delete this draft?"
            description={`“${draft.title}” will be permanently removed.`}
            onConfirm={deleteDraft}
          >
            <Button type="button" variant="outline" size="sm" className="text-danger hover:text-danger">
              <Trash2 /> Delete
            </Button>
          </ConfirmDialog>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={saveChanges}
            loading={saving}
            disabled={!dirty}
          >
            {dirty ? <Save /> : <Check />}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      <Card className="grid gap-4 p-5 md:grid-cols-[1fr_auto_auto]">
        <Field label="Draft title" htmlFor="draft-detail-title">
          <Input
            id="draft-detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </Field>
        <div className="space-y-1.5">
          <Label>Platform</Label>
          <ChipGroup
            label="Platform"
            value={platform}
            options={PLATFORMS}
            onChange={setPlatform}
            renderIcon={(p) => <PlatformIcon platform={p} />}
            renderLabel={(p) => PLATFORM_LABEL[p]}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tone</Label>
          <ChipGroup
            label="Tone"
            value={tone}
            options={TONES}
            onChange={setTone}
            renderLabel={(t) => TONE_LABEL[t]}
          />
        </div>
      </Card>

      <ContentEditor
        body={body}
        onBodyChange={setBody}
        platform={platform}
        tone={tone}
        contentId={draft.content_id}
        existingDraft={{ ...draft, title, body, platform, tone }}
        onDraftSaved={(updated) => {
          setDraft(updated);
          setTitle(updated.title);
          setBody(updated.body);
          setPlatform(updated.platform);
          setTone(updated.tone);
        }}
      />
    </div>
  );
}
