"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, LayoutTemplate, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { PlatformBadge, ToneBadge } from "@/components/ui/meta-badges";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { PLATFORMS, PLATFORM_LABEL, TONES, TONE_LABEL, type Template } from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { templateSchema } from "@/lib/validators";

type FormValues = z.infer<typeof templateSchema>;

export function TemplatesView({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      structureText: "",
      defaultPlatform: "LINKEDIN",
      defaultTone: "PROFESSIONAL",
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      name: "",
      structureText: "Topic: {topic}\nKey takeaway: {takeaway}\nWhy it matters: {why}\nQuestion for readers: {question}",
      defaultPlatform: "LINKEDIN",
      defaultTone: "PROFESSIONAL",
    });
    setDialogOpen(true);
  };

  const openEdit = (tpl: Template) => {
    setEditing(tpl);
    reset({
      name: tpl.name,
      structureText: tpl.structure_text,
      defaultPlatform: tpl.default_platform,
      defaultTone: tpl.default_tone,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        const res = await apiFetch<{ template: Template }>(`/api/templates/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? res.template : t)));
        toast.success("Template updated.");
      } else {
        const res = await apiFetch<{ template: Template }>("/api/templates", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setTemplates((prev) => [res.template, ...prev]);
        toast.success("Template created.");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete template.");
    }
  };

  const defaultPlatform = watch("defaultPlatform");
  const defaultTone = watch("defaultTone");

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-muted">
            Reusable post structures with{" "}
            <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-xs text-yellow">
              {"{placeholders}"}
            </code>{" "}
            that pre-fill the Create page.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Create reusable structures for your recurring posts — product updates, lessons learned, or weekly recaps."
          action={
            <Button type="button" variant="primary" onClick={openCreate}>
              <Plus /> Create a template
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={tpl.default_platform} />
                    <ToneBadge tone={tpl.default_tone} />
                  </div>
                  <CardTitle>{tpl.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap rounded-control border border-line bg-background p-3 font-sans text-xs leading-relaxed text-foreground/90">
                    {tpl.structure_text}
                  </pre>
                </CardContent>
              </div>
              <CardFooter className="justify-between border-t border-line pt-3">
                <Button asChild size="sm" variant="primary">
                  <Link href={`/create?template=${tpl.id}`}>
                    <Sparkles /> Use template
                  </Link>
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(tpl)}
                  >
                    <Edit3 /> Edit
                  </Button>
                  <ConfirmDialog
                    title="Delete this template?"
                    description={`“${tpl.name}” will be permanently removed.`}
                    onConfirm={() => handleDelete(tpl.id)}
                  >
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger hover:text-danger"
                      aria-label={`Delete ${tpl.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </ConfirmDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "Create template"}</DialogTitle>
            <DialogDescription>
              Use curly braces like{" "}
              <code className="rounded border border-line bg-surface-2 px-1 py-0.5 text-xs text-yellow">
                {"{topic}"}
              </code>{" "}
              for placeholders you will fill in when creating a post.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Field label="Template name" htmlFor="tpl-name" error={errors.name?.message}>
              <Input id="tpl-name" maxLength={120} {...register("name")} />
            </Field>
            <Field
              label="Structure"
              htmlFor="tpl-structure"
              error={errors.structureText?.message}
              hint="Write prompts or bullet cues with {placeholders}."
            >
              <Textarea id="tpl-structure" rows={6} maxLength={5000} {...register("structureText")} />
            </Field>
            <div className="space-y-1.5">
              <Label>Default platform</Label>
              <ChipGroup
                label="Default platform"
                value={defaultPlatform}
                options={PLATFORMS}
                onChange={(v) => setValue("defaultPlatform", v, { shouldValidate: true })}
                renderIcon={(p) => <PlatformIcon platform={p} />}
                renderLabel={(p) => PLATFORM_LABEL[p]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default tone</Label>
              <ChipGroup
                label="Default tone"
                value={defaultTone}
                options={TONES}
                onChange={(v) => setValue("defaultTone", v, { shouldValidate: true })}
                renderLabel={(t) => TONE_LABEL[t]}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {editing ? "Save changes" : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
