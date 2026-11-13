import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Resolve a CSS color token such as `var(--coral-500)` from `:root` computed styles for `<canvas>` callers. */
export function resolveCssColor(color: string): string {
  const trimmed = color.trim();
  const match = /^var\(\s*(--[^,\s)]+)(?:\s*,\s*([^)]+))?\s*\)$/.exec(trimmed);
  if (!match || typeof document === "undefined") return color;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return resolved || (match[2] ? resolveCssColor(match[2]) : color);
}

/** Small typed fetch helper for client components. Throws Error(message) on non-2xx. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}
