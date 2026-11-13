"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, LogOut, Menu, PenSquare, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { AsciiGradientBgDynamic } from "@/components/landing/ascii-gradient-dynamic";
import { Logo } from "@/components/layout/logo";
import { MOBILE_PRIMARY, NAV_ITEMS, isActive } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function initials(name: string, email: string) {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const activeIdx = NAV_ITEMS.findIndex((item) => isActive(pathname, item.href));
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (activeIdx < 0) {
      setIndicator(null);
      return;
    }
    const el = linkRefs.current[activeIdx];
    if (el) {
      setIndicator({ top: el.offsetTop, height: el.offsetHeight });
    } else {
      setIndicator({ top: activeIdx * 44, height: 40 });
    }
  }, [activeIdx]);

  return (
    <nav aria-label="Main" className="relative flex flex-col gap-1">
      {indicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-control bg-yellow-dim transition-transform ease-out"
          style={{
            height: `${indicator.height}px`,
            transform: `translateY(${indicator.top}px)`,
            transitionDuration: "250ms",
          }}
        >
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-yellow" />
        </div>
      )}
      {NAV_ITEMS.map((item, idx) => {
        const active = idx === activeIdx;
        return (
          <Link
            key={item.href}
            ref={(el) => {
              linkRefs.current[idx] = el;
            }}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative z-10 flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium text-foreground transition-colors duration-150 focus-visible:ring-offset-surface-1",
              !active && "hover:bg-foreground/5"
            )}
          >
            <item.icon
              className={cn("h-[18px] w-[18px] shrink-0 transition-colors duration-150", active ? "text-yellow" : "text-muted")}
              aria-hidden
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { email: string; name: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close mobile drawer automatically after navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const logout = async () => {
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      // Clear any unsaved editor safety-net copies from this browser session.
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      toast.success("You have been logged out.");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not log out. Please try again.");
      setSigningOut(false);
    }
  };

  const current = NAV_ITEMS.find((n) => isActive(pathname, n.href));
  const basicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";
  const showStaticAscii = !basicUi && !pathname.startsWith("/create");

  if (basicUi) {
    return (
      <div className="min-h-screen bg-white text-black">
        <header className="border-b border-gray-300 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <strong className="text-base font-bold">Social Working Manager</strong>
              <nav aria-label="Main" className="flex flex-wrap items-center gap-3 text-sm">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={active ? "font-bold underline" : "underline"}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span>{user.email}</span>
              <button
                type="button"
                onClick={logout}
                disabled={signingOut}
                className="rounded border border-gray-400 bg-gray-100 px-2.5 py-1 text-sm text-black"
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl p-4">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground lg:pl-64">
      {showStaticAscii ? <AsciiGradientBgDynamic staticOnly opacity={0.2} /> : null}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface-1 px-4 py-5 lg:flex">
        <div className="mb-7 px-2">
          <Logo />
        </div>
        <SidebarNav pathname={pathname} />
        <div className="mt-auto space-y-3">
          <div className="rounded-card border border-line bg-surface-2 p-4">
            <p className="text-sm font-medium text-foreground">Got an idea?</p>
            <p className="mt-1 text-xs text-muted">Turn it into a post in seconds.</p>
            <Button asChild variant="primary" size="sm" className="mt-3 w-full">
              <Link href="/create">
                <PenSquare /> New post
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-card border border-line bg-background/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{user.name || "Workspace"}</p>
              <p className="truncate text-[11px] text-muted">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              aria-label="Log out"
              title="Log out"
              className="shrink-0 rounded-control p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <p className="font-serif text-lg font-semibold text-foreground">{current?.label ?? "Workspace"}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-control p-1 pr-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                aria-label="Open user menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-xs font-semibold text-yellow">
                  {initials(user.name, user.email)}
                </span>
                <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:block">
                  {user.name || user.email}
                </span>
                <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <span className="block font-medium text-foreground">{user.name || "Your account"}</span>
                <span className="block truncate text-muted">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={logout} disabled={signingOut} className="text-danger data-[highlighted]:text-danger">
                <LogOut /> {signingOut ? "Logging out…" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main id="main" className="relative z-10 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium focus-visible:ring-offset-surface-1",
                    active ? "text-foreground" : "text-muted"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute top-0 h-[3px] w-8 rounded-b-full bg-yellow", active ? "opacity-100" : "opacity-0")}
                  />
                  <item.icon className={cn("h-5 w-5", active ? "text-yellow" : "text-muted")} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DialogPrimitive.Trigger className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted hover:text-foreground focus-visible:ring-offset-surface-1">
                <Menu className="h-5 w-5" aria-hidden />
                More
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
                <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface-1 p-5 text-foreground shadow-lift data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left duration-200">
                  <div className="mb-6 flex items-center justify-between">
                    <DialogPrimitive.Title className="font-serif text-lg text-foreground">Menu</DialogPrimitive.Title>
                    <DialogPrimitive.Close
                      className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </DialogPrimitive.Close>
                  </div>
                  <DialogPrimitive.Description className="sr-only">Navigate to any section</DialogPrimitive.Description>
                  <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
                  <div className="mt-auto space-y-3 border-t border-line pt-4">
                    <div className="px-1">
                      <p className="truncate text-xs font-medium text-foreground">{user.name || "Workspace"}</p>
                      <p className="truncate text-[11px] text-muted">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      disabled={signingOut}
                      className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 hover:text-danger"
                    >
                      <LogOut className="h-[18px] w-[18px]" aria-hidden />
                      {signingOut ? "Logging out…" : "Log out"}
                    </button>
                  </div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
