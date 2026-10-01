import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { normalizeColor } from "../src/shared/color.ts";
import { svgColors } from "../src/shared/svg-color.ts";
import { run, workspace } from "./helpers.ts";

test("SVG color declarations are found in attributes, styles and style blocks", () => {
  const svg = `<svg viewBox="0 0 10 10"><style>.a{fill:#FF4F1F}</style><path fill='#111' stroke="none" style="stop-color: rgb(250, 250, 247); opacity:.5"/><stop stop-color="url(#g)"/></svg>`;
  assert.deepEqual(svgColors(svg).map(normalizeColor), ["#111111", null, null, "#FF4F1F", "#FAFAF7"]);
  assert.equal(normalizeColor("#FF4F1F80"), "#FF4F1F", "alpha on a brand color is allowed");
  assert.equal(normalizeColor("white"), "#FFFFFF");
  assert.equal(normalizeColor("hsl(10 50% 50%)"), undefined, "cannot be checked");
});

test("check flags SVG assets whose colors are not in the brand", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const assets = join(dir, "design/d/assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, "on-brand.svg"), `<svg viewBox="0 0 10 10"><path fill="#ff4f1f"/><path fill="rgba(17,17,19,0.4)"/></svg>`);
  writeFileSync(join(assets, "off-brand.svg"), `<svg viewBox="0 0 10 10"><path fill="#FF5020"/><path stroke="#62626A"/></svg>`);

  const issues = (JSON.parse(run(dir, "check", "d", "--json").stdout).issues as { file: string; rule: string; message: string }[]).filter((i) => i.rule === "svg-colors");
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0]!.file, "design/d/assets/off-brand.svg");
  assert.match(issues[0]!.message, /#FF5020 \(nearest brand color: accent #FF4F1F\)/);
});
