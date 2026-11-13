"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Re-mounts on route changes in App Router and plays a quick enter transition.
 * Disabled on /create (so the streaming editor never animates) and in basic-ui mode.
 */
export default function RootTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const basicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

  if (basicUi || pathname.startsWith("/create")) {
    return <>{children}</>;
  }

  return <div className="animate-page-enter">{children}</div>;
}
