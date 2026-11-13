#!/usr/bin/env node
/**
 * Checks WCAG 2.1 contrast ratios for all black-theme token pairs in app/globals.css.
 * Fails (exit 1) if any normal-text pair falls below 4.5:1.
 */
import fs from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "app", "globals.css");
const css = fs.readFileSync(cssPath, "utf8");

function readVar(name) {
  const re = new RegExp(`--${name}:\\s*([^;]+);`);
  const m = css.match(re);
  if (!m) throw new Error(`Missing CSS token --${name} in app/globals.css`);
  return m[1].trim();
}

function parseColor(raw) {
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(raw);
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] !== undefined ? Number(rgba[4]) : 1];
  }
  throw new Error(`Unsupported color format: ${raw}`);
}

function compositeOver(fg, bg) {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

function luminance([r, g, b]) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const bg = parseColor(readVar("background"));
const surface1 = parseColor(readVar("surface-1"));
const surface2 = parseColor(readVar("surface-2"));
const text = parseColor(readVar("text"));
const muted = parseColor(readVar("muted"));
const yellow = parseColor(readVar("yellow"));
const yellowHover = parseColor(readVar("yellow-hover"));
const yellowDimOverBg = compositeOver(parseColor(readVar("yellow-dim")), bg);
const yellowDimOverS1 = compositeOver(parseColor(readVar("yellow-dim")), surface1);
const blue = parseColor(readVar("blue"));
const blueDimOverBg = compositeOver(parseColor(readVar("blue-dim")), bg);
const blueDimOverS1 = compositeOver(parseColor(readVar("blue-dim")), surface1);
const success = parseColor(readVar("success"));
const danger = parseColor(readVar("danger"));

const pairs = [
  ["white on black", text, bg],
  ["white on surface-1", text, surface1],
  ["white on surface-2", text, surface2],
  ["muted on black", muted, bg],
  ["muted on surface-1", muted, surface1],
  ["muted on surface-2", muted, surface2],
  ["yellow on black", yellow, bg],
  ["yellow on surface-1", yellow, surface1],
  ["yellow on yellow-dim (over black)", yellow, yellowDimOverBg],
  ["yellow on yellow-dim (over surface-1)", yellow, yellowDimOverS1],
  ["black on yellow (primary button)", bg, yellow],
  ["black on yellow-hover (primary button hover)", bg, yellowHover],
  ["blue on black", blue, bg],
  ["blue on surface-1", blue, surface1],
  ["blue on blue-dim (over black)", blue, blueDimOverBg],
  ["blue on blue-dim (over surface-1)", blue, blueDimOverS1],
  ["success on surface-1", success, surface1],
  ["danger on surface-1", danger, surface1],
  ["black on danger (danger button)", bg, danger],
];

let failed = 0;
for (const [label, fg, bgCol] of pairs) {
  const ratio = contrastRatio(fg, bgCol);
  const pass = ratio >= 4.5;
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}: ${label.padEnd(42)} ${ratio.toFixed(2)}:1`);
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below WCAG AA 4.5:1.`);
  process.exit(1);
}
console.log(`\nAll ${pairs.length} pairs meet WCAG AA (>= 4.5:1).`);
