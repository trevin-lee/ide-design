import assert from "node:assert/strict";
import { test } from "node:test";
import { snapLineHeight, svgProblems, validateBrand, type BrandInput } from "../src/shared/brand-schema.ts";
import { contrast } from "../src/shared/color.ts";
import { layoutLogo, parseSvg, renderLogoSvg } from "../src/shared/lockup.ts";
import { markSvg, wordmarkSvg } from "../src/core/wordmark.ts";

const brand: BrandInput = {
  name: "Test",
  unit: 4,
  color: {
    paper: { value: "#FFFFFF", on: "ink", logo: "primary" },
    ink: { value: "#111111", on: "paper", logo: "reversed" },
    muted: "#666666",
  },
  space: { s: 8, m: 16, l: 24 },
  radius: { s: 4, m: 8 },
  stroke: { hairline: 1 },
  font: { sans: { family: "Inter", fallback: "sans-serif" } },
  type: { title: { font: "sans", size: 64, weight: 700, leading: 1 }, body: { font: "sans", size: 24, weight: 400, leading: 1.5 } },
  margin: { deck: "l", doc: "l", graphic: "m", web: "m" },
  logo: {
    mark: "mark.svg",
    wordmark: "wordmark.svg",
    lockups: { horizontal: { direction: "row", mark: 2, gap: 1 } },
    colorways: { primary: { mark: "ink", wordmark: "ink" }, reversed: { mark: "paper", wordmark: "paper" } },
    sizes: { s: 32, m: 64 },
  },
};
const svgs = { "mark.svg": markSvg(), "wordmark.svg": wordmarkSvg("Test") };

test("a coherent brand validates clean", () => {
  assert.deepEqual(validateBrand(brand, svgs), []);
});

test("off-grid, dangling and illegible tokens are rejected", () => {
  const bad: BrandInput = {
    ...brand,
    color: { ...brand.color, paper: { value: "#FFFFFF", on: "ghost" }, pale: { value: "#FFFFFF", on: "faint" }, faint: "#CCCCCC" },
    space: { s: 8, m: 18, l: 12 },
    margin: { ...brand.margin, deck: "huge" },
  };
  const messages = validateBrand(bad, svgs).map((i) => `${i.path}: ${i.message}`);
  assert.ok(messages.some((m) => m.startsWith("space.m") && m.includes("off the 4px grid")));
  assert.ok(messages.some((m) => m.startsWith("space.l") && m.includes("smallest to largest")));
  assert.ok(messages.some((m) => m.startsWith("color.paper.on") && m.includes("not a color token")));
  assert.ok(messages.some((m) => m.startsWith("color.pale.on") && m.includes("contrast")));
  assert.ok(messages.some((m) => m.startsWith("margin.deck")));
});

test("reserved token names are rejected", () => {
  const issues = validateBrand({ ...brand, space: { none: 0, m: 16 } }, svgs);
  assert.ok(issues.some((i) => i.path === "space.none" && i.message.includes("reserved")));
});

test("line heights snap to the unit grid", () => {
  assert.equal(snapLineHeight(28, 1.45, 4), 40);
  assert.equal(snapLineHeight(160, 0.95, 4), 152);
  assert.equal(snapLineHeight(10, 0.1, 4), 4);
});

test("WCAG contrast matches known values", () => {
  assert.equal(Math.round(contrast("#000000", "#FFFFFF")), 21);
  assert.equal(contrast("#777777", "#777777"), 1);
});

test("generated logos satisfy the logo rules", () => {
  assert.deepEqual(svgProblems(markSvg()), []);
  assert.deepEqual(svgProblems(wordmarkSvg("Northwind 2026")), []);
});

test("fixed-color and text-based logos are flagged", () => {
  const problems = svgProblems('<svg viewBox="0 0 10 10"><path fill="#ff0000" d="M0 0h10v10z"/><text>Hi</text></svg>');
  assert.ok(problems.some((p) => p.includes("fixed colors")));
  assert.ok(problems.some((p) => p.includes("<text>")));
});

test("lockup geometry is relative to the wordmark height", () => {
  const mark = parseSvg('<svg viewBox="0 0 100 100"></svg>');
  const word = parseSvg('<svg viewBox="0 0 400 100"></svg>');
  const row = layoutLogo("horizontal", mark, word, { horizontal: { direction: "row", mark: 2, gap: 1 } }, { mark: "#000", wordmark: "#111" });
  assert.equal(row.height, 2);
  assert.equal(row.width, 2 + 1 + 4);
  assert.equal(row.parts[1]!.y, 0.5); // wordmark centered on the mark
  const stacked = layoutLogo("stacked", mark, word, { stacked: { direction: "column", mark: 2, gap: 0.5 } }, { mark: "#000", wordmark: "#111" });
  assert.equal(stacked.height, 3.5);
  assert.equal(stacked.parts[0]!.x, 1); // mark centered over the wider wordmark
  const svg = renderLogoSvg(row, 64);
  assert.match(svg, /height="64"/);
  assert.match(svg, /fill="#111"/);
});

test("logo titles escape markup characters instead of dropping them", () => {
  const mark = parseSvg('<svg viewBox="0 0 10 10"></svg>');
  const svg = renderLogoSvg(layoutLogo("mark", mark, mark, {}, { mark: "#000", wordmark: "#000" }), 32, { title: "Kiln & Copper <Studio>" });
  assert.match(svg, /<title>Kiln &amp; Copper &lt;Studio&gt;<\/title>/);
});
