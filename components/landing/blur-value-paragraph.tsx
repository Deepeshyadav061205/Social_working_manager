"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Segment {
  text: string;
  highlight?: "yellow" | "blue";
}

const SEGMENTS: Segment[] = [
  { text: "An " },
  { text: "AI-assisted", highlight: "yellow" },
  { text: " writing studio built for " },
  { text: "LinkedIn, X and Blog", highlight: "blue" },
  { text: ". Drafts stay grounded in " },
  { text: "your tone", highlight: "yellow" },
  { text: ", edit cleanly in place, and move straight to publish or " },
  { text: "One-Click Transfer", highlight: "blue" },
  { text: " without fighting your workflow." },
];

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

/**
 * Value paragraph with staggered word-by-word blur-to-sharp reveal on scroll.
 * Plain readable text when JS is unavailable, basic-ui is enabled, or reduced motion is preferred.
 */
export function BlurValueParagraph() {
  const ref = useRef<HTMLParagraphElement | null>(null);
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
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  if (isBasicUi) {
    return (
      <p className="text-lg leading-relaxed">
        {SEGMENTS.map((seg, i) => (
          <span key={i}>{seg.text}</span>
        ))}
      </p>
    );
  }

  let wordIdx = 0;

  return (
    <p ref={ref} className="text-lg leading-relaxed text-muted">
      {SEGMENTS.map((seg, sIdx) => {
        const tokens = seg.text.split(/(\s+)/);
        const content = tokens.map((tok, tIdx) => {
          if (/^\s+$/.test(tok)) return tok;
          const idx = wordIdx++;
          return (
            <span
              key={`${sIdx}-${tIdx}`}
              style={{ "--word-idx": idx } as CSSProperties}
              className={cn(
                "inline-block transition-[opacity,filter,transform] duration-500 ease-out",
                "motion-reduce:!opacity-100 motion-reduce:!filter-none motion-reduce:!transform-none",
                visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-1.5 opacity-0 blur-[6px]"
              )}
            >
              <span style={{ transitionDelay: `${Math.min(idx * 22, 520)}ms` }}>{tok}</span>
            </span>
          );
        });

        if (seg.highlight === "yellow") {
          return (
            <span key={sIdx} className="mark-yellow">
              {content}
            </span>
          );
        }
        if (seg.highlight === "blue") {
          return (
            <span key={sIdx} className="mark-blue">
              {content}
            </span>
          );
        }
        return <span key={sIdx}>{content}</span>;
      })}
    </p>
  );
}
