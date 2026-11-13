"use client";

import { useEffect, useRef } from "react";
import { cn, resolveCssColor } from "@/lib/utils";

export interface AsciiGradientBgProps {
  className?: string;
  /** Multiplier for glyph opacity. At 1.0, active glyphs span ~0.15 to 0.45 alpha. */
  opacity?: number;
  cellSize?: number;
  fps?: number;
  /** Use fixed full-viewport positioning (landing/app backdrop) vs absolute container fill (auth aside). */
  fixed?: boolean;
  /** Draw once (plus debounced resize) without running the animation loop. */
  staticOnly?: boolean;
}

const RAMP = " .:-=+*#%@";
const MAX_CELLS = 6000;

function parseHexOrRgb(raw: string, fallback: [number, number, number]): [number, number, number] {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex =
      s.length === 4 ? `${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s.slice(1, 7);
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const m = s.match(/[\d.]+/g);
  if (m && m.length >= 3) {
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  return fallback;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Lightweight 2D canvas ASCII yellow-to-blue gradient texture.
 * Respects NEXT_PUBLIC_BASIC_UI, prefers-reduced-motion, visibility, and viewport intersection.
 */
export function AsciiGradientBg({
  className,
  opacity = 0.9,
  cellSize = 16,
  fps = 20,
  fixed = true,
  staticOnly = false,
}: AsciiGradientBgProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

  useEffect(() => {
    if (isBasicUi) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!fixed && !parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reduceMotion = reducedMotionQuery?.matches ?? false;

    const yellowRgb = parseHexOrRgb(resolveCssColor("var(--yellow)"), [250, 204, 21]);
    const blueRgb = parseHexOrRgb(resolveCssColor("var(--blue)"), [96, 165, 250]);

    let width = 0;
    let height = 0;
    let effectiveCell = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;

    let rafId = 0;
    let resizeTimer: number | null = null;
    let isIntersecting = true;
    let isVisible = document.visibilityState !== "hidden";
    let lastDrawTime = 0;
    let phase = 0.6;
    let sampleCount = 0;
    let sampleTotalMs = 0;

    const computeGrid = () => {
      if (fixed) {
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
      } else {
        const rect = parent!.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));
      }
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      const baseCell = width < 640 ? Math.max(cellSize, 18) : Math.max(12, cellSize);
      const minCellForBudget = Math.ceil(Math.sqrt((width * height) / MAX_CELLS));
      effectiveCell = Math.max(baseCell, minCellForBudget);

      cols = Math.max(1, Math.floor(width / effectiveCell));
      rows = Math.max(1, Math.floor(height / effectiveCell));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const drawFrame = (timeShift: number) => {
      const tStart = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const fontSize = Math.max(11, Math.round(effectiveCell * 0.88));
      ctx.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < rows; r++) {
        const ny = rows > 1 ? r / (rows - 1) : 0.5;
        const y = (r + 0.5) * effectiveCell;

        // Smooth edge feathering at top and bottom (no hard cut)
        const edgeY = smoothstep(0.0, 0.14, ny) * smoothstep(1.0, 0.82, ny);

        for (let c = 0; c < cols; c++) {
          const nx = cols > 1 ? c / (cols - 1) : 0.5;
          const x = (c + 0.5) * effectiveCell;

          // Smooth edge feathering at left and right
          const edgeX = smoothstep(0.0, 0.1, nx) * smoothstep(1.0, 0.9, nx);

          // Summed sine wave field
          const v1 = Math.sin(nx * 4.8 + timeShift * 0.85);
          const v2 = Math.cos(ny * 4.1 - timeShift * 0.65);
          const v3 = Math.sin((nx + ny) * 3.5 + timeShift * 0.5);
          const norm = ((v1 + v2 + v3) / 3 + 1) * 0.5; // [0, 1]

          // Soft center-reading vignette so text blocks remain high contrast
          const dx = (nx - 0.5) * 1.4;
          const dy = (ny - 0.45) * 1.25;
          const distFromTextCore = Math.sqrt(dx * dx + dy * dy);
          const textVignette = 0.42 + 0.58 * smoothstep(0.15, 0.95, distFromTextCore);

          const intensity = Math.min(1, Math.max(0, norm * edgeX * edgeY * textVignette));
          const charIdx = Math.min(RAMP.length - 1, Math.max(0, Math.floor(intensity * RAMP.length)));
          if (charIdx === 0) continue;

          // Diagonal gradient: yellow -> blue
          const diag = Math.min(1, Math.max(0, nx * 0.62 + ny * 0.38));
          const rCh = lerpChannel(yellowRgb[0], blueRgb[0], diag);
          const gCh = lerpChannel(yellowRgb[1], blueRgb[1], diag);
          const bCh = lerpChannel(yellowRgb[2], blueRgb[2], diag);

          // Active glyphs range from ~0.15 to ~0.45 alpha at opacity=1
          const alpha = (0.15 + intensity * 0.3) * opacity;

          ctx.fillStyle = `rgba(${rCh}, ${gCh}, ${bCh}, ${alpha.toFixed(3)})`;
          ctx.fillText(RAMP[charIdx], x, y);
        }
      }

      const dt = performance.now() - tStart;
      if (process.env.NODE_ENV !== "production") {
        sampleTotalMs += dt;
        sampleCount += 1;
        if (sampleCount >= 30 || staticOnly || reduceMotion) {
          console.debug(
            `[AsciiGradientBg] avg draw: ${(sampleTotalMs / sampleCount).toFixed(2)}ms (${cols}x${rows}=${cols * rows} cells)`
          );
          sampleCount = 0;
          sampleTotalMs = 0;
        }
      }
    };

    const frameInterval = 1000 / Math.max(1, fps);

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const tick = (now: number) => {
      if (staticOnly || !isIntersecting || !isVisible || reduceMotion) {
        rafId = 0;
        return;
      }
      if (now - lastDrawTime >= frameInterval) {
        const deltaSec = lastDrawTime ? Math.min(0.1, (now - lastDrawTime) / 1000) : 0.05;
        phase += deltaSec * 0.8;
        lastDrawTime = now;
        drawFrame(phase);
      }
      rafId = requestAnimationFrame(tick);
    };

    const startOrRenderStatic = () => {
      stopLoop();
      if (staticOnly || reduceMotion) {
        drawFrame(0.6);
        return;
      }
      if (isIntersecting && isVisible) {
        lastDrawTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    const onVisibilityChange = () => {
      isVisible = document.visibilityState !== "hidden";
      if (isVisible) startOrRenderStatic();
      else stopLoop();
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
      startOrRenderStatic();
    };

    const io = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries.some((entry) => entry.isIntersecting);
        if (isIntersecting) startOrRenderStatic();
        else stopLoop();
      },
      { threshold: 0.01 }
    );

    const handleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        computeGrid();
        drawFrame(phase);
      }, 150);
    };

    let ro: ResizeObserver | null = null;
    if (!fixed && parent) {
      ro = new ResizeObserver(handleResize);
      ro.observe(parent);
    } else {
      window.addEventListener("resize", handleResize, { passive: true });
    }

    computeGrid();
    drawFrame(phase);
    startOrRenderStatic();

    if (!staticOnly) {
      io.observe(canvas);
      document.addEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery?.addEventListener?.("change", onMotionChange);
    }

    return () => {
      stopLoop();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      io.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery?.removeEventListener?.("change", onMotionChange);
    };
  }, [cellSize, fixed, fps, isBasicUi, opacity, staticOnly]);

  if (isBasicUi) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none inset-0 z-0 h-full w-full select-none",
        fixed ? "fixed" : "absolute",
        className
      )}
    />
  );
}
