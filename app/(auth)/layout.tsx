import { AsciiGradientBgDynamic } from "@/components/landing/ascii-gradient-dynamic";
import { Logo } from "@/components/layout/logo";
import ShinyText from "@/components/reactbits/ShinyText";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const basicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface-1 p-10 text-foreground lg:flex">
        {!basicUi ? <AsciiGradientBgDynamic fixed={false} opacity={0.45} /> : null}
        <div className="relative z-10">
          <Logo />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-20 z-0 h-80 w-80 rounded-full border border-line"
        />
        <blockquote className="relative z-10 max-w-md">
          <p className="font-serif text-3xl leading-snug text-foreground">
            “Write the idea once. Shape it for every audience.”
          </p>
          <span aria-hidden className="mt-6 block h-1 w-16 rounded-full bg-yellow" />
        </blockquote>
        <p className="relative z-10 text-sm text-muted">
          {basicUi ? (
            "LinkedIn · X · Blog"
          ) : (
            <ShinyText
              text="LinkedIn · X · Blog"
              color="var(--muted)"
              shineColor="var(--yellow)"
              speed={3}
            />
          )}
        </p>
      </aside>
      <main id="main" className="relative flex items-center justify-center bg-background px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
