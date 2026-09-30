// Threaded text: one story through several <Thread> boxes. Browser tests skip without one.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { Browser } from "playwright-core";
import type { RunningServer } from "../src/server/index.ts";
import { findBrowser, run, workspace } from "./helpers.ts";

const skip = (await findBrowser()) ? false : "no Chrome/Chromium found";
const para = "A story that runs from box to box, continuing where the last one filled up, the way magazine columns do. ";

/** A doc whose story `parts` long runs through a cover box, two spread boxes and `lastBox`. */
function magazine(parts: number, lastBox = 'height="1/4"') {
  const dir = workspace("--bare");
  run(dir, "new", "doc", "mag");
  mkdirSync(join(dir, "design/mag/components"), { recursive: true });
  const blocks = Array.from({ length: parts }, (_, i) => `      <Text type="heading">Part ${i + 1}</Text>\n      <Text type="body">${para.repeat(5).trim()}</Text>\n      <Text type="body">${para.repeat(4).trim()} <Em>Emphasis</Em> keeps its place.</Text>`).join("\n");
  writeFileSync(join(dir, "design/mag/components/essay.tsx"), `import { Em, Text } from "ided";\n\nexport function Essay() {\n  return (\n    <>\n${blocks}\n    </>\n  );\n}\n`);
  const page = (name: string, body: string) =>
    writeFileSync(join(dir, `design/mag/pages/${name}.tsx`), `import { Page, Row, Text, Thread } from "ided";\nimport { Essay } from "@mag/components/essay";\n\nexport default function P() {\n  return (\n    <Page surface="paper" gap="xl">\n${body}\n    </Page>\n  );\n}\n`);
  page("01-cover", `      <Text type="display">The Long Read</Text>\n      <Thread story={Essay} gap="m" grow />`);
  page("02-spread", `      <Row gap="xl" grow>\n        <Thread story={Essay} gap="m" width="2/3" height="full" />\n        <Thread story={Essay} gap="m" width="1/3" height="full" />\n      </Row>`);
  page("03-end", `      <Thread story={Essay} gap="m" ${lastBox} />`);
  return dir;
}

const errors = (dir: string, ...flags: string[]) =>
  (JSON.parse(run(dir, "check", "mag", "--json", ...flags).stdout) as { issues: { rule: string; severity: string; line?: number; file: string; message: string }[] }).issues.filter(
    (i) => i.severity === "error" && i.rule !== "ts6133",
  );

test("a story runs through its boxes in page order, and must end in the last one", { skip, timeout: 180_000 }, () => {
  assert.deepEqual(errors(magazine(10, "grow")), [], "room enough: clean");
  const short = errors(magazine(10));
  assert.deepEqual(
    short.map((i) => [i.file.split("/").pop(), i.message]),
    [["03-end.tsx", '<Thread> is the last box of the story "Essay", and the rest of the story does not fit.']],
  );
});

test("thread boxes need a height, and stories stay out of flowing content", { timeout: 120_000 }, () => {
  const dir = magazine(1, "");
  writeFileSync(join(dir, "design/mag/pages/04-flow.tsx"), `import { Page, Thread } from "ided";\nimport { Essay } from "@mag/components/essay";\n\nexport default function F() {\n  return (\n    <Page surface="paper" flow>\n      <Thread story={Essay} grow />\n    </Page>\n  );\n}\n`);
  const messages = errors(dir, "--no-layout").map((i) => i.message);
  assert.ok(messages.some((m) => /<Thread> needs a height/.test(m)), messages.join("\n"));
  assert.ok(messages.some((m) => /<Thread> cannot be inside flowing content/.test(m)), messages.join("\n"));
});

let dir = "";
let server: RunningServer;
let browser: Browser;
before(async () => {
  if (skip) return;
  dir = magazine(10, "grow");
  const { startServer } = await import("../src/server/index.ts");
  const { launchBrowser } = await import("../src/export/browser.ts");
  server = await startServer({ root: dir, port: 0 });
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

test("each box starts where the one before it ended, even viewed on its own", { skip, timeout: 90_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${server.url}/#/p/mag/03-end`, { waitUntil: "load" });
  // Only page 3 is on screen; the other pages are measured offscreen so its box knows its start.
  await page.waitForFunction(
    () => {
      const box = document.querySelector<HTMLElement>(".frame-card [data-ided-thread]");
      return box?.dataset.idedThreadIndex === "3" && /^\d+\.\d+\.\d+$/.test(box.dataset.idedThreadStart ?? "");
    },
    null,
    { timeout: 30_000 },
  );
  const starts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-ided-thread]")].map((b) => [b.closest(".frame-card") ? "shown" : "offscreen", b.dataset.idedThreadIndex, b.dataset.idedThreadStart]));
  const byIndex = new Map(starts.map(([, i, s]) => [Number(i), s!]));
  assert.deepEqual([...byIndex.keys()].sort(), [0, 1, 2, 3]);
  const order = [0, 1, 2, 3].map((i) => byIndex.get(i)!.split(".").map(Number));
  assert.deepEqual(order[0], [0, 0, 0]);
  const after = (a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;
  for (let i = 1; i < 4; i++) assert.ok(after(order[i]!, order[i - 1]!) > 0, `box ${i} starts after box ${i - 1}: ${order.join(" | ")}`);
  await page.close();
});
