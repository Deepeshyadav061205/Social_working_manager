"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

/**
 * Thin yellow-to-blue top progress bar that starts on internal link clicks
 * and completes when App Router pathname/searchParams update.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const trickleRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const prevKeyRef = useRef(routeKey);

  const clearTimers = () => {
    if (trickleRef.current !== null) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (hideRef.current !== null) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  };

  // Complete progress when navigation commits
  useEffect(() => {
    if (prevKeyRef.current === routeKey) return;
    prevKeyRef.current = routeKey;
    if (!active) return;

    clearTimers();
    setProgress(1);
    hideRef.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 200);
  }, [active, routeKey]);

  // Listen to internal anchor clicks
  useEffect(() => {
    if (isBasicUi) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      if (nextKey === prevKeyRef.current) return;

      clearTimers();
      setActive(true);
      setProgress(0.22);

      trickleRef.current = window.setInterval(() => {
        setProgress((p) => (p >= 0.88 ? p : p + (0.9 - p) * 0.18));
      }, 160);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (isBasicUi || !active) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]">
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-yellow to-blue transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
