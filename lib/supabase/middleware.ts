import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that never require a session. Everything else is protected. */
const PUBLIC_PAGES = ["/", "/login", "/register"];
const PUBLIC_API_PREFIXES: string[] = [];
const AUTH_PAGES = ["/login", "/register"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true; // email confirmation callback
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Refreshes the Supabase session cookie and enforces authentication:
 *  - unauthenticated page request  -> redirect to /login?next=… (FR-3)
 *  - unauthenticated API request   -> 401 JSON (before any route code runs; FR-3, NFR-3)
 *  - authenticated user on /login  -> redirect to /dashboard
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Misconfigured deployment: fail closed for protected routes.
    if (isPublic(pathname)) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Server auth is not configured." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const supabase = createServerClient(url, anon, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth (do not trust getSession() alone).
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
