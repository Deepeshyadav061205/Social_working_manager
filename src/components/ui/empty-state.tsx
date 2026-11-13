import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friendly empty state with an icon badge and a CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface-1/80 px-6 py-14 text-center",
        className
      )}
    >
      <div className="relative mb-5">
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-yellow" aria-hidden />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-foreground shadow-soft">
          <Icon className="h-7 w-7 text-blue" aria-hidden />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
