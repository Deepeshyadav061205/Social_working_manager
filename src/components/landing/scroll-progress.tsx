"use client";

import { useEffect, useRef } from "react";

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

/**
 * Thin yellow-to-blue scroll progress bar at the top of the landing page.
 * Uses transform scaleX throttled via requestAnimationFrame.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isBasicUi) return;
    const bar = barRef.current;
    if (!bar) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (isBasicUi) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-yellow to-blue"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
