import { requireUser } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { LlmError, generateText, llmHttpStatus, maxTokensForPlatform, streamText } from "@/lib/llm";
import { buildGeneratePrompt, buildRefinePrompt, cleanModelOutput, isTwoPassEnabled } from "@/lib/prompts";
import { GENERATE_LIMIT_PER_HOUR, checkGenerateRateLimit } from "@/lib/rate-limit";
import { enforceXLimits } from "@/lib/text";
import { generateSchema } from "@/lib/validators";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Separates streamed text from the final JSON event (kept in sync with create-workspace.tsx). */
const STREAM_META_MARKER = "\n__SWM_DONE__:";

const bodySchema = generateSchema.extend({
  previousContentId: z.string().uuid().nullable().optional(),
});

interface StreamFinalEvent {
  contentId: string | null;
  version: number;
  warning: string | null;
  text?: string;
  error?: string;
}

/**
 * POST /api/generate/stream
 * Streams generated text chunks as they arrive, then writes a final line containing
 * JSON { contentId, version, warning, text } after saving to the DB.
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
          console.error("[generate/stream] template lookup failed", { message: tplErr.message, code: tplErr.code });
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
    console.error("[generate/stream] content_requests insert failed", { message: reqErr.message, code: reqErr.code });
  }

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
          console.error("[generate/stream] previousContentId lookup failed", {
            message: prevErr.message,
            code: prevErr.code,
          });
        }
        return prev?.version ? (prev.version as number) + 1 : 1;
      })
    : Promise.resolve(1);

  const twoPass = isTwoPassEnabled();
  const maxOutputTokens = maxTokensForPlatform(platform);
  const p = buildGeneratePrompt({
    inputText,
    platform,
    tone,
    templateName: template?.name,
    templateStructure: template?.structure_text,
    twoPass,
  });

  const tPass1Start = Date.now();
  const iterator = streamText({ ...p, maxOutputTokens })[Symbol.asyncIterator]();

  let firstChunk: IteratorResult<string, void>;
  try {
    firstChunk = await iterator.next();
  } catch (err) {
    const llmPass1Ms = Date.now() - tPass1Start;
    if (request?.id) {
      await supabase.from("content_requests").delete().eq("id", request.id).eq("user_id", user.id);
    }
    console.log("[generate/stream] timing (ms)", {
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = "";
      let llmPass1Ms = 0;
      let llmRefineMs = 0;
      let contentInsertMs = 0;

      try {
        if (!firstChunk.done && firstChunk.value) {
          accumulated += firstChunk.value;
          controller.enqueue(encoder.encode(firstChunk.value));
        }

        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          if (next.value) {
            accumulated += next.value;
            controller.enqueue(encoder.encode(next.value));
          }
        }
        llmPass1Ms = Date.now() - tPass1Start;

        let raw = cleanModelOutput(accumulated);
        let refined = raw;
        let warning: string | null = null;

        if (twoPass) {
          const elapsedMs = Date.now() - startedAt;
          if (elapsedMs > 40_000) {
            warning =
              "The refinement step was unavailable (generation took over 40s), so you're seeing the first draft.";
          } else {
            const tRefineStart = Date.now();
            try {
              const refinePrompt = buildRefinePrompt({ text: raw, platform, tone });
              refined = cleanModelOutput(await generateText({ ...refinePrompt, maxOutputTokens }));
            } catch (err) {
              console.error("[generate/stream] refinement pass failed", err instanceof Error ? err.message : String(err));
              warning = "The refinement step was unavailable, so you're seeing the first draft.";
            } finally {
              llmRefineMs = Date.now() - tRefineStart;
            }
          }
        }

        if (platform === "X_TWITTER") {
          raw = enforceXLimits(raw);
          refined = twoPass ? enforceXLimits(refined) : raw;
        }

        const version = await prevVersionPromise;
        let savedContentId: string | null = null;

        if (reqErr || !request?.id) {
          warning = "Generated, but not saved (database problem)";
        } else {
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
            .select("id")
            .single();
          contentInsertMs = Date.now() - tContentInsertStart;

          if (contentErr || !content) {
            if (contentErr) {
              console.error("[generate/stream] generated_content insert failed", {
                message: contentErr.message,
                code: contentErr.code,
              });
            }
            warning = "Generated, but not saved (database problem)";
          } else {
            savedContentId = content.id as string;
          }
        }

        console.log("[generate/stream] timing (ms)", {
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

        const finalEvent: StreamFinalEvent = {
          contentId: savedContentId,
          version,
          warning,
          text: refined,
        };
        controller.enqueue(encoder.encode(`${STREAM_META_MARKER}${JSON.stringify(finalEvent)}\n`));
        controller.close();
      } catch (err) {
        llmPass1Ms = Date.now() - tPass1Start;
        if (!accumulated.trim() && request?.id) {
          await supabase.from("content_requests").delete().eq("id", request.id).eq("user_id", user.id);
        }
        console.log("[generate/stream] timing (ms)", {
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
        const msg = err instanceof Error ? err.message : "Content generation failed.";
        const errEvent: StreamFinalEvent = {
          contentId: null,
          version: 1,
          warning: null,
          error: msg,
        };
        controller.enqueue(encoder.encode(`${STREAM_META_MARKER}${JSON.stringify(errEvent)}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
