#!/usr/bin/env node
/**
 * Unit tests for enforceXLimits, splitXPosts, and countChars in lib/text.ts.
 * Covers:
 *   1. 100-char post (kept as is, 1 post)
 *   2. 280-char post (kept as is, 1 post, NOT split due to numbering reserve)
 *   3. 281-char post (split into 2 numbered posts, each <= 280 chars)
 *   4. 600-char single block (split into numbered posts, each <= 280 chars)
 *   5. Pre-numbered thread (kept intact without double numbering or splitting <=280 posts)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.resolve(process.cwd(), relPath);
  const src = fs.readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const mod = { exports: {} };
  const req = (id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected import: ${id}`);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) { ${outputText} })`);
  fn(mod.exports, req, mod);
  return mod.exports;
}

const typesMod = loadTsModule("src/lib/types.ts");
const { countChars, splitXPosts, enforceXLimits } = loadTsModule("src/lib/text.ts", {
  "@/lib/types": typesMod,
});

// 1. 100-char post
const post100 = "a".repeat(100);
const out100 = enforceXLimits(post100);
assert.equal(out100, post100, "100-char post should remain unchanged");
assert.equal(splitXPosts(out100).length, 1);
assert.equal(countChars(out100), 100);
console.log("PASS: 100-char post kept as is (100 chars, 1 post)");

// 2. 280-char post (boundary test: must NOT be split)
const post280 = "b".repeat(280);
const out280 = enforceXLimits(post280);
assert.equal(out280, post280, "280-char post should remain a single unchanged post");
assert.equal(splitXPosts(out280).length, 1);
assert.equal(countChars(out280), 280);
console.log("PASS: 280-char post kept as is (280 chars, 1 post)");

// 3. 281-char post (must split and number, each <= 280 chars)
const post281 = `${"word ".repeat(55)}abcdef`; // 55*5 + 6 = 281 chars
assert.equal(countChars(post281), 281);
const out281 = enforceXLimits(post281);
const parts281 = splitXPosts(out281);
assert.ok(parts281.length >= 2, "281-char post must be split into at least 2 posts");
parts281.forEach((p, idx) => {
  assert.ok(countChars(p) <= 280, `Split part ${idx + 1} exceeds 280 chars (${countChars(p)})`);
  assert.ok(p.startsWith(`${idx + 1}/${parts281.length} `), `Split part ${idx + 1} missing numbering`);
});
console.log(`PASS: 281-char post split into ${parts281.length} numbered posts (lengths: ${parts281.map(countChars).join(", ")})`);

// 4. 600-char single block
const block600 = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} explains a key product insight in roughly fifty characters.`).join(" ").slice(0, 600);
assert.equal(countChars(block600), 600);
const out600 = enforceXLimits(block600);
const parts600 = splitXPosts(out600);
assert.ok(parts600.length >= 3, "600-char block must be split into at least 3 posts");
parts600.forEach((p, idx) => {
  assert.ok(countChars(p) <= 280, `600-char part ${idx + 1} exceeds 280 chars (${countChars(p)})`);
  assert.ok(p.startsWith(`${idx + 1}/${parts600.length} `), `600-char part ${idx + 1} missing numbering`);
});
console.log(`PASS: 600-char single block split into ${parts600.length} numbered posts (lengths: ${parts600.map(countChars).join(", ")})`);

// 5. Pre-numbered thread (including a 280-char numbered post)
const threadPost2 = `2/3 ${"x".repeat(276)}`; // 280 chars total
const preNumbered = [
  "1/3 Launching our new feature today after two weeks of user testing.",
  threadPost2,
  "3/3 Try it out and let us know what you think!",
].join("\n\n---\n\n");
const outThread = enforceXLimits(preNumbered);
const partsThread = splitXPosts(outThread);
assert.equal(partsThread.length, 3, "Pre-numbered 3-post thread should stay 3 posts");
assert.equal(partsThread[0], "1/3 Launching our new feature today after two weeks of user testing.");
assert.equal(partsThread[1], threadPost2);
assert.equal(partsThread[2], "3/3 Try it out and let us know what you think!");
console.log("PASS: Pre-numbered thread preserved intact (including 280-char post)");
