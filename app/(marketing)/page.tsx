import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarDays, History, PenLine } from "lucide-react";
import { AsciiGradientBgDynamic } from "@/components/landing/ascii-gradient-dynamic";
import { BlurValueParagraph } from "@/components/landing/blur-value-paragraph";
import { CylinderReveal } from "@/components/landing/cylinder-reveal";
import { HeroCta } from "@/components/landing/hero-cta";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { Logo } from "@/components/layout/logo";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Reveal } from "@/components/ui/reveal";

const workflowSteps = [
  {
    step: "01",
    title: "Generate",
    description:
      "Describe an idea in a sentence or pick a template. Get a structured draft tuned to your platform and tone.",
  },
  {
    step: "02",
    title: "Refine",
    description:
      "Tighten pacing, cut filler, and edit every word in place while keeping facts and X character limits intact.",
  },
  {
    step: "03",
    title: "Publish or Transfer",
    description:
      "Post directly through connected accounts, or use One-Click Transfer to copy and open the composer cleanly.",
  },
];

const compactHighlights = [
  {
    icon: PenLine,
    title: "Edit & save drafts",
    body: "Autosaved session safety, live word/character counters, and Blog Markdown preview.",
    accent: "text-yellow",
  },
  {
    icon: History,
    title: "History & templates",
    body: "Compare raw vs. refined versions and turn winning structures into reusable templates.",
    accent: "text-blue",
  },
  {
    icon: CalendarDays,
    title: "Planning calendar",
    body: "Map scheduled posts across LinkedIn, X, and Blog without spreadsheet overhead.",
    accent: "text-yellow",
  },
];

export default function LandingPage() {
  const basicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

  const spotlightVars = {
    "--spotlight-card-surface": "var(--surface-1)",
    "--spotlight-card-border": "var(--line)",
  } as CSSProperties;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {!basicUi ? (
        <>
          <ScrollProgress />
          <AsciiGradientBgDynamic fixed opacity={0.95} cellSize={16} />
        </>
      ) : null}

      {/* Top nav */}
      <header className="relative z-20 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav aria-label="Primary" className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="whitespace-nowrap rounded-control px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 hover:text-blue sm:px-3"
            >
              Sign in
            </Link>
            <Button asChild variant="primary" size="sm" className="whitespace-nowrap">
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" className="relative z-10">
        {/* Hero */}
        <section className="container pb-16 pt-12 sm:pb-20 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue/30 bg-blue-dim px-3.5 py-1 text-xs font-medium tracking-wide text-blue">
                <span className="h-2 w-2 rounded-full bg-yellow" aria-hidden />
                AI content studio for founders &amp; creators
              </span>
              <h1
                className={
                  basicUi
                    ? "font-serif text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl"
                    : "animate-fade-up font-serif text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl"
                }
              >
                From a rough idea to a post worth{" "}
                <span className={basicUi ? "underline" : "mark-yellow inline-block"}>publishing.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Social Working Manager drafts LinkedIn posts, X threads and blog articles in the tone you choose,
                lets you edit every word, and gets it onto the platform — your way.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <HeroCta label="Start writing free" href="/register" />
                <Button asChild variant="ghost" size="lg">
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
              <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                <div className="flex flex-wrap items-center gap-5 text-muted">
                  <span className="text-xs uppercase tracking-[0.16em]">Works with</span>
                  <span className="flex items-center gap-2 text-sm text-blue">
                    <PlatformIcon platform="LINKEDIN" /> LinkedIn
                  </span>
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <PlatformIcon platform="X_TWITTER" /> X
                  </span>
                  <span className="flex items-center gap-2 text-sm text-yellow">
                    <PlatformIcon platform="BLOG" /> Blog
                  </span>
                </div>
                <a
                  href="#rhythm"
                  className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-yellow"
                >
                  Scroll <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </div>

            {/* Product preview card */}
            <div className="flex flex-col items-start gap-3">
              <div className="w-full rounded-card border border-line-strong bg-surface-1 p-5 text-foreground shadow-lift">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-control border border-blue/35 bg-blue-dim px-3 py-1.5 text-xs font-medium text-blue">
                    <PlatformIcon platform="LINKEDIN" /> LinkedIn · Professional
                  </span>
                  <span className="text-xs text-muted">1,184 chars</span>
                </div>
                <p className="font-medium text-foreground">
                  Six months ago I could not deploy a web app. Last week I shipped my third.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  The difference wasn’t talent. It was a habit: one small, finished thing every week…
                </p>
                <div className="mt-4 space-y-2" aria-hidden>
                  <div className="h-2.5 w-11/12 rounded-full bg-surface-2" />
                  <div className="h-2.5 w-9/12 rounded-full bg-surface-2" />
                  <div className="h-2.5 w-10/12 rounded-full bg-surface-2" />
                </div>
                <div className="mt-5 flex gap-2">
                  <span className="rounded-control bg-yellow px-3 py-1.5 text-xs font-semibold text-background">
                    Publish
                  </span>
                  <span className="rounded-control border border-line-strong px-3 py-1.5 text-xs font-medium text-foreground">
                    Save draft
                  </span>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-card border border-line bg-surface-1 px-4 py-2.5 text-xs font-medium text-foreground shadow-soft">
                <CalendarDays className="h-4 w-4 text-yellow" aria-hidden />
                <span>Planned for Thu, 9:30</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3D Line Reveal & Blur Value Paragraph */}
        <section id="rhythm" className="border-t border-line py-16 sm:py-20" aria-labelledby="rhythm-heading">
          <div className="container grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <CylinderReveal />
            <BlurValueParagraph />
          </div>
        </section>

        {/* Unified Workflow + Compact Feature Row */}
        <section id="flow" className="container border-t border-line py-16 sm:py-20" aria-labelledby="flow-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue">Workflow</p>
            <h2 id="flow-heading" className="mt-2 text-3xl font-semibold sm:text-4xl">
              One calm workspace for everything you post.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {workflowSteps.map((item, idx) =>
              basicUi ? (
                <article key={item.step} className="rounded-card border border-line bg-surface-1 p-6">
                  <span className="text-xs font-semibold uppercase tracking-widest text-yellow">{item.step}</span>
                  <h3 className="mt-3 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                </article>
              ) : (
                <Reveal key={item.step} index={idx}>
                  <SpotlightCard
                    theme="dark"
                    spotlightColor="var(--blue)"
                    intensity={0.14}
                    style={spotlightVars}
                    className="card-hover-fx h-full rounded-card border border-line p-6"
                  >
                    <article>
                      <span className="text-xs font-semibold uppercase tracking-widest text-yellow">{item.step}</span>
                      <h3 className="mt-3 text-xl font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                    </article>
                  </SpotlightCard>
                </Reveal>
              )
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {compactHighlights.map((h, idx) => (
              <Reveal key={h.title} index={idx} blur={false}>
                <div className="card-hover-fx flex h-full items-start gap-3.5 rounded-card border border-line bg-surface-1/90 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-surface-2">
                    <h.icon className={`h-4 w-4 ${h.accent}`} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-sans text-base font-semibold text-foreground">{h.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{h.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="container pb-20">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-6 rounded-card border border-line-strong bg-surface-1 p-8 shadow-lift sm:flex-row sm:items-center sm:p-12">
              <div>
                <h2 className="text-3xl font-semibold text-foreground">Your next post is one idea away.</h2>
                <p className="mt-2 text-muted">
                  Create an account in under a minute. No platform approval needed to start.
                </p>
              </div>
              <Button asChild variant="primary" size="lg">
                <Link href="/register">
                  Create your workspace <ArrowRight className="arrow-slide" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Social Working Manager</span>
          <span>Built for people who have something to say.</span>
        </div>
      </footer>
    </div>
  );
}
