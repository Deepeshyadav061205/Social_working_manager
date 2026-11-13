import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { NavProgress } from "@/components/layout/nav-progress";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://socialworkingmanager.vercel.app"
  ),
  title: { default: "Social Working Manager", template: "%s · Social Working Manager" },
  description:
    "An AI-assisted workspace to turn ideas into polished LinkedIn posts, X threads and blog articles — then edit, save, plan and publish.",
  openGraph: {
    title: "Social Working Manager",
    description:
      "AI-powered multi-platform content workspace for LinkedIn posts, X threads, and Markdown blogs.",
    url: "/",
    siteName: "Social Working Manager",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const basicUi = process.env.NEXT_PUBLIC_BASIC_UI === "true";
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className={basicUi ? "min-h-screen basic-ui" : "min-h-screen"}>
        <noscript>
          <style>{".swm-reveal{opacity:1!important;transform:none!important;filter:none!important}"}</style>
        </noscript>
        {!basicUi && (
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
        )}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-yellow focus:px-4 focus:py-2 focus:font-semibold focus:text-background"
        >
          Skip to content
        </a>
        {children}
        <Toaster
          theme={basicUi ? "light" : "dark"}
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-card !border !border-line-strong !bg-surface-1 !text-foreground !shadow-lift !font-sans",
              description: "!text-muted",
              success: "[&_[data-icon]]:!text-success",
              error: "[&_[data-icon]]:!text-danger",
            },
          }}
        />
      </body>
    </html>
  );
}
