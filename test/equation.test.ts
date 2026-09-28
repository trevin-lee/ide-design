import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, workspace } from "./helpers.ts";

test("Equation sets TeX inside Text and rejects what the brand decides", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const file = join(dir, "design/d/slides/01-title.tsx");
  const issuesFor = (body: string) => {
    writeFileSync(file, `import { Slide, Stack, Text, Equation } from "ided";\n\nexport default function Main() {\n  return (\n    <Slide surface="paper">\n${body}\n    </Slide>\n  );\n}\n`);
    const r = JSON.parse(run(dir, "check", "d", "--json").stdout) as { issues: { rule: string; message: string; severity: string }[] };
    return r.issues.filter((i) => i.severity === "error").map((i) => `${i.rule}: ${i.message}`);
  };

  assert.deepEqual(
    issuesFor(`      <Stack>\n        <Text type="body">Area <Equation tex="\\pi r^2" />, about <Equation tex="3.14159265358979" />.</Text>\n        <Text type="title"><Equation display tex="\\textcolor{ink}{\\sum_{n=1}^{\\infty} \\frac{1}{n^2}} = \\frac{\\pi^2}{6}" /></Text>\n      </Stack>`),
    [],
    "inline and display math, a brand color, and a long number are all fine",
  );
  assert.match(issuesFor(`      <Text type="body"><Equation tex="\\frac{1}{2" /></Text>`).join(), /equation: <Equation> TeX does not parse/);
  assert.match(issuesFor(`      <Text type="body"><Equation tex="\\Huge x" /></Text>`).join(), /equation: <Equation> uses \\Huge/);
  assert.match(issuesFor(`      <Text type="body"><Equation tex="\\color{red} x" /></Text>`).join(), /invalid-token: <Equation> `\\color\{red\}` is not a brand color/);
  assert.match(issuesFor(`      <Text type="body"><Equation tex="\\textcolor{line}{x}" /></Text>`).join(), /contrast: <Equation> "line" on "paper"/);
  assert.match(issuesFor(`      <Stack>\n        <Equation tex="x" />\n      </Stack>`).join(), /misplaced: <Equation> only works inside <Text>/);
});
