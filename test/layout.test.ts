// The layout check: frames measured in the pinned Chromium. Skips without a browser.
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { findBrowser, run, workspace } from "./helpers.ts";

const skip = (await findBrowser()) ? false : "no Chrome/Chromium found";

interface Issue {
  rule: string;
  severity: string;
  line?: number;
  message: string;
}

function deck() {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const file = join(dir, "design/d/slides/01-title.tsx");
  const check = (body: string, ...flags: string[]): Issue[] => {
    writeFileSync(file, `import { Box, Row, Slide, Stack, Text, Equation } from "ided";\n\nexport default function Main() {\n  return (\n    <Slide surface="paper" gap="xl">\n${body}\n    </Slide>\n  );\n}\n`);
    const out = JSON.parse(run(dir, "check", "d", "--json", ...flags).stdout) as { issues: Issue[] };
    return out.issues.filter((i) => ["overflow", "ratio", "crop", "layout"].includes(i.rule));
  };
  return { dir, check };
}

test("overflow is an error at the line that overflows; fitting content is clean", { skip, timeout: 180_000 }, () => {
  const { check } = deck();
  assert.deepEqual(check(`      <Stack gap="l">\n        <Text type="title">A headline that fits</Text>\n        <Text type="body">Inline <Equation tex="\\sqrt{a^2 + b^2}" /> math and a sentence.</Text>\n      </Stack>`), []);

  const word = check(`      <Box width="1/4" surface="sand" pad="l">\n        <Text type="title">Incomprehensibilities</Text>\n      </Box>`);
  assert.equal(word.length, 1, JSON.stringify(word));
  assert.equal(word[0]!.severity, "error");
  assert.equal(word[0]!.line, 7);
  assert.match(word[0]!.message, /^<Text> overflows its <Box> by \d+px at the right/);

  const tall = check(`      <Stack gap="xl">\n${["One", "Two", "Three", "Four", "Five", "Six"].map((n) => `        <Text type="display">${n}</Text>`).join("\n")}\n      </Stack>`);
  assert.ok(tall.length && tall.every((i) => i.rule === "overflow" && i.line! >= 11), JSON.stringify(tall));

  assert.deepEqual(check(`      <Box width="1/4">\n        <Text type="title">Incomprehensibilities</Text>\n      </Box>`, "--no-layout"), [], "--no-layout skips it");
});

test("crop is the one sanctioned overflow, and it is guarded", { skip, timeout: 180_000 }, () => {
  const { check } = deck();
  const band = (crop: string) => `      <Box bleed={["top", "right"]}${crop}>\n        <Text type="display">WWWWWWWWWWWWWWW</Text>\n      </Box>`;
  assert.deepEqual(check(band(" crop")), [], "type cut by the frame edge on purpose");
  assert.match(check(band("")).map((i) => i.message).join(), /<Text> overflows its <Box>/);

  const nothing = check(`      <Box crop>\n        <Text type="body">Fits.</Text>\n      </Box>`);
  assert.deepEqual(nothing.map((i) => [i.severity, i.message]), [["warning", "<Box> cuts nothing: its content fits."]]);

  const body = check(`      <Box crop width="1/4">\n        <Text type="body">Averyveryveryverylongwordthatdoesnotfitinaquarterofthisslide</Text>\n      </Box>`);
  assert.deepEqual(body.map((i) => [i.severity, i.message]), [["warning", "<Box> cuts body-size text."]]);
});

test("a shape laid out off its ratio is a warning", { skip, timeout: 120_000 }, () => {
  const { check } = deck();
  const found = check(`      <Box ratio="16:9" height="1/4" surface="sand">\n        <Text type="small">ratio</Text>\n      </Box>`);
  assert.deepEqual(found.map((i) => [i.rule, i.severity]), [["ratio", "warning"]]);
  assert.match(found[0]!.message, /is laid out at \d+×\d+, not its ratio 16:9/);
});

test("screenshot --zoom cuts a frame into full-resolution tiles", { skip, timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const r = run(dir, "screenshot", "d", "1", "--zoom", "2x2", "-o", "tiles");
  assert.equal(r.status, 0, r.stderr);
  for (const t of ["r1c1", "r1c2", "r2c1", "r2c2"]) assert.ok(existsSync(join(dir, "tiles", `d-01-title-${t}.png`)), t);
  assert.notEqual(run(dir, "screenshot", "d", "1", "--zoom", "9x9").status, 0);
});
