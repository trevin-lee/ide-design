// Logo parts drawn in several of the brand's colors, recolored per colorway.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, workspace } from "./helpers.ts";

const TWO_COLOR_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="28" fill="#111113"/><circle cx="70" cy="30" r="16" fill="#ff4f1f"/></svg>`;

function brand(mark: string, colorways: { primary: string; reversed: string }, svg = TWO_COLOR_MARK) {
  const dir = workspace("--bare");
  writeFileSync(join(dir, "design/brand/assets/mark.svg"), svg);
  const file = join(dir, "design/brand/brand.ts");
  writeFileSync(
    file,
    readFileSync(file, "utf8")
      .replace('mark: "mark.svg",', `mark: ${mark},`)
      .replace('primary: { mark: "accent", wordmark: "ink" },', `primary: { mark: ${colorways.primary}, wordmark: "ink" },`)
      .replace('reversed: { mark: "accent", wordmark: "paper" },', `reversed: { mark: ${colorways.reversed}, wordmark: "paper" },`),
  );
  return dir;
}

const brandErrors = (dir: string) =>
  (JSON.parse(run(dir, "check", "brand", "--json", "--no-layout").stdout) as { issues: { rule: string; severity: string; message: string }[] }).issues
    .filter((i) => i.severity === "error")
    .map((i) => i.message);

test("a mark drawn in two brand colors is recolored per colorway", { timeout: 120_000 }, () => {
  const dir = brand('{ file: "mark.svg", colors: ["ink", "accent"] }', { primary: '["ink", "accent"]', reversed: '["paper", "accent"]' });
  assert.deepEqual(brandErrors(dir), []);
  assert.equal(run(dir, "export", "brand", "--out", "out").status, 0);
  const kit = join(dir, "out", readdirSync(join(dir, "out"))[0]!, "logos/mark");
  const fills = (colorway: string) => [...readFileSync(join(kit, `mark-${colorway}.svg`), "utf8").matchAll(/<(rect|circle)[^>]*fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => `${m[1]} ${m[2]!.toUpperCase()}`);
  assert.deepEqual(fills("primary"), ["rect #111113", "circle #FF4F1F"]);
  assert.deepEqual(fills("reversed"), ["rect #FAFAF7", "circle #FF4F1F"], "the body turns paper, the dot stays accent");
  assert.deepEqual(fills("black"), ["rect #111113", "circle #111113"], "one token paints every color");
});

test("a multi-color part uses exactly its colors, and colorways match it", { timeout: 120_000 }, () => {
  const stray = brand('{ file: "mark.svg", colors: ["ink", "accent"] }', { primary: '["ink", "accent"]', reversed: '["paper", "accent"]' }, TWO_COLOR_MARK.replace("#ff4f1f", "#00ff00"));
  const strayErrors = brandErrors(stray).join("\n");
  assert.match(strayErrors, /uses colors that are not its declared colors \(#00ff00\)/);
  assert.match(strayErrors, /never uses #FF4F1F/);

  const counts = brand('{ file: "mark.svg", colors: ["ink", "accent"] }', { primary: '["ink", "accent", "paper"]', reversed: '"paper"' });
  assert.match(brandErrors(counts).join("\n"), /The mark is drawn in 2 colors: give 2 tokens/);

  const single = brand('"mark.svg"', { primary: '["ink", "accent"]', reversed: '"paper"' }, TWO_COLOR_MARK.replace(/fill="[^"]+"/g, 'fill="currentColor"'));
  assert.match(brandErrors(single).join("\n"), /The mark is drawn in one color: give one token, not a list/);
});
