import type { Platform, Tone } from "@/lib/types";

/**
 * Prompt builders for generation and refinement.
 * Platform and tone rules are kept here so they are easy to audit and tune.
 */

export const TONE_RULES: Record<Tone, string> = {
  PROFESSIONAL: "Polished and credible. Confident, precise wording; no slang; respectful of the reader's time.",
  CASUAL: "Conversational and relaxed, like talking to a colleague over coffee. Contractions are welcome.",
  INFORMATIVE: "Clear and factual. Explain concepts plainly, prefer concrete specifics over hype.",
  FRIENDLY: "Warm and approachable. Encouraging, inclusive language that invites the reader in.",
};

export const PLATFORM_RULES: Record<Platform, string> = {
  LINKEDIN: [
    "Platform: LinkedIn post.",
    "- Open with a strong first-line hook that makes people click 'see more'.",
    "- Use short paragraphs (1–3 sentences) separated by blank lines.",
    "- Aim for roughly 1,000–1,300 characters in total.",
    "- Optionally end with 3–5 relevant hashtags on the final line.",
    "- Plain text only: no markdown headings, no bold syntax.",
  ].join("\n"),
  X_TWITTER: [
    "Platform: X (Twitter).",
    "- A single post must be at most 280 characters, including spaces and hashtags.",
    "- If the idea genuinely needs more room, write a thread: numbered posts like '1/4', '2/4', …",
    "  each post at most 280 characters, separated by a line containing only three dashes: ---",
    "- Keep each post punchy and self-contained. At most 2 hashtags overall.",
    "- Plain text only: no markdown.",
  ].join("\n"),
  BLOG: [
    "Platform: Blog article in Markdown.",
    "- Start with a '# ' title line.",
    "- Then a short introduction paragraph.",
    "- Then 3–5 sections, each with a '## ' heading.",
    "- End with a '## Conclusion' section.",
    "- Aim for 600–900 words. Use lists only where they help readability.",
    "- Do not include raw HTML.",
  ].join("\n"),
};

const REFINEMENT_RULES = [
  "- Vary sentence length and structure; mix short and longer sentences.",
  "- Remove repetitive phrasing, clichés, filler words and empty buzzwords.",
  "- Keep the author's meaning, facts, claims, names and numbers exactly as given.",
  "- Do not add new facts, statistics, quotes or links.",
];

const SHARED_SYSTEM = [
  "You are an expert social media and content writer working inside an app called Social Working Manager.",
  "You write content the user will review and edit before publishing.",
  "Never invent facts, statistics, names, quotes, links or results that are not in the user's input.",
  "If details are missing, write around them naturally instead of fabricating them.",
  "Return ONLY the final content — no preamble, no explanations, no surrounding quotes or code fences.",
].join("\n");

const SINGLE_PASS_SYSTEM = [
  "You are an expert social media and content writer and meticulous editor working inside an app called Social Working Manager.",
  "You write polished, publication-ready content the user will review and edit before publishing.",
  "Editorial & factual rules:",
  ...REFINEMENT_RULES,
  "- Never invent facts, statistics, names, quotes, links or results that are not in the user's input.",
  "- If details are missing, write around them naturally instead of fabricating them.",
  "Return ONLY the final content — no preamble, no explanations, no surrounding quotes or code fences.",
].join("\n");

/**
 * Whether automatic two-pass generation + refinement is enabled.
 * Controlled by LLM_TWO_PASS (default false). Also honors legacy LLM_REFINE_ENABLED=false.
 */
export function isTwoPassEnabled(): boolean {
  const twoPass = (process.env.LLM_TWO_PASS ?? "false").split("#")[0].trim().toLowerCase() === "true";
  const refineEnabled = (process.env.LLM_REFINE_ENABLED ?? "true").split("#")[0].trim().toLowerCase() !== "false";
  return twoPass && refineEnabled;
}

export function buildGeneratePrompt(opts: {
  inputText: string;
  platform: Platform;
  tone: Tone;
  templateName?: string | null;
  templateStructure?: string | null;
  twoPass?: boolean;
}): { system: string; prompt: string } {
  const useTwoPass = opts.twoPass ?? isTwoPassEnabled();
  const parts = [
    PLATFORM_RULES[opts.platform],
    "",
    `Tone: ${opts.tone.toLowerCase()} — ${TONE_RULES[opts.tone]}`,
  ];
  if (opts.templateStructure) {
    parts.push(
      "",
      `The user started from the template "${opts.templateName ?? "Template"}" with this structure:`,
      '"""',
      opts.templateStructure,
      '"""',
      "Follow the template's flow, using the user's filled-in details. Ignore any placeholders still in {braces}."
    );
  }
  parts.push(
    "",
    "User input (topic, idea, keywords or existing text to rewrite):",
    '"""',
    opts.inputText,
    '"""',
    "",
    "Write the content now."
  );
  return { system: useTwoPass ? SHARED_SYSTEM : SINGLE_PASS_SYSTEM, prompt: parts.join("\n") };
}

/**
 * Refinement pass (FR-16): improves readability and natural flow while
 * preserving meaning. Explicitly forbids inventing facts.
 */
export function buildRefinePrompt(opts: { text: string; platform: Platform; tone: Tone }): {
  system: string;
  prompt: string;
} {
  const system = [
    "You are a meticulous editor. You improve drafts for readability and natural flow.",
    "Rules:",
    "- Vary sentence length and structure; mix short and longer sentences.",
    "- Remove repetitive phrasing, clichés, filler words and empty buzzwords.",
    "- Keep the author's meaning, facts, claims, names and numbers exactly as given.",
    "- Do not add new facts, statistics, quotes or links.",
    "- Keep the same format and platform constraints described below.",
    "Return ONLY the edited content — no commentary, no code fences.",
  ].join("\n");

  const prompt = [
    PLATFORM_RULES[opts.platform],
    "",
    `Tone to preserve: ${opts.tone.toLowerCase()} — ${TONE_RULES[opts.tone]}`,
    "",
    "Draft to refine:",
    '"""',
    opts.text,
    '"""',
  ].join("\n");

  return { system, prompt };
}

/** Strip reasoning <think> blocks and accidental code fences / wrapping quotes from model output. */
export function cleanModelOutput(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) t = fence[1].trim();
  if ((t.startsWith('"""') && t.endsWith('"""')) || (t.startsWith('"') && t.endsWith('"') && !t.slice(1, -1).includes('"'))) {
    t = t.replace(/^"+|"+$/g, "").trim();
  }
  return t;
}
