import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { LlmError, generateText, llmHttpStatus, maxTokensForPlatform } from "@/lib/llm";
import { buildRefinePrompt, cleanModelOutput } from "@/lib/prompts";
import { enforceXLimits } from "@/lib/text";
import { refineSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/refine — runs the refinement pass on the user's current (possibly edited) text.
 * Improves readability and flow while preserving meaning and facts.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  const tAuthStart = Date.now();
  const auth = await requireUser();
  const authMs = Date.now() - tAuthStart;
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, refineSchema);
  if (!parsed.ok) return parsed.response;
  const { text, platform, tone } = parsed.data;

  const refineEnabled = (process.env.LLM_REFINE_ENABLED ?? "true").trim().toLowerCase() !== "false";
  if (!refineEnabled) {
    const fallback = platform === "X_TWITTER" ? enforceXLimits(text) : text;
    console.log("[refine] timing (ms)", {
      platform,
      auth: authMs,
      llmRefine: 0,
      total: Date.now() - startedAt,
    });
    return NextResponse.json({
      text: fallback,
      warning: "Refinement is disabled (LLM_REFINE_ENABLED=false).",
    });
  }

  if (Date.now() - startedAt > 40_000) {
    const fallback = platform === "X_TWITTER" ? enforceXLimits(text) : text;
    console.log("[refine] timing (ms)", {
      platform,
      auth: authMs,
      llmRefine: 0,
      total: Date.now() - startedAt,
    });
    return NextResponse.json({
      text: fallback,
      warning: "Skipped refinement because request setup exceeded 40s.",
    });
  }

  const tRefineStart = Date.now();
  try {
    const refinePrompt = buildRefinePrompt({ text, platform, tone });
    let out = cleanModelOutput(
      await generateText({ ...refinePrompt, maxOutputTokens: maxTokensForPlatform(platform) })
    );
    const llmRefineMs = Date.now() - tRefineStart;
    if (platform === "X_TWITTER") out = enforceXLimits(out);
    console.log("[refine] timing (ms)", {
      platform,
      auth: authMs,
      llmRefine: llmRefineMs,
      total: Date.now() - startedAt,
    });
    return NextResponse.json({ text: out });
  } catch (err) {
    const llmRefineMs = Date.now() - tRefineStart;
    console.log("[refine] timing (ms)", {
      platform,
      auth: authMs,
      llmRefine: llmRefineMs,
      total: Date.now() - startedAt,
    });
    const e = err instanceof LlmError ? err : new LlmError("Refinement failed.");
    return jsonError(e.message, llmHttpStatus(e));
  }
}
