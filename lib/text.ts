import { X_MAX_CHARS, X_POST_SEPARATOR, type Platform } from "@/lib/types";

/** Word count used by the editor. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Character count as X counts it (approximately): code points rather than
 * UTF-16 units, so emoji count as one.
 */
export function countChars(text: string): number {
  return Array.from(text).length;
}

/** Split an editor body into X posts on separator lines (`---`). */
export function splitXPosts(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*---\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function joinXPosts(posts: string[]): string {
  return posts.join(X_POST_SEPARATOR);
}

function splitLongPost(post: string, limit: number): string[] {
  const chunks: string[] = [];
  const sentences = post.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [post];
  let current = "";

  for (const s of sentences) {
    if (countChars(current + s) <= limit) {
      current += s;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    current = "";
    if (countChars(s) <= limit) {
      current = s;
    } else {
      // Very long sentence: split on words, and hard-slice any single token > limit.
      for (const word of s.split(/(\s+)/)) {
        if (countChars(word) > limit) {
          if (current.trim()) {
            chunks.push(current.trim());
            current = "";
          }
          const chars = Array.from(word.trim());
          for (let i = 0; i < chars.length; i += limit) {
            chunks.push(chars.slice(i, i + limit).join(""));
          }
        } else if (countChars(current + word) > limit) {
          if (current.trim()) chunks.push(current.trim());
          current = word.trimStart();
        } else {
          current += word;
        }
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Guarantees every X post is <= 280 chars.
 * - If every post is already <= 280 chars (using countChars), keeps each post as is
 *   (reserving the 8-char numbering space only when a split is actually needed).
 * - If any post exceeds 280 chars, splits long posts on sentence/word boundaries
 *   with 8 chars reserved for "1/n " numbering and numbers the resulting thread.
 */
export function enforceXLimits(body: string): string {
  const rawPosts = splitXPosts(body);
  if (rawPosts.length === 0) return "";

  const needsSplit = rawPosts.some((p) => countChars(p) > X_MAX_CHARS);

  if (!needsSplit) {
    if (rawPosts.length === 1) {
      return rawPosts[0];
    }
    // Multiple posts, all <= 280 chars. Keep pre-numbered posts as is;
    // only add numbering if unnumbered and numbering still fits within 280 chars.
    const allNumbered = rawPosts.every((p) => /^\s*\d+\s*\/\s*\d+\b/.test(p));
    if (allNumbered) {
      return joinXPosts(rawPosts);
    }
    const n = rawPosts.length;
    const numbered = rawPosts.map((p, i) => {
      const stripped = p.replace(/^\s*\d+\s*\/\s*\d+\s*/, "").trim();
      const candidate = `${i + 1}/${n} ${stripped}`;
      return countChars(candidate) <= X_MAX_CHARS ? candidate : p;
    });
    return joinXPosts(numbered);
  }

  // At least one post exceeds 280 chars: reserve 8 chars for numbering when splitting.
  const reserve = 8;
  const splitLimit = X_MAX_CHARS - reserve;
  const chunks: string[] = [];

  for (const post of rawPosts) {
    const stripped = post.replace(/^\s*\d+\s*\/\s*\d+\s*/, "").trim();
    if (countChars(stripped) <= splitLimit) {
      chunks.push(stripped);
    } else {
      chunks.push(...splitLongPost(stripped, splitLimit));
    }
  }

  if (chunks.length <= 1) return chunks[0] ?? "";
  const n = chunks.length;
  return joinXPosts(chunks.map((c, i) => `${i + 1}/${n} ${c}`));
}

/** Suggest a draft title from the body's first meaningful line. */
export function suggestTitle(body: string, platform?: Platform): string {
  const firstLine =
    body
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").replace(/^\d+\/\d+\s*/, "").trim())
      .find((l) => l.length > 0 && l !== "---") ?? "";
  const clean = firstLine.replace(/[*_`>]/g, "");
  const base = clean.length > 80 ? clean.slice(0, 77).trimEnd() + "…" : clean;
  return base || `Untitled ${platform ? platform.toLowerCase() : ""} draft`.replace(/\s+/g, " ").trim();
}
