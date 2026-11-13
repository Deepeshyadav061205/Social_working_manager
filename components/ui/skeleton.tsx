import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, yellow, ...props }: React.HTMLAttributes<HTMLDivElement> & { yellow?: boolean }) {
  return <div aria-hidden className={cn(yellow ? "skeleton-yellow" : "skeleton", "h-4", className)} {...props} />;
}

/** Yellow spinner used while the AI is generating. */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-yellow"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
