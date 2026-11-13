"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Card } from "@/components/ui/card";

const isBasicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

const DynamicCountUp = dynamic(() => import("@/components/reactbits/CountUp"), {
  ssr: false,
});

const spotlightVars = {
  "--spotlight-card-surface": "var(--surface-1)",
  "--spotlight-card-border": "var(--line)",
} as CSSProperties;

export function DashboardStatsGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        isBasicUi
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          : "animate-fade-up grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      {children}
    </div>
  );
}

export function DashboardStatCard({ href, children }: { href: string; children: ReactNode }) {
  if (isBasicUi) {
    return (
      <Link href={href} className="group block rounded-card">
        <Card className="p-5">{children}</Card>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block rounded-card">
      <SpotlightCard
        theme="dark"
        spotlightColor="var(--blue)"
        intensity={0.14}
        style={spotlightVars}
        className="card-hover-fx rounded-card border border-line p-5"
      >
        {children}
      </SpotlightCard>
    </Link>
  );
}

export function DashboardStatValue({ value }: { value: number }) {
  if (isBasicUi) {
    return <p className="mt-3 font-serif text-3xl font-semibold text-foreground">{value}</p>;
  }

  return (
    <p className="mt-3 font-serif text-3xl font-semibold text-foreground">
      <DynamicCountUp to={value} from={0} duration={0.8} trigger="load" />
    </p>
  );
}
