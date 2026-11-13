"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger step index multiplied by 70ms in CSS. */
  index?: number;
  /** Disable blur during reveal transition for crisp text-heavy blocks. */
  blur?: boolean;
  /** Threshold for IntersectionObserver (0-1). */
  threshold?: number;
}

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

/**
 * Lightweight IntersectionObserver + CSS reveal component.
 * Reveals once per mount; honors NEXT_PUBLIC_BASIC_UI and prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  index = 0,
  blur = true,
  threshold = 0.08,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(isBasicUi);

  useEffect(() => {
    if (isBasicUi || visible) return;
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -30px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, visible]);

  if (isBasicUi) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      data-no-blur={blur ? undefined : "true"}
      style={{ "--reveal-index": index } as CSSProperties}
      className={cn("swm-reveal", visible && "is-visible", className)}
    >
      {children}
    </div>
  );
}
