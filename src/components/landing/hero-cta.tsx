"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StarBorder from "@/components/reactbits/StarBorder";
import { Button } from "@/components/ui/button";

export function HeroCta({ label, href }: { label: string; href: string }) {
  if (process.env.NEXT_PUBLIC_BASIC_UI === "true") {
    return (
      <Button asChild variant="primary" size="lg">
        <Link href={href}>
          {label} <ArrowRight />
        </Link>
      </Button>
    );
  }

  return (
    <StarBorder
      as={Link}
      href={href}
      theme="light"
      color="var(--text)"
      trailColor="var(--yellow-hover)"
      backgroundColor="var(--yellow)"
      textColor="var(--background)"
      borderColor="var(--yellow-hover)"
      radius={10}
      duration={4}
      className="btn-primary-fx px-6 py-3.5 text-base font-semibold hover:[background:var(--yellow-hover)]"
    >
      {label} <ArrowRight className="arrow-slide h-4 w-4" aria-hidden />
    </StarBorder>
  );
}
