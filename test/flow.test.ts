// Flowing doc pages: one file, as many pages as its content needs. Browser tests skip without one.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { findBrowser, run, workspace } from "./helpers.ts";

const hasBrowser = await findBrowser();
const skip = hasBrowser ? false : "no Chrome/Chromium found";

const para = "Design as code means every value comes from the brand and every page is checked like a program. ".repeat(7).trim();

function report(body: string, pageProps = ' flow chrome={<Place anchor="bottom-right" inset="l"><Text type="small">Page <FrameNumber format="n/total" /></Text></Place>}') {
  const dir = workspace("--bare");
  run(dir, "new", "doc", "report");
  writeFileSync(
    join(dir, "design/report/pages/01-cover.tsx"),
    `import { Box, FrameNumber, Image, Page, Place, Stack, Text } from "ided";\n\nexport default function Cover() {\n  return (\n    <Page surface="paper" gap="l"${pageProps}>\n${body}\n    </Page>\n  );\n}\n`,
  );
  return dir;
}

const issues = (dir: string, ...flags: string[]) =>
  (JSON.parse(run(dir, "check", "report", "--json", ...flags).stdout) as { issues: { rule: string; severity: string; line?: number; message: string }[] }).issues.filter((i) => i.rule !== "design-doc" && i.rule !== "ts6133");

test("a flowing page runs onto as many pages as it needs, numbered through the document", { skip, timeout: 180_000 }, () => {
  const sections = Array.from({ length: 6 }, (_, i) => `      <Text type="heading">Section ${i + 1}</Text>\n      <Text type="body">${para}</Text>\n      <Text type="body">${para}</Text>`).join("\n");
  const dir = report(sections);
  run(dir, "add", "report", "closing");
  assert.deepEqual(issues(dir), []);

  assert.equal(run(dir, "export", "report", "-f", "png", "-o", "out").status, 0);
  const pngs = readdirSync(join(dir, "out/report")).sort();
  assert.ok(pngs.length >= 3, pngs.join());
  assert.deepEqual(pngs.at(-1), "02-closing.png");
  assert.ok(pngs.slice(0, -1).every((f, i) => f === `01-cover-${i + 1}.png`), pngs.join());

  assert.equal(run(dir, "export", "report", "-o", "out").status, 0);
  const pdf = readFileSync(join(dir, "out/report.pdf"), "latin1");
  assert.equal(pdf.match(/\/Type\s*\/Page[^s]/g)?.length, pngs.length, "one PDF page per page");

  assert.equal(run(dir, "screenshot", "report", "1", "--page", "2", "-o", "p2.png").status, 0);
  assert.ok(existsSync(join(dir, "p2.png")));
  assert.match(run(dir, "screenshot", "report", "1", "--page", "99").stderr, /01-cover has \d+ pages/);
});

test("in a flowing page, what cannot break must fit a page and the column", { skip, timeout: 180_000 }, () => {
  const tall = Array.from({ length: 6 }, () => `            <Text type="body">${para}</Text>`).join("\n");
  const dir = report(`      <Text type="title">Incomprehensibilitiesincomprehensibilities</Text>\n      <Box surface="sand" pad="l">\n        <Stack gap="l">\n${tall}\n        </Stack>\n      </Box>`);
  assert.deepEqual(
    issues(dir).map((i) => [i.line, i.message.replace(/\d+px/, "Npx")]),
    [
      [6, "<Text> runs Npx past the page's text column at the right."],
      [7, "<Box> is taller than a page, so it cannot stay on one."],
    ],
  );
});

test("flowing pages keep furniture in chrome and nothing bleeds", { timeout: 120_000 }, () => {
  const misplaced = report(`      <Place anchor="top-right" inset="l">\n        <Text type="small">pinned</Text>\n      </Place>\n      <Box surface="ink" bleed="x" pad="l">\n        <Text type="body">band</Text>\n      </Box>`, ' flow chrome={<Text type="small">footer</Text>}');
  const found = issues(misplaced, "--no-layout").map((i) => i.message);
  assert.ok(found.some((m) => /<Place> cannot be pinned inside flowing content/.test(m)), found.join("\n"));
  assert.ok(found.some((m) => /<Box> cannot bleed inside flowing content/.test(m)), found.join("\n"));
  assert.ok(found.some((m) => /chrome` holds page furniture pinned with <Place>/.test(m)), found.join("\n"));

  const chromeOnly = report(`      <Text type="body">x</Text>`, ' chrome={<Place anchor="bottom" inset="l"><Text type="small">x</Text></Place>}');
  assert.ok(issues(chromeOnly, "--no-layout").some((i) => /`chrome` repeats furniture on every page of a flowing page/.test(i.message)));
});
