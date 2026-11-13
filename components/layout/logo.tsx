import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark: dark tile with a yellow dot. */
export function Logo({ className, compact }: { inverted?: boolean; className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-control focus-visible:ring-offset-background",
        className
      )}
      aria-label="Social Working Manager home"
    >
      <span
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong bg-surface-2 font-serif text-lg font-bold text-foreground"
        aria-hidden
      >
        S
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-yellow" />
      </span>
      {!compact && (
        <span className="font-serif text-lg font-semibold leading-none text-foreground">
          Social Working
          <span className="block font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Manager
          </span>
        </span>
      )}
    </Link>
  );
}
