"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Info,
  List,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Field, Input, Label, Select } from "@/components/ui/input";
import { PlatformBadge } from "@/components/ui/meta-badges";
import { PlatformIcon } from "@/components/ui/platform-icon";
import {
  CALENDAR_STATUSES,
  PLATFORMS,
  PLATFORM_LABEL,
  type CalendarEntry,
  type CalendarStatus,
  type Draft,
  type Platform,
} from "@/lib/types";
import { apiFetch, cn } from "@/lib/utils";

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarView({
  initialEntries,
  drafts,
}: {
  initialEntries: CalendarEntry[];
  drafts: Pick<Draft, "id" | "title" | "platform">[];
}) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [mobileList, setMobileList] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("LINKEDIN");
  const [draftId, setDraftId] = useState<string>("");
  const [when, setWhen] = useState("");
  const [status, setStatus] = useState<CalendarStatus>("PLANNED");
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => isSameMonth(new Date(e.scheduled_for), month))
        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()),
    [entries, month]
  );

  const openNewForDay = (day: Date) => {
    const d = new Date(day);
    d.setHours(9, 30, 0, 0);
    setEditing(null);
    setTitle("");
    setPlatform("LINKEDIN");
    setDraftId("");
    setWhen(toLocalDateTimeInput(d.toISOString()));
    setStatus("PLANNED");
    setDialogOpen(true);
  };

  const openEdit = (entry: CalendarEntry) => {
    setEditing(entry);
    setTitle(entry.title);
    setPlatform(entry.platform);
    setDraftId(entry.draft_id ?? "");
    setWhen(toLocalDateTimeInput(entry.scheduled_for));
    setStatus(entry.status);
    setDialogOpen(true);
  };

  const onPickDraft = (id: string) => {
    setDraftId(id);
    const found = drafts.find((d) => d.id === id);
    if (found) {
      if (!title.trim()) setTitle(found.title);
      setPlatform(found.platform);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Please enter a title.");
      return;
    }
    const parsedDate = new Date(when);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please pick a valid date and time.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: trimmed,
        platform,
        scheduledFor: parsedDate.toISOString(),
        draftId: draftId || null,
        status,
      };
      if (editing) {
        const res = await apiFetch<{ entry: CalendarEntry }>(`/api/calendar/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setEntries((prev) => prev.map((it) => (it.id === editing.id ? res.entry : it)));
        toast.success("Calendar entry updated.");
      } else {
        const res = await apiFetch<{ entry: CalendarEntry }>("/api/calendar", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setEntries((prev) => [...prev, res.entry]);
        toast.success("Added to calendar.");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/calendar/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Calendar entry removed.");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete entry.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Content calendar</h1>
          <p className="mt-1 text-sm text-muted">
            Click any day to plan a post or link a saved draft.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileList((v) => !v)}
          >
            <List /> {mobileList ? "Month grid" : "List view"}
          </Button>
          <Button type="button" variant="primary" onClick={() => openNewForDay(new Date())}>
            <Plus /> Plan post
          </Button>
        </div>
      </div>

      {/* Version 1.0 planning note required by spec */}
      <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface-1 px-4 py-3 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
        <span>
          <strong className="text-foreground">Planning calendar (v1.0):</strong> Entries help you
          organize your publishing cadence. Version 1.0 plans content only and does not
          auto-publish at the scheduled time.
        </span>
      </div>

      {/* Month header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{format(month, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Month grid (hidden on mobile when list toggle is active) */}
      <Card className={cn("overflow-hidden p-3", mobileList && "hidden md:block")}>
        <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const dayEntries = entries.filter((e) => isSameDay(new Date(e.scheduled_for), day));
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex min-h-[108px] flex-col rounded-control border p-2 transition-colors",
                  inMonth
                    ? "border-line bg-background hover:border-line-strong"
                    : "border-transparent bg-surface-1/60 text-muted/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) && "bg-yellow font-semibold text-background"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    type="button"
                    onClick={() => openNewForDay(day)}
                    className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-foreground"
                    aria-label={`Plan post on ${format(day, "MMMM d")}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {dayEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openEdit(entry)}
                      className={cn(
                        "flex items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors",
                        entry.status === "CANCELLED"
                          ? "bg-surface-2 text-muted line-through"
                          : entry.status === "PUBLISHED"
                            ? "bg-success/15 text-success hover:bg-success/20"
                            : "bg-surface-2 text-foreground hover:bg-yellow/15 hover:text-yellow"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          entry.status === "PUBLISHED"
                            ? "bg-success"
                            : entry.status === "CANCELLED"
                              ? "bg-muted"
                              : "bg-yellow"
                        )}
                        aria-hidden
                      />
                      <PlatformIcon platform={entry.platform} className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* List view (always shown below on mobile when toggled, or when month has entries) */}
      <div className={cn("space-y-3", !mobileList && "md:hidden")}>
        {monthEntries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing planned this month"
            description="Click any day on the calendar or use Plan post to schedule your next piece."
            action={
              <Button type="button" variant="primary" onClick={() => openNewForDay(new Date())}>
                <Plus /> Plan a post
              </Button>
            }
          />
        ) : (
          monthEntries.map((entry) => (
            <Card key={entry.id} className="flex items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow" aria-hidden />
                  <PlatformBadge platform={entry.platform} />
                  <Badge
                    tone={
                      entry.status === "PUBLISHED"
                        ? "success"
                        : entry.status === "CANCELLED"
                          ? "muted"
                          : "yellow"
                    }
                  >
                    {entry.status}
                  </Badge>
                  <span className="text-xs text-muted">
                    {format(new Date(entry.scheduled_for), "EEE, MMM d · h:mm a")}
                  </span>
                </div>
                <p className="font-medium">{entry.title}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => openEdit(entry)}>
                <Edit3 /> Edit
              </Button>
            </Card>
          ))
        )}
      </div>

      {/* Add / Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit planned post" : "Plan a post"}</DialogTitle>
            <DialogDescription>
              Pick a draft or enter a working title, platform, and target date/time.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {drafts.length > 0 && (
              <Field label="Link saved draft (optional)" htmlFor="cal-draft">
                <Select
                  id="cal-draft"
                  value={draftId}
                  onChange={(e) => onPickDraft(e.target.value)}
                >
                  <option value="">No linked draft</option>
                  {drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({PLATFORM_LABEL[d.platform]})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Title" htmlFor="cal-title">
              <Input
                id="cal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Q2 product retrospective"
                required
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
            <Field label="Scheduled date & time" htmlFor="cal-when">
              <Input
                id="cal-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                required
              />
            </Field>
            {editing && (
              <Field label="Status" htmlFor="cal-status">
                <Select
                  id="cal-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CalendarStatus)}
                >
                  {CALENDAR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <DialogFooter className="sm:justify-between">
              {editing ? (
                <ConfirmDialog
                  title="Remove from calendar?"
                  description={`“${editing.title}” will be removed from the calendar.`}
                  onConfirm={() => handleDelete(editing.id)}
                >
                  <Button type="button" variant="outline" className="text-danger hover:text-danger">
                    <Trash2 /> Delete
                  </Button>
                </ConfirmDialog>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editing ? "Save changes" : "Add to calendar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
