// Responsive web screens: one file, rendered and checked at every viewport. Browser tests skip without one.
import assert from "node:assert/strict";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { findBrowser, run, workspace } from "./helpers.ts";

const skip = (await findBrowser()) ? false : "no Chrome/Chromium found";

function site(body?: string) {
  const dir = workspace("--bare");
  assert.equal(run(dir, "new", "web", "site", "--viewport", "desktop,tablet,mobile").status, 0);
  if (body) {
    writeFileSync(
      join(dir, "design/site/screens/01-home.tsx"),
      `import { Box, Row, Screen, Show, Stack, Text } from "ided";\n\nexport default function Home() {\n  return (\n    <Screen surface="paper" gap="xl">\n${body}\n    </Screen>\n  );\n}\n`,
    );
  }
  return dir;
}

const issues = (dir: string, project = "site", ...flags: string[]) =>
  (JSON.parse(run(dir, "check", project, "--json", ...flags).stdout) as { issues: { rule: string; severity: string; line?: number; message: string }[] }).issues.filter(
    (i) => i.rule !== "design-doc" && i.rule !== "ts6133",
  );

test("a responsive screen is checked and exported at every viewport", { skip, timeout: 180_000 }, () => {
  const dir = site();
  assert.deepEqual(issues(dir), [], "the responsive starter is clean at every viewport");
  assert.equal(run(dir, "export", "site", "-o", "out").status, 0);
  assert.deepEqual(readdirSync(join(dir, "out/site")).sort(), ["01-home-desktop.png", "01-home-mobile.png", "01-home-tablet.png"]);
  assert.equal(run(dir, "screenshot", "site", "1", "--viewport", "mobile", "-o", "m.png").status, 0);
  assert.ok(existsSync(join(dir, "m.png")));
  assert.match(run(dir, "screenshot", "site", "1", "--viewport", "watch").stderr, /site renders at desktop, tablet, mobile/);
});

test("what fails on only some viewports says which", { skip, timeout: 180_000 }, () => {
  const dir = site(`      <Text type="title">Incomprehensibilities</Text>\n      <Text type={{ desktop: "title", tablet: "body" }}>Incomprehensibilities</Text>`);
  const found = issues(dir);
  assert.deepEqual(
    found.map((i) => [i.line, i.rule, i.message.replace(/\d+px/, "Npx")]),
    [
      [6, "overflow", "<Text> runs Npx past the frame's edge at the right. (tablet)"],
      [6, "overflow", "<Text> runs Npx past the frame's edge at the right. (mobile)"],
      [7, "overflow", "<Text> runs Npx into the frame's margin at the right. (mobile)"],
    ],
    JSON.stringify(found),
  );
});

test("values per viewport and Show belong to web screens", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  writeFileSync(
    join(dir, "design/d/slides/01-title.tsx"),
    `import { Show, Slide, Text } from "ided";\n\nexport default function T() {\n  return (\n    <Slide surface="paper" gap={{ desktop: "xl", mobile: "m" }}>\n      <Show on="mobile">\n        <Text type="body">x</Text>\n      </Show>\n    </Slide>\n  );\n}\n`,
  );
  const messages = issues(dir, "d", "--no-layout").map((i) => i.message);
  assert.ok(messages.some((m) => /<Slide> `gap` has a value per viewport, but only web screens have viewports/.test(m)), messages.join("\n"));
  assert.ok(messages.some((m) => /<Show> only works in web screens/.test(m)), messages.join("\n"));
});

test("grow on a web screen keeps its content and takes the rest of the viewport", { skip, timeout: 180_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "web", "site", "--viewport", "mobile");
  const para = "A screen grows with its content, so a growing block starts from its own height. ".repeat(6);
  writeFileSync(
    join(dir, "design/site/screens/01-home.tsx"),
    `import { Screen, Stack, Text } from "ided";\n\nexport default function Home() {\n  return (\n    <Screen surface="paper" gap="l">\n      <Stack gap="m" grow>\n        <Text type="body">${para}</Text>\n        <Text type="body">${para}</Text>\n      </Stack>\n      <Text type="small">Footer</Text>\n    </Screen>\n  );\n}\n`,
  );
  const issues = (JSON.parse(run(dir, "check", "site", "--json").stdout) as { issues: { rule: string; severity: string; message: string }[] }).issues;
  assert.deepEqual(issues.filter((i) => i.severity === "error").map((i) => `${i.rule}: ${i.message}`), []);
});
