import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "yellow" | "blue" | "white" | "success" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-foreground ring-1 ring-inset ring-line",
  yellow: "bg-yellow-dim text-yellow ring-1 ring-inset ring-yellow/35",
  blue: "bg-blue-dim text-blue ring-1 ring-inset ring-blue/35",
  white: "bg-foreground/10 text-foreground ring-1 ring-inset ring-line-strong",
  success: "bg-success/15 text-success ring-1 ring-inset ring-success/35",
  danger: "bg-danger/15 text-danger ring-1 ring-inset ring-danger/35",
  muted: "bg-surface-2 text-muted ring-1 ring-inset ring-line",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
