"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";

export function PageEnter({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_BASIC_UI === "true") {
    return <>{children}</>;
  }

  return <Reveal blur={false}>{children}</Reveal>;
}
