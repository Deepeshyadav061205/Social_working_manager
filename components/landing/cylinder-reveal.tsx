"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const LINES = [
  { text: "Write once.", tone: "white" as const },
  { text: "Refine with AI.", tone: "yellow" as const },
  { text: "Publish or transfer.", tone: "white" as const },
  { text: "Plan your calendar.", tone: "blue" as const },
];

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

/**
 * Lightweight 3D cylinder text reveal driven by scroll position via rAF.
 * Renders static stacked lines on mobile (< 640px), reduced motion, and basic-ui mode.
 */
export function CylinderReveal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    if (isBasicUi) return;
    const container = containerRef.current;
    if (!container) return;

    const reduceQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia?.("(min-width: 640px)");

    let rafId = 0;

    const resetStatic = () => {
      for (const el of lineRefs.current) {
        if (!el) continue;
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
      }
    };

    const update = () => {
      rafId = 0;
      if ((reduceQuery?.matches ?? false) || !(desktopQuery?.matches ?? true)) {
        resetStatic();
        return;
      }

      const vh = window.innerHeight || 800;
      const center = vh * 0.5;

      for (const el of lineRefs.current) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const lineCenter = rect.top + rect.height * 0.5;
        // Normalized distance from viewport center in [-1, 1]
        const norm = Math.max(-1.2, Math.min(1.2, (lineCenter - center) / (vh * 0.45)));
        const angle = norm * -34; // degrees around cylinder X axis
        const absNorm = Math.min(1, Math.abs(norm));
        const opacity = Math.max(0.32, 1 - absNorm * 0.62);
        const blurPx = absNorm > 0.35 ? ((absNorm - 0.35) * 4.5).toFixed(2) : "0";
        const scale = (1 - absNorm * 0.08).toFixed(3);

        el.style.transform = `perspective(900px) rotateX(${angle.toFixed(2)}deg) scale(${scale})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blurPx === "0" ? "none" : `blur(${blurPx}px)`;
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    reduceQuery?.addEventListener?.("change", onScroll);
    desktopQuery?.addEventListener?.("change", onScroll);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reduceQuery?.removeEventListener?.("change", onScroll);
      desktopQuery?.removeEventListener?.("change", onScroll);
    };
  }, []);

  return (
    <div ref={containerRef} id="rhythm-heading" className="space-y-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-[42px]">
      {LINES.map((line, i) => (
        <p
          key={line.text}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className={cn(
            "origin-center will-change-transform",
            line.tone === "yellow"
              ? "text-yellow"
              : line.tone === "blue"
                ? "text-blue"
                : "text-foreground"
          )}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}
