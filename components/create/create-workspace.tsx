"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ContentEditor } from "@/components/create/content-editor";
import ShinyText from "@/components/reactbits/ShinyText";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { Field, FieldError, Label, Select, Textarea } from "@/components/ui/input";
import { PlatformIcon } from "@/components/ui/platform-icon";
import {
  PLATFORMS,
  PLATFORM_LABEL,
  TONES,
  TONE_LABEL,
  type Draft,
  type GeneratedContent,
  type Platform,
  type Template,
  type Tone,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { generateSchema, type GenerateInput } from "@/lib/validators";

const STORAGE_KEY = "swm.create.session.v1";

interface StoredState {
  inputText: string;
  platform: Platform;
  tone: Tone;
  templateId: string | null;
  editorBody: string;
  contentId: string | null;
}

export function CreateWorkspace({
  templates,
  defaultPlatform,
  defaultTone,
  initialPlatform,
  initialTemplateId,
  initialHistoryItem,
  llmInfo,
}: {
  templates: Template[];
  defaultPlatform: Platform;
  defaultTone: Tone;
  initialPlatform?: Platform | null;
  initialTemplateId?: string | null;
  initialHistoryItem?: {
    id: string;
    body: string;
    platform: Platform;
    tone: Tone;
    inputText?: string;
  } | null;
  llmInfo?: { provider: string; model: string };
}) {
  const [editorBody, setEditorBody] = useState(initialHistoryItem?.body ?? "");
  const [contentId, setContentId] = useState<string | null>(initialHistoryItem?.id ?? null);
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateInput>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      inputText: initialHistoryItem?.inputText ?? "",
      platform: initialHistoryItem?.platform ?? initialPlatform ?? defaultPlatform,
      tone: initialHistoryItem?.tone ?? defaultTone,
      templateId: initialTemplateId ?? null,
    },
  });

  const inputText = watch("inputText");
  const platform = watch("platform");
  const tone = watch("tone");
  const templateId = watch("templateId");

  // Restore unsaved session state on mount (unless arriving from History or a specific Template link).
  useEffect(() => {
    if (initialHistoryItem) {
      setHydrated(true);
      return;
    }
    if (initialTemplateId) {
      const tpl = templates.find((t) => t.id === initialTemplateId);
      if (tpl) {
        setValue("templateId", tpl.id);
        setValue("inputText", tpl.structure_text);
        setValue("platform", tpl.default_platform);
        setValue("tone", tpl.default_tone);
      }
      setHydrated(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        if (typeof parsed.inputText === "string" && parsed.inputText) setValue("inputText", parsed.inputText);
        if (
          !initialPlatform &&
          parsed.platform &&
          (PLATFORMS as readonly string[]).includes(parsed.platform)
        ) {
          setValue("platform", parsed.platform);
        }
        if (parsed.tone && (TONES as readonly string[]).includes(parsed.tone)) {
          setValue("tone", parsed.tone);
        }
        if (typeof parsed.templateId === "string") setValue("templateId", parsed.templateId);
        if (typeof parsed.editorBody === "string") setEditorBody(parsed.editorBody);
        if (typeof parsed.contentId === "string") setContentId(parsed.contentId);
      }
    } catch {
      /* sessionStorage unavailable */
    }
    setHydrated(true);
  }, [initialHistoryItem, initialPlatform, initialTemplateId, setValue, templates]);

  // Persist unsaved editor + form state to sessionStorage on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const state: StoredState = {
        inputText,
        platform,
        tone,
        templateId: templateId ?? null,
        editorBody,
        contentId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [hydrated, inputText, platform, tone, templateId, editorBody, contentId]);

  const applyTemplate = (id: string) => {
    if (!id) {
      setValue("templateId", null);
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setValue("templateId", tpl.id);
    setValue("inputText", tpl.structure_text, { shouldValidate: true });
    setValue("platform", tpl.default_platform, { shouldValidate: true });
    setValue("tone", tpl.default_tone, { shouldValidate: true });
    toast.success(`Applied template "${tpl.name}". Fill in the {placeholders} and click Generate.`);
  };

  const runFallbackGeneration = async (values: GenerateInput) => {
    const res = await apiFetch<{
      content: GeneratedContent | null;
      text: string;
      warning?: string | null;
    }>("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        previousContentId: contentId,
      }),
    });
    setEditorBody(res.text);
    setContentId(res.content?.id ?? null);
    setSavedDraft(null);
    if (res.warning) {
      toast.info(res.warning);
    } else {
      toast.success("Draft generated and refined.");
    }
  };

  const runGeneration = async (values: GenerateInput) => {
    const previousEditorBody = editorBody;
    setGenerating(true);
    setApiError(null);
    setEditorBody("");
    try {
      let res: Response | null = null;
      try {
        res = await fetch("/api/generate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            previousContentId: contentId,
          }),
        });
      } catch {
        res = null;
      }

      // Fallback to /api/generate if streaming endpoint could not start.
      if (!res || res.status === 404 || res.status === 405 || res.status === 501 || (res.ok && !res.body)) {
        await runFallbackGeneration(values);
        return;
      }

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) errMsg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(errMsg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      const marker = "\n__SWM_DONE__:";
      let fullStream = "";
      let receivedFirstChunk = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const piece = decoder.decode(value, { stream: true });
        if (!piece) continue;
        fullStream += piece;

        const markerIdx = fullStream.indexOf(marker);
        const visibleText = markerIdx >= 0 ? fullStream.slice(0, markerIdx) : fullStream;
        if (visibleText) {
          receivedFirstChunk = true;
          setEditorBody(visibleText);
        }
      }
      fullStream += decoder.decode();

      const markerIdx = fullStream.lastIndexOf(marker);
      let finalVisible = fullStream;
      let meta: {
        contentId?: string | null;
        version?: number;
        warning?: string | null;
        text?: string;
        error?: string;
      } | null = null;

      if (markerIdx >= 0) {
        finalVisible = fullStream.slice(0, markerIdx);
        const jsonPart = fullStream.slice(markerIdx + marker.length).trim();
        try {
          meta = JSON.parse(jsonPart);
        } catch {
          meta = null;
        }
      }

      if (meta?.error) {
        if (!receivedFirstChunk || !finalVisible.trim()) {
          setEditorBody(previousEditorBody);
        }
        throw new Error(meta.error);
      }

      const finalText = meta?.text ?? finalVisible.trim();
      if (!finalText) {
        setEditorBody(previousEditorBody);
        throw new Error("The AI service returned an empty response.");
      }

      setEditorBody(finalText);
      setContentId(meta?.contentId ?? null);
      setSavedDraft(null);
      if (meta?.warning) {
        toast.info(meta.warning);
      } else {
        toast.success("Draft generated.");
      }
    } catch (err) {
      // Keep user's input and any existing editor text intact (FR-19, NFR-13).
      setEditorBody((cur) => (cur.trim() ? cur : previousEditorBody));
      const msg = err instanceof Error ? err.message : "Could not generate content.";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      {/* Left panel: input form */}
      <Card className="p-5">
        <form onSubmit={handleSubmit(runGeneration)} noValidate className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold">Create content</h1>
            <p className="mt-1 text-sm text-muted">
              Enter an idea, pick your platform and tone, or start from a template.
            </p>
            {llmInfo && (
              <p className="mt-1 text-xs text-muted">
                AI provider: {llmInfo.provider} · Model: {llmInfo.model}
              </p>
            )}
          </div>

          {templates.length > 0 && (
            <Field
              label="Use template (optional)"
              htmlFor="template-select"
              hint="Selecting a template pre-fills the idea, platform and tone."
            >
              <Select
                id="template-select"
                value={templateId ?? ""}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">No template — write from scratch</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({PLATFORM_LABEL[t.default_platform]})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="inputText">Your idea, topic, keywords or rough draft</Label>
              <span className="text-xs text-muted">{inputText.length}/5000</span>
            </div>
            <Textarea
              id="inputText"
              rows={7}
              maxLength={5000}
              placeholder="Example: Shipped our team's new onboarding flow this week — cut drop-off by 28%. Biggest lesson was removing the 4th step instead of redesigning it."
              aria-invalid={!!errors.inputText}
              aria-describedby="inputText-error"
              {...register("inputText")}
            />
            <FieldError id="inputText-error" message={errors.inputText?.message} />
          </div>

          <div className="space-y-2">
            <Label>Platform</Label>
            <ChipGroup
              label="Platform"
              value={platform}
              options={PLATFORMS}
              onChange={(v) => setValue("platform", v, { shouldValidate: true })}
              renderIcon={(p) => <PlatformIcon platform={p} />}
              renderLabel={(p) => PLATFORM_LABEL[p]}
              invalid={!!errors.platform}
              describedBy="platform-error"
            />
            <FieldError id="platform-error" message={errors.platform?.message} />
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <ChipGroup
              label="Tone"
              value={tone}
              options={TONES}
              onChange={(v) => setValue("tone", v, { shouldValidate: true })}
              renderLabel={(t) => TONE_LABEL[t]}
              invalid={!!errors.tone}
              describedBy="tone-error"
            />
            <FieldError id="tone-error" message={errors.tone?.message} />
          </div>

          {apiError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger/15 p-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Error: {apiError}</p>
                <p className="mt-0.5 text-xs text-danger/90">
                  Your input and editor text are safe — you can retry whenever ready.
                </p>
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={generating}>
            <Sparkles />{" "}
            {generating ? (
              process.env.NEXT_PUBLIC_BASIC_UI === "true" ? (
                "Generating & refining…"
              ) : (
                <ShinyText
                  text="Generating & refining…"
                  color="var(--background)"
                  shineColor="var(--text)"
                  speed={1.8}
                />
              )
            ) : (
              "Generate content"
            )}
          </Button>
        </form>
      </Card>

      {/* Right panel: editor & preview */}
      <ContentEditor
        body={editorBody}
        onBodyChange={setEditorBody}
        platform={platform}
        tone={tone}
        contentId={contentId}
        existingDraft={savedDraft}
        loading={generating}
        onRegenerate={handleSubmit(runGeneration)}
        onDraftSaved={(d) => setSavedDraft(d)}
      />
    </div>
  );
}
