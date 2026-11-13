"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: React.ReactNode };

/**
 * Selectable chip used for platform / tone pickers.
 * Selected state = yellow-dim fill with a yellow border and yellow underline.
 * Render inside a container with role="radiogroup".
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ selected, icon, children, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-control border px-4 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-yellow/60 bg-yellow-dim text-yellow"
          : "border-line bg-surface-1 text-foreground hover:border-line-strong hover:bg-surface-2",
        className
      )}
      {...props}
    >
      {icon}
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-yellow transition-opacity duration-150",
          selected ? "opacity-100" : "opacity-0"
        )}
      />
    </button>
  )
);
Chip.displayName = "Chip";

/** Keyboard-accessible radio group wrapper (arrow keys move selection). */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  renderIcon,
  renderLabel,
  id,
  invalid,
  describedBy,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T) => void;
  renderIcon?: (v: T) => React.ReactNode;
  renderLabel: (v: T) => string;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next]);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      id={id}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt, i) => {
        const selected = value === opt;
        return (
          <Chip
            key={opt}
            ref={(el) => {
              refs.current[i] = el;
            }}
            selected={selected}
            tabIndex={selected || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(opt)}
            onKeyDown={(e) => onKeyDown(e, i)}
            icon={renderIcon?.(opt)}
          >
            {renderLabel(opt)}
          </Chip>
        );
      })}
    </div>
  );
}
