"use client";

import dynamic from "next/dynamic";
import type { AsciiGradientBgProps } from "@/components/landing/ascii-gradient-bg";
import { cn } from "@/lib/utils";

function AsciiPlaceholder({ fixed = true, className }: { fixed?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none inset-0 z-0 bg-[radial-gradient(ellipse_at_top_left,var(--yellow-dim),transparent_48%),radial-gradient(ellipse_at_bottom_right,var(--blue-dim),transparent_52%)] opacity-50",
        fixed ? "fixed" : "absolute",
        className
      )}
    />
  );
}

const DynamicAsciiGradientBg = dynamic(
  () => import("@/components/landing/ascii-gradient-bg").then((mod) => mod.AsciiGradientBg),
  {
    ssr: false,
    loading: () => <AsciiPlaceholder />,
  }
);

export function AsciiGradientBgDynamic(props: AsciiGradientBgProps) {
  if (process.env.NEXT_PUBLIC_BASIC_UI === "true") {
    return null;
  }
  return <DynamicAsciiGradientBg {...props} />;
}
