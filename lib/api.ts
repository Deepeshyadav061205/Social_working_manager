import "server-only";
import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";

/** Standard JSON error response with a human-readable message (NFR-10). */
export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function zodMessage(err: ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid request.";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

/** Parse + validate a JSON body. Returns data or a ready-made 400 response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: jsonError("Request body must be valid JSON.", 400) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(zodMessage(parsed.error), 400, { issues: parsed.error.flatten().fieldErrors }),
    };
  }
  return { ok: true, data: parsed.data };
}

export function dbError(
  message = "Database error. Please try again.",
  err?: { message?: string; code?: string } | null
) {
  if (err) {
    console.error("[dbError]", message, { message: err.message, code: err.code });
  } else {
    console.error("[dbError]", message);
  }
  return jsonError(message, 500);
}

/** UUID check for dynamic route params. */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
