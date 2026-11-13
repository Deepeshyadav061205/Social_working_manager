import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { LlmError, generateText, llmHttpStatus, maxTokensForPlatform } from "@/lib/llm";
import { buildGeneratePrompt, buildRefinePrompt, cleanModelOutput, isTwoPassEnabled } from "@/lib/prompts";
import { GENERATE_LIMIT_PER_HOUR, checkGenerateRateLimit } from "@/lib/rate-limit";
import { enforceXLimits } from "@/lib/text";
import { generateSchema } from "@/lib/validators";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = generateSchema.extend({
  /** When regenerating, the previous history row — used to bump the version number. */
  previousContentId: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/generate
 * 1. verify session  2. validate  3. rate-limit + template lookup (parallel)
 * 4. insert content_requests  5. generate (+ optional 2nd pass when LLM_TWO_PASS=true)
 *    in parallel with previousContentId lookup
 * 6. save raw + refined to history (generated_content)  7. return refined text
 *
 * Resilient to database failures: if recording content_requests or generated_content
 * fails, still calls the LLM and returns { text, content: null, warning }.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  const tAuthStart = Date.now();
  const auth = await requireUser();
  const authMs = Date.now() - tAuthStart;
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { inputText, platform, tone, templateId, previousContentId } = parsed.data;

  // Run rate-limit query and optional template lookup in parallel (A4).
  let rateLimitMs = 0;
  let templateLookupMs = 0;
  const tRateStart = Date.now();
  const rateLimitPromise = checkGenerateRateLimit(supabase, user.id).then((res) => {
    rateLimitMs = Date.now() - tRateStart;
    return res;
  });

  const tTplStart = Date.now();
  const templatePromise: Promise<{ id: string; name: string; structure_text: string } | null> = templateId
    ? Promise.resolve(
        supabase
          .from("templates")
          .select("id, name, structure_text")
          .eq("id", templateId)
          .eq("user_id", user.id)
          .maybeSingle()
      ).then(({ data, error: tplErr }) => {
        templateLookupMs = Date.now() - tTplStart;
        if (tplErr) {
          console.error("[generate] template lookup failed", { message: tplErr.message, code: tplErr.code });
        }
        return data;
      })
    : Promise.resolve(null);

  const [limit, template] = await Promise.all([rateLimitPromise, templatePromise]);

  if (!limit.allowed) {
    return jsonError(
      `You've reached the limit of ${GENERATE_LIMIT_PER_HOUR} generations per hour. Please try again in about ${limit.retryAfterMinutes} minute${limit.retryAfterMinutes === 1 ? "" : "s"}.`,
      429
    );
  }

  const tReqInsertStart = Date.now();
  const { data: request, error: reqErr } = await supabase
    .from("content_requests")
    .insert({ user_id: user.id, input_text: inputText, platform, tone, template_id: template?.id ?? null })
    .select("id")
    .single();
  const requestInsertMs = Date.now() - tReqInsertStart;
  if (reqErr) {
    console.error("[generate] content_requests insert failed", { message: reqErr.message, code: reqErr.code });
  }

  // Start previous-version lookup in parallel with the LLM call (A4).
  const prevVersionPromise: Promise<number> = previousContentId
    ? Promise.resolve(
        supabase
          .from("generated_content")
          .select("version")
          .eq("id", previousContentId)
          .eq("user_id", user.id)
          .maybeSingle()
      ).then(({ data: prev, error: prevErr }) => {
        if (prevErr) {
          console.error("[generate] previousContentId lookup failed", { message: prevErr.message, code: prevErr.code });
        }
        return prev?.version ? (prev.version as number) + 1 : 1;
      })
    : Promise.resolve(1);

  const twoPass = isTwoPassEnabled();
  const maxOutputTokens = maxTokensForPlatform(platform);
  let llmPass1Ms = 0;
  let llmRefineMs = 0;

  // ---- LLM: generation pass ----
  let raw: string;
  const tPass1Start = Date.now();
  try {
    const p = buildGeneratePrompt({
      inputText,
      platform,
      tone,
      templateName: template?.name,
      templateStructure: template?.structure_text,
      twoPass,
    });
    raw = cleanModelOutput(await generateText({ ...p, maxOutputTokens }));
    llmPass1Ms = Date.now() - tPass1Start;
  } catch (err) {
    llmPass1Ms = Date.now() - tPass1Start;
    // Delete the content_requests row just inserted so failed attempts do not count toward the 20/hour limit.
    if (request?.id) {
      const { error: delErr } = await supabase
        .from("content_requests")
        .delete()
        .eq("id", request.id)
        .eq("user_id", user.id);
      if (delErr) {
        console.error("[generate] content_requests rollback failed", { message: delErr.message, code: delErr.code });
      }
    }
    console.log("[generate] timing (ms)", {
      platform,
      twoPass,
      auth: authMs,
      rateLimit: rateLimitMs,
      templateLookup: templateLookupMs,
      requestInsert: requestInsertMs,
      llmPass1: llmPass1Ms,
      llmRefine: 0,
      contentInsert: 0,
      total: Date.now() - startedAt,
    });
    const e = err instanceof LlmError ? err : new LlmError("Content generation failed.");
    return jsonError(e.message, llmHttpStatus(e));
  }

  // ---- LLM: refinement pass (only when LLM_TWO_PASS=true and LLM_REFINE_ENABLED!=false) ----
  let refined = raw;
  let refineWarning: string | null = null;

  if (twoPass) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 40_000) {
      refineWarning = "The refinement step was unavailable (generation took over 40s), so you're seeing the first draft.";
    } else {
      const tRefineStart = Date.now();
      try {
        const refinePrompt = buildRefinePrompt({ text: raw, platform, tone });
        refined = cleanModelOutput(await generateText({ ...refinePrompt, maxOutputTokens }));
      } catch (err) {
        console.error("[generate] refinement pass failed", err instanceof Error ? err.message : String(err));
        refineWarning = "The refinement step was unavailable, so you're seeing the first draft.";
      } finally {
        llmRefineMs = Date.now() - tRefineStart;
      }
    }
  }

  if (platform === "X_TWITTER") {
    raw = enforceXLimits(raw);
    refined = twoPass ? enforceXLimits(refined) : raw;
  }

  // If content_requests failed to save earlier, return generated text with database warning.
  if (reqErr || !request?.id) {
    console.log("[generate] timing (ms)", {
      platform,
      twoPass,
      auth: authMs,
      rateLimit: rateLimitMs,
      templateLookup: templateLookupMs,
      requestInsert: requestInsertMs,
      llmPass1: llmPass1Ms,
      llmRefine: llmRefineMs,
      contentInsert: 0,
      total: Date.now() - startedAt,
    });
    return NextResponse.json({
      content: null,
      text: refined,
      warning: "Generated, but not saved (database problem)",
    });
  }

  const version = await prevVersionPromise;

  const tContentInsertStart = Date.now();
  const { data: content, error: contentErr } = await supabase
    .from("generated_content")
    .insert({
      user_id: user.id,
      request_id: request.id,
      raw_body: raw,
      refined_body: refined,
      platform,
      tone,
      version,
    })
    .select("id, refined_body, raw_body, platform, tone, version, created_at")
    .single();
  const contentInsertMs = Date.now() - tContentInsertStart;

  console.log("[generate] timing (ms)", {
    platform,
    twoPass,
    auth: authMs,
    rateLimit: rateLimitMs,
    templateLookup: templateLookupMs,
    requestInsert: requestInsertMs,
    llmPass1: llmPass1Ms,
    llmRefine: llmRefineMs,
    contentInsert: contentInsertMs,
    total: Date.now() - startedAt,
  });

  if (contentErr || !content) {
    if (contentErr) {
      console.error("[generate] generated_content insert failed", {
        message: contentErr.message,
        code: contentErr.code,
      });
    }
    // Still return the text so the user doesn't lose it (NFR-13).
    return NextResponse.json({
      content: null,
      text: refined,
      warning: "Generated, but not saved (database problem)",
    });
  }

  return NextResponse.json({ content, text: refined, warning: refineWarning });
}
