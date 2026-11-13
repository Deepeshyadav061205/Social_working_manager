import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMaxOutputTokens, getModel, getProvider } from "@/lib/llm";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_PROVIDER",
  "LLM_MODEL",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "LLM_MAX_OUTPUT_TOKENS",
  "LLM_REFINE_ENABLED",
  "NEXT_PUBLIC_BASIC_UI",
  "TOKEN_ENCRYPTION_KEY",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

const TABLES = [
  "profiles",
  "templates",
  "content_requests",
  "generated_content",
  "drafts",
  "platform_connections",
  "publish_jobs",
  "calendar_entries",
] as const;

/**
 * GET /api/health — Authenticated diagnostics endpoint.
 * Returns environment variable statuses ("set" | "missing", never secret values),
 * reachability of all 8 database tables, and on_auth_user_created trigger status.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const env: Record<string, "set" | "missing"> = {};
  for (const name of ENV_NAMES) {
    env[name] = (process.env[name] ?? "").split("#")[0].trim().length > 0 ? "set" : "missing";
  }

  let provider = "gemini";
  let model = "gemini-3.5-flash-lite";
  try {
    const p = getProvider();
    provider = p;
    model = getModel(p);
  } catch {
    /* fallback to defaults if LLM_PROVIDER is invalid */
  }

  const client = hasAdminClient() ? createAdminClient() : auth.supabase;

  const tables: Record<string, { status: "PASS" | "FAIL"; code?: string; message?: string }> = {};
  for (const t of TABLES) {
    const { error } = await client.from(t).select("id").limit(1);
    if (error) {
      tables[t] = { status: "FAIL", code: error.code, message: error.message };
    } else {
      tables[t] = { status: "PASS" };
    }
  }

  let trigger: {
    status: "PASS" | "FAIL";
    totalAuthUsers?: number;
    missingProfiles?: number;
    message?: string;
  } = { status: "FAIL", message: "Service role client unavailable" };

  if (hasAdminClient()) {
    const admin = createAdminClient();
    const [{ data: usersData, error: usersErr }, { data: profilesData, error: profErr }] = await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("profiles").select("id"),
    ]);
    if (usersErr || profErr) {
      trigger = {
        status: "FAIL",
        message: usersErr?.message ?? profErr?.message ?? "Failed to verify auth.users against profiles",
      };
    } else {
      const users = usersData?.users ?? [];
      const profileIds = new Set((profilesData ?? []).map((p: { id: string }) => p.id));
      const missing = users.filter((u) => !profileIds.has(u.id)).length;
      trigger = {
        status: missing === 0 ? "PASS" : "FAIL",
        totalAuthUsers: users.length,
        missingProfiles: missing,
      };
    }
  }

  const allTablesPass = Object.values(tables).every((t) => t.status === "PASS");
  const ok =
    env.NEXT_PUBLIC_SUPABASE_URL === "set" &&
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "set" &&
    env.SUPABASE_SERVICE_ROLE_KEY === "set" &&
    env.GEMINI_API_KEY === "set" &&
    allTablesPass &&
    trigger.status === "PASS";

  return NextResponse.json({
    ok,
    env,
    llm: {
      provider,
      model,
      maxOutputTokens: getMaxOutputTokens(),
      refineEnabled: (process.env.LLM_REFINE_ENABLED ?? "true").trim().toLowerCase() !== "false",
    },
    tables,
    trigger,
  });
}
