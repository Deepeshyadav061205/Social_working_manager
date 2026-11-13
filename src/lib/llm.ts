import "server-only";
import type { Platform } from "@/lib/types";

/**
 * Provider-agnostic LLM wrapper (server-side only).
 * Provider is chosen by LLM_PROVIDER = gemini | openai | anthropic.
 * Optional LLM_MODEL overrides the default model for that provider.
 *
 * Each call has a 60s timeout and one retry with backoff (NFR-13).
 * All provider calls use REST + JSON / SSE (NFR-16).
 */

export type LlmProvider = "gemini" | "openai" | "anthropic";

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "LlmError";
  }
}

const TIMEOUT_MS = 60_000;
const BACKOFF_MS = 1_200;

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: "gemini-3.5-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

/** Per-platform output token caps (A4), always clamped to LLM_MAX_OUTPUT_TOKENS. */
export const PLATFORM_OUTPUT_TOKENS: Record<Platform, number> = {
  X_TWITTER: 800,
  LINKEDIN: 1500,
  BLOG: 4000,
};

export function getProvider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  if (p === "gemini" || p === "openai" || p === "anthropic") return p;
  throw new LlmError(`Unsupported LLM_PROVIDER "${p}". Use gemini, openai or anthropic.`, 400, false);
}

export function getModel(provider: LlmProvider = getProvider()): string {
  const override = (process.env.LLM_MODEL ?? "").split("#")[0].trim();
  return override || DEFAULT_MODELS[provider];
}

export function getMaxOutputTokens(cap?: number): number {
  const parsed = Number.parseInt(process.env.LLM_MAX_OUTPUT_TOKENS ?? "", 10);
  const envMax = Number.isFinite(parsed) && parsed > 0 ? parsed : 8192;
  return cap && cap > 0 ? Math.min(cap, envMax) : envMax;
}

export function maxTokensForPlatform(platform: Platform): number {
  return getMaxOutputTokens(PLATFORM_OUTPUT_TOKENS[platform]);
}

function requireKey(name: string): string {
  const v = (process.env[name] ?? "").split("#")[0].trim();
  if (!v) throw new LlmError(`The AI service is not configured (missing ${name}).`, 503, false);
  return v;
}

/**
 * Select the low-latency thinkingConfig appropriate for the Gemini model family:
 * - Gemini 3+ family (e.g. gemini-3.5-flash-lite, gemini-3-flash): thinkingLevel ("MINIMAL" for flash/lite, "LOW" for pro)
 * - Gemini 2.5 family (e.g. gemini-2.5-flash): thinkingBudget (0 for flash/lite, 128 for pro)
 * - Older / other models: undefined (no thinkingConfig)
 */
export function getGeminiThinkingConfig(model: string): Record<string, unknown> | undefined {
  if (/gemini-3/i.test(model)) {
    return { thinkingLevel: /pro/i.test(model) ? "LOW" : "MINIMAL" };
  }
  if (/gemini-2\.5/i.test(model)) {
    return { thinkingBudget: /pro/i.test(model) ? 128 : 0 };
  }
  return undefined;
}

function parseProviderHttpError(status: number, text: string): LlmError {
  const retryable = status === 429 || status >= 500;
  let detail = "";
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string };
    detail = typeof j.error === "string" ? j.error : j.error?.message ?? "";
  } catch {
    detail = text.slice(0, 200);
  }

  const isInvalidGeminiKey =
    status === 400 && (text.includes("API_KEY_INVALID") || /api key not valid/i.test(detail));

  const friendly = isInvalidGeminiKey
    ? "Invalid Gemini API key"
    : status === 404
      ? "Model not found, check LLM_MODEL"
      : status === 429
        ? "AI quota or rate limit exceeded (check your Google AI Studio quota). Please try again in a moment."
        : status === 401 || status === 403
          ? "The AI service rejected the API key. Check the server configuration."
          : detail
            ? `The AI service returned an error (${status}): ${detail}`
            : `The AI service returned an error (${status}).`;

  console.error("[llm] provider error", { status, message: detail || text.slice(0, 200) });
  return new LlmError(friendly, status, retryable);
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw parseProviderHttpError(res.status, text);
    }
    return JSON.parse(text) as unknown;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[llm] request timed out after 60s");
      throw new LlmError("The AI service timed out after 60 seconds.", 504, true);
    }
    console.error("[llm] network error", err instanceof Error ? err.message : String(err));
    throw new LlmError("Could not reach the AI service. Check your connection.", 502, true);
  } finally {
    clearTimeout(timer);
  }
}

interface GeminiResponse {
  promptFeedback?: {
    blockReason?: string;
  };
  candidates?: {
    finishReason?: string;
    content?: {
      parts?: { text?: string; thought?: boolean }[];
    };
  }[];
}

function buildGeminiGenerationConfig(model: string, maxOutputTokens?: number, includeThinking = true): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.8,
    maxOutputTokens: getMaxOutputTokens(maxOutputTokens),
  };
  if (includeThinking) {
    const thinkingConfig = getGeminiThinkingConfig(model);
    if (thinkingConfig) {
      generationConfig.thinkingConfig = thinkingConfig;
    }
  }
  return generationConfig;
}

async function callGemini(system: string, prompt: string, model: string, maxOutputTokens?: number): Promise<string> {
  const key = requireKey("GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let data: GeminiResponse;
  const genConfig = buildGeminiGenerationConfig(model, maxOutputTokens, true);
  try {
    data = (await postJson(
      url,
      { "x-goog-api-key": key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: genConfig,
      }
    )) as GeminiResponse;
  } catch (err) {
    // Safe fallback: if the model rejected thinkingConfig with HTTP 400 (and not an invalid key), retry once without it.
    if (
      err instanceof LlmError &&
      err.status === 400 &&
      genConfig.thinkingConfig &&
      !err.message.includes("Invalid Gemini API key")
    ) {
      console.warn("[llm] retrying Gemini generateContent without thinkingConfig after 400");
      data = (await postJson(
        url,
        { "x-goog-api-key": key },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: buildGeminiGenerationConfig(model, maxOutputTokens, false),
        }
      )) as GeminiResponse;
    } else {
      throw err;
    }
  }

  if (data.promptFeedback?.blockReason) {
    console.error("[llm] Gemini promptFeedback blockReason:", data.promptFeedback.blockReason);
    throw new LlmError(`Gemini blocked this request (${data.promptFeedback.blockReason})`, 400, false);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    console.error("[llm] Gemini returned no candidates");
    throw new LlmError("Gemini returned no candidates for this prompt.", 502, true);
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "PROHIBITED_CONTENT" || finishReason === "BLOCKLIST") {
    console.error("[llm] Gemini candidate blocked:", finishReason);
    throw new LlmError(`Gemini blocked this request (${finishReason})`, 400, false);
  }

  if (finishReason === "MAX_TOKENS") {
    console.error("[llm] Gemini candidate hit MAX_TOKENS");
    throw new LlmError("Output was cut off, try shorter input", 422, false);
  }

  const parts = candidate.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (parts.length === 0 || !text) {
    console.error("[llm] Gemini returned empty parts", { finishReason });
    throw new LlmError("Gemini returned an empty response.", 502, true);
  }

  return text;
}

async function openGeminiStreamResponse(
  url: string,
  key: string,
  system: string,
  prompt: string,
  generationConfig: Record<string, unknown>,
  signal: AbortSignal
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
    signal,
    cache: "no-store",
  });
}

async function* streamGemini(
  system: string,
  prompt: string,
  model: string,
  maxOutputTokens?: number
): AsyncGenerator<string, void, unknown> {
  const key = requireKey("GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const genConfig = buildGeminiGenerationConfig(model, maxOutputTokens, true);
    let res = await openGeminiStreamResponse(url, key, system, prompt, genConfig, controller.signal);

    if (!res.ok) {
      const errText = await res.text();
      const parsedErr = parseProviderHttpError(res.status, errText);
      if (
        res.status === 400 &&
        genConfig.thinkingConfig &&
        !parsedErr.message.includes("Invalid Gemini API key")
      ) {
        console.warn("[llm] retrying Gemini streamGenerateContent without thinkingConfig after 400");
        res = await openGeminiStreamResponse(
          url,
          key,
          system,
          prompt,
          buildGeminiGenerationConfig(model, maxOutputTokens, false),
          controller.signal
        );
        if (!res.ok) {
          throw parseProviderHttpError(res.status, await res.text());
        }
      } else {
        throw parsedErr;
      }
    }

    if (!res.body) {
      throw new LlmError("Gemini returned an empty stream body.", 502, true);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let yieldedAny = false;

    const processLine = (rawLine: string): string | null => {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) return null;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") return null;

      let data: GeminiResponse;
      try {
        data = JSON.parse(jsonStr) as GeminiResponse;
      } catch {
        return null;
      }

      if (data.promptFeedback?.blockReason) {
        throw new LlmError(`Gemini blocked this request (${data.promptFeedback.blockReason})`, 400, false);
      }

      const candidate = data.candidates?.[0];
      if (!candidate) return null;

      const finishReason = candidate.finishReason;
      if (
        finishReason === "SAFETY" ||
        finishReason === "RECITATION" ||
        finishReason === "PROHIBITED_CONTENT" ||
        finishReason === "BLOCKLIST"
      ) {
        throw new LlmError(`Gemini blocked this request (${finishReason})`, 400, false);
      }

      const parts = candidate.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("");

      return text || null;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = processLine(line);
        if (chunk) {
          yieldedAny = true;
          yield chunk;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const chunk = processLine(line);
        if (chunk) {
          yieldedAny = true;
          yield chunk;
        }
      }
    }

    if (!yieldedAny) {
      throw new LlmError("Gemini returned an empty response.", 502, true);
    }
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[llm] stream timed out after 60s");
      throw new LlmError("The AI service timed out after 60 seconds.", 504, true);
    }
    console.error("[llm] stream network error", err instanceof Error ? err.message : String(err));
    throw new LlmError("Could not reach the AI service. Check your connection.", 502, true);
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(system: string, prompt: string, model: string, maxOutputTokens?: number): Promise<string> {
  const key = requireKey("OPENAI_API_KEY");
  const url = `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const data = (await postJson(
    url,
    { Authorization: `Bearer ${key}` },
    {
      model,
      max_tokens: getMaxOutputTokens(maxOutputTokens),
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }
  )) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(system: string, prompt: string, model: string, maxOutputTokens?: number): Promise<string> {
  const key = requireKey("ANTHROPIC_API_KEY");
  const data = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    {
      model,
      max_tokens: getMaxOutputTokens(maxOutputTokens),
      temperature: 0.8,
      system,
      messages: [{ role: "user", content: prompt }],
    }
  )) as { content?: { type: string; text?: string }[] };
  return data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
}

/** Map an LlmError to the HTTP status our API should return to the browser. */
export function llmHttpStatus(e: LlmError): number {
  if (
    e.status === 400 ||
    e.status === 401 ||
    e.status === 403 ||
    e.status === 404 ||
    e.status === 422 ||
    e.status === 429 ||
    e.status === 503 ||
    e.status === 504
  ) {
    return e.status;
  }
  return 502;
}

/** Generate text with the configured provider. Retries once on transient failure. */
export async function generateText({
  system,
  prompt,
  maxOutputTokens,
}: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const provider = getProvider();
  const model = getModel(provider);
  const call = () =>
    provider === "gemini"
      ? callGemini(system, prompt, model, maxOutputTokens)
      : provider === "openai"
        ? callOpenAI(system, prompt, model, maxOutputTokens)
        : callAnthropic(system, prompt, model, maxOutputTokens);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = (await call()).trim();
      if (!out) throw new LlmError("The AI service returned an empty response.", 502, true);
      return out;
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof LlmError ? err.retryable : false;
      if (!retryable || attempt === 1) break;
      await new Promise((r) => setTimeout(r, BACKOFF_MS));
    }
  }
  if (lastErr instanceof LlmError) throw lastErr;
  throw new LlmError("Unexpected AI service error.", 500);
}

/**
 * Stream text chunks from the configured provider.
 * Uses Gemini REST streamGenerateContent?alt=sse for gemini; falls back to a
 * single chunk from generateText for other providers.
 */
export async function* streamText({
  system,
  prompt,
  maxOutputTokens,
}: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): AsyncGenerator<string, void, unknown> {
  const provider = getProvider();
  if (provider !== "gemini") {
    const full = await generateText({ system, prompt, maxOutputTokens });
    yield full;
    return;
  }
  const model = getModel(provider);
  yield* streamGemini(system, prompt, model, maxOutputTokens);
}
