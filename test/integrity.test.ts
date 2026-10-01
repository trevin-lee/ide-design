// What a coherence review found `ided check` getting wrong: false "Clean" results, contrast at the
// wrong size, TeX escapes, and recipes from the rules reference that the checker misjudged.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { findBrowser, run, workspace } from "./helpers.ts";

const skip = (await findBrowser()) ? false : "no Chrome/Chromium found";

type Issue = { rule: string; severity: string; message: string; project: string | null; line?: number };
const check = (dir: string, ...args: string[]) => JSON.parse(run(dir, "check", ...args, "--json").stdout) as { issues: Issue[]; skipped: string[] };
const errors = (dir: string, ...args: string[]) => check(dir, ...args).issues.filter((i) => i.severity === "error" && i.rule !== "ts6133");

function slide(dir: string, body: string, rootProps = "") {
  writeFileSync(
    join(dir, "design/d/slides/01-title.tsx"),
    `import { Box, Equation, Image, Place, Row, Slide, Stack, Text } from "ided";\n\nexport default function T() {\n  return (\n    <Slide surface="paper"${rootProps}>\n${body}\n    </Slide>\n  );\n}\n`,
  );
}

function deck() {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  return dir;
}

const brandFile = (dir: string) => join(dir, "design/brand/brand.ts");
const editBrand = (dir: string, from: string, to: string) => writeFileSync(brandFile(dir), readFileSync(brandFile(dir), "utf8").replace(from, to));

test("a brand error does not hide everything else, and a scoped check covers what depends on it", { timeout: 180_000 }, () => {
  const dir = deck();
  slide(dir, `      <Text type="body" color="line">low contrast</Text>`);
  editBrand(dir, "l: 24,", "l: 26,");
  const all = errors(dir, "d", "--no-layout");
  assert.ok(all.some((i) => i.rule === "brand"), "the brand error is reported for a project check");
  assert.ok(all.some((i) => i.rule === "contrast"), "frames are still rendered and audited");
  assert.ok(errors(dir, "brand", "--no-render").some((i) => i.rule === "brand"), "--no-render still validates the brand");

  editBrand(dir, "l: 26,", "l: 24,");
  slide(dir, `      <Text type="body" color="muted">fine until muted changes</Text>`);
  assert.deepEqual(errors(dir, "brand", "--no-layout"), []);
  editBrand(dir, 'muted: "#62626A"', 'muted: "#D0D0D0"');
  assert.ok(errors(dir, "brand", "--no-layout").some((i) => i.rule === "contrast" && i.project === "d"), "checking the brand re-audits its dependents");

  const skipped = check(dir, "d", "--no-layout").skipped;
  assert.deepEqual(skipped, ["layout (--no-layout)"]);
  assert.match(run(dir, "check", "d", "--no-render").stdout, /Not checked: render audit and layout \(--no-render\)/);
});

test("contrast is judged at the size text is read, and surfaces' default logos must read too", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "doc", "p");
  writeFileSync(
    join(dir, "design/p/pages/01-cover.tsx"),
    `import { Page, Text } from "ided";\n\nexport default function C() {\n  return (\n    <Page surface="paper">\n      <Text type="body" color="accent">Body text in accent</Text>\n    </Page>\n  );\n}\n`,
  );
  // accent on paper is about 3.1:1: enough for 28px text on a slide, not for 14px printed body text.
  assert.ok(errors(dir, "p", "--no-layout").some((i) => i.rule === "contrast" && /needs 4\.5:1/.test(i.message)));
  editBrand(dir, 'paper: { value: "#FAFAF7", on: "ink", logo: "primary" }', 'paper: { value: "#FAFAF7", on: "ink", logo: "white" }');
  assert.ok(errors(dir, "brand", "--no-render").some((i) => /Colorway "white" draws the mark in "paper", 1\.00:1 on "paper"/.test(i.message)));
});

test("an Equation cannot define macros or size, space and box by hand", { timeout: 120_000 }, () => {
  const dir = deck();
  for (const tex of ["\\def\\c{\\textcolor}\\c{accent}{x}", "\\newcommand{\\x}{1} \\x", "\\boxed{x}", "a \\qquad b", "\\raisebox{2em}{x}", "\\displaystyle x"]) {
    slide(dir, `      <Text type="body"><Equation tex="${tex}" /></Text>`);
    assert.ok(
      errors(dir, "d", "--no-layout").some((i) => i.rule === "equation"),
      `${tex} is rejected`,
    );
  }
  slide(dir, `      <Text type="body"><Equation tex="\\int_0^1 x\\,dx" /></Text>`);
  assert.deepEqual(errors(dir, "d", "--no-layout"), [], "thin spaces are fine");
});

test("recipes from the rules reference pass the check", { skip, timeout: 180_000 }, () => {
  const dir = deck();
  mkdirSync(join(dir, "design/d/assets"), { recursive: true });
  writeFileSync(join(dir, "design/d/assets/dot.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#ff4f1f"/></svg>');
  writeFileSync(
    join(dir, "design/d/slides/01-title.tsx"),
    `import { Box, Image, Place, Slide, Stack, Text } from "ided";\nimport dot from "@d/assets/dot.svg";\n\nexport default function T() {\n  return (\n    <Slide surface="paper">\n      <Box surface="sand" pad="l" radius="xl" width="1/3">\n        <Stack gap="m">\n          <Image src={dot} alt="dot" ratio="16:9" radius="concentric" />\n          <Text type="body">A card with an inset image</Text>\n          <Place anchor="top-right" inset="m">\n            <Text type="small">New</Text>\n          </Place>\n        </Stack>\n      </Box>\n    </Slide>\n  );\n}\n`,
  );
  assert.deepEqual(errors(dir, "d"), [], "concentric through a Stack; a Place inside a Stack is pinned to the Box");
});

test("a vertical bleed must actually reach its edge", { skip, timeout: 120_000 }, () => {
  const dir = deck();
  slide(dir, `      <Box surface="ink" bleed={["top", "x"]} pad="l">\n        <Text type="body">band</Text>\n      </Box>\n      <Text type="body">text</Text>`, ' justify="center"');
  const found = errors(dir, "d").filter((i) => i.rule === "bleed").map((i) => i.message);
  assert.ok(found.some((m) => /justify "center" moves it away/.test(m)), found.join("\n"));
  assert.ok(found.some((m) => /bleeds to the top edge but stops \d+px short of it/.test(m)), found.join("\n"));
});

test("dates and randomness are caught however they are reached; hashtags are copy", { timeout: 60_000 }, () => {
  const dir = deck();
  writeFileSync(
    join(dir, "design/d/slides/01-title.tsx"),
    `import { List, Slide, Text } from "ided";\n\nconst pick = Math.random;\nconst { random } = Math;\nconst today = Date();\nconst label = new Intl.DateTimeFormat("en").format(0);\n\nexport default function T() {\n  return (\n    <Slide surface="paper">\n      <Text type="body">{String(pick() + random()) + today + label}</Text>\n      <List type="body" items={["#cafe", "#design"]} />\n    </Slide>\n  );\n}\n`,
  );
  const found = check(dir, "d", "--no-render").issues;
  assert.equal(found.filter((i) => i.rule === "deterministic").length, 4, JSON.stringify(found.filter((i) => i.rule === "deterministic")));
  assert.ok(!found.some((i) => i.rule === "no-raw-values"), "hashtags in copy are not colors");
});
