#!/usr/bin/env node
/**
 * Benchmark LLM generation latency across thinkingConfig variants.
 * Run with: npm run bench:llm
 *
 * Sends the same realistic LinkedIn prompt and X prompt 3 times per variant
 * to the configured Gemini model and prints the median latency per variant.
 * Only keeps variants the live API accepts (HTTP 200).
 */

const DEFAULT_MODELS = {
  gemini: "gemini-3.5-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

const provider = (process.env.LLM_PROVIDER || "gemini").split("#")[0].trim().toLowerCase();
const model =
  (process.env.LLM_MODEL || "").split("#")[0].trim() ||
  DEFAULT_MODELS[provider] ||
  "gemini-3.5-flash-lite";
const geminiKey = (process.env.GEMINI_API_KEY || "").split("#")[0].trim();

console.log(`Provider       : ${provider}`);
console.log(`Model          : ${model}`);
console.log(`GEMINI_API_KEY : ${geminiKey ? "set" : "missing"}\n`);

if (provider !== "gemini" || !geminiKey) {
  console.error("bench-llm requires LLM_PROVIDER=gemini and GEMINI_API_KEY set in .env.local.");
  process.exit(1);
}

const SYSTEM_PROMPT = [
  "You are an expert social media and content writer working inside an app called Social Working Manager.",
  "You write content the user will review and edit before publishing.",
  "Never invent facts, statistics, names, quotes, links or results that are not in the user's input.",
  "If details are missing, write around them naturally instead of fabricating them.",
  "Vary sentence length and structure; mix short and longer sentences.",
  "Remove repetitive phrasing, clichés, filler words and empty buzzwords.",
  "Keep the author's meaning, facts, claims, names and numbers exactly as given.",
  "Return ONLY the final content — no preamble, no explanations, no surrounding quotes or code fences.",
].join("\n");

const LINKEDIN_PROMPT = [
  "Platform: LinkedIn post.",
  "- Open with a strong first-line hook that makes people click 'see more'.",
  "- Use short paragraphs (1–3 sentences) separated by blank lines.",
  "- Aim for roughly 1,000–1,300 characters in total.",
  "- Optionally end with 3–5 relevant hashtags on the final line.",
  "- Plain text only: no markdown headings, no bold syntax.",
  "",
  "Tone: professional — Polished and credible. Confident, precise wording; no slang; respectful of the reader's time.",
  "",
  "User input (topic, idea, keywords or existing text to rewrite):",
  '"""',
  "We rebuilt our onboarding flow over two weeks by removing the 4th setup step and deferring team invites until after the first project is created. Activation rose from 54% to 71% and support tickets about setup dropped by a third.",
  '"""',
  "",
  "Write the content now.",
].join("\n");

const X_PROMPT = [
  "Platform: X (Twitter).",
  "- A single post must be at most 280 characters, including spaces and hashtags.",
  "- If the idea genuinely needs more room, write a thread: numbered posts like '1/4', '2/4', …",
  "  each post at most 280 characters, separated by a line containing only three dashes: ---",
  "- Keep each post punchy and self-contained. At most 2 hashtags overall.",
  "- Plain text only: no markdown.",
  "",
  "Tone: casual — Conversational and relaxed, like talking to a colleague over coffee. Contractions are welcome.",
  "",
  "User input (topic, idea, keywords or existing text to rewrite):",
  '"""',
  "We rebuilt our onboarding flow over two weeks by removing the 4th setup step and deferring team invites until after the first project is created. Activation rose from 54% to 71% and support tickets about setup dropped by a third.",
  '"""',
  "",
  "Write the content now.",
].join("\n");

const isGemini25 = /gemini-2\.5/i.test(model);

// Variants accepted by the live API (HTTP 200) for the configured model family:
// - Gemini 3+ family accepts thinkingLevel ("MINIMAL", "LOW") and rejects thinkingBudget (HTTP 400).
// - Gemini 2.5 family accepts thinkingBudget (0, 128) and rejects thinkingLevel (HTTP 400).
const VARIANTS = isGemini25
  ? [
      {
        name: "1. current config (no thinkingConfig)",
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
      },
      {
        name: "2. thinkingBudget: 0 (thinking minimized)",
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      {
        name: "3. thinkingBudget: 128 (low thinking budget)",
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 128 },
        },
      },
    ]
  : [
      {
        name: "1. current config (no thinkingConfig)",
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
      },
      {
        name: "2. thinkingLevel: MINIMAL (thinking minimized)",
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      },
      {
        name: "3. thinkingLevel: LOW (low thinking setting)",
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingLevel: "LOW" },
        },
      },
    ];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function callOnce(prompt, generationConfig) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
    const ms = Date.now() - t0;
    const bodyText = await res.text();
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return { ok: false, status: res.status, ms, error: bodyText.slice(0, 200) };
    }
    const data = JSON.parse(bodyText);
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    return { ok: true, status: res.status, ms, chars: text.length };
  }
}

async function main() {
  const results = [];

  for (const variant of VARIANTS) {
    console.log(`Testing variant: ${variant.name}`);
    const xTimes = [];
    let rejected = false;

    for (let i = 1; i <= 3; i++) {
      const r = await callOnce(X_PROMPT, variant.generationConfig);
      if (!r.ok) {
        console.log(`  -> Skipped (HTTP ${r.status}): ${r.error}\n`);
        rejected = true;
        break;
      }
      xTimes.push(r.ms);
      console.log(`  X run ${i}        : ${r.ms}ms (${r.chars} chars)`);
    }
    if (rejected) continue;

    const liTimes = [];
    for (let i = 1; i <= 3; i++) {
      const r = await callOnce(LINKEDIN_PROMPT, variant.generationConfig);
      if (!r.ok) {
        console.log(`  -> Skipped (HTTP ${r.status}): ${r.error}\n`);
        rejected = true;
        break;
      }
      liTimes.push(r.ms);
      console.log(`  LinkedIn run ${i} : ${r.ms}ms (${r.chars} chars)`);
    }
    if (rejected) continue;

    const xMed = median(xTimes);
    const liMed = median(liTimes);
    const combinedMed = Math.round((xMed + liMed) / 2);
    console.log(`  => Median: LinkedIn=${liMed}ms, X=${xMed}ms, Combined=${combinedMed}ms\n`);
    results.push({
      name: variant.name,
      liMed,
      xMed,
      combinedMed,
    });
  }

  console.log("=== SUMMARY (HTTP 200 Variants) ===");
  console.log(
    "Variant".padEnd(50) +
      "LinkedIn Med".padStart(14) +
      "X Med".padStart(10) +
      "Combined Med".padStart(14)
  );
  console.log("-".repeat(88));
  for (const r of results) {
    console.log(
      r.name.padEnd(50) +
        `${r.liMed}ms`.padStart(14) +
        `${r.xMed}ms`.padStart(10) +
        `${r.combinedMed}ms`.padStart(14)
    );
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
