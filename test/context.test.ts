// A frame rendered on its own keeps its document's context, and comments say where they were left.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { findBrowser, run, workspace } from "./helpers.ts";

const skip = (await findBrowser()) ? false : "no Chrome/Chromium found";
const para = "A story that runs from box to box, continuing where the last one filled up, the way magazine columns do. ";

test("exporting one frame keeps its thread position and page number", { skip, timeout: 240_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "doc", "mag");
  mkdirSync(join(dir, "design/mag/components"), { recursive: true });
  writeFileSync(
    join(dir, "design/mag/components/essay.tsx"),
    `import { Text } from "ided";\n\nexport function Essay() {\n  return (\n    <>\n${Array.from({ length: 8 }, () => `      <Text type="body">${para.repeat(5)}</Text>`).join("\n")}\n    </>\n  );\n}\n`,
  );
  const page = (name: string) =>
    writeFileSync(
      join(dir, `design/mag/pages/${name}.tsx`),
      `import { FrameNumber, Page, Place, Text, Thread } from "ided";\nimport { Essay } from "@mag/components/essay";\n\nexport default function P() {\n  return (\n    <Page surface="paper">\n      <Thread story={Essay} grow />\n      <Place anchor="bottom-right" inset="l">\n        <Text type="small"><FrameNumber format="n/total" /></Text>\n      </Place>\n    </Page>\n  );\n}\n`,
    );
  page("01-cover");
  page("02-second");
  assert.equal(run(dir, "export", "mag", "-f", "png", "-o", "all").status, 0);
  assert.equal(run(dir, "export", "mag", "-f", "png", "--frames", "02-second", "-o", "one").status, 0);
  assert.ok(readFileSync(join(dir, "one/mag/02-second.png")).equals(readFileSync(join(dir, "all/mag/02-second.png"))), "the same pixels as in the full export");
});

test("comments say which page and viewport they were left on", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "web", "site", "--viewport", "desktop,mobile");
  writeFileSync(
    join(dir, "design/site/comments.json"),
    JSON.stringify({
      comments: [
        {
          id: "c1",
          project: "site",
          frame: "01-home",
          target: { src: "design/site/screens/01-home.tsx:10:9", primitive: "Text", ancestors: [], text: "", rect: null, viewport: "mobile" },
          body: "Too big",
          author: "user",
          status: "open",
          createdAt: "2026-10-01T00:00:00.000Z",
          replies: [],
        },
      ],
    }),
  );
  assert.match(run(dir, "comments").stdout, /01-home\.tsx:10:9 \(on mobile\)/);
  assert.match(run(dir, "list").stdout, /site web desktop 1440, mobile 390/);
});

test("comments belong to frames, and follow their folder when it is renamed", { timeout: 120_000 }, async () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const { addComment } = await import("../src/core/comments.ts");
  const { scanWorkspace } = await import("../src/core/workspace.ts");
  assert.throws(() => addComment(scanWorkspace(dir), { project: "brand", frame: null, target: null, body: "x" }), /comments are left on the frames/);
  addComment(scanWorkspace(dir), { project: "d", frame: "01-title", target: null, body: "x" });
  const { renameSync } = await import("node:fs");
  renameSync(join(dir, "design/d"), join(dir, "design/deck"));
  const { listComments } = await import("../src/core/comments.ts");
  assert.deepEqual(listComments(scanWorkspace(dir), { project: "deck" }).map((c) => c.project), ["deck"]);
});

test("check warns about a comment left on a page that no longer exists", { skip, timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "doc", "r");
  writeFileSync(join(dir, "design/r/pages/01-cover.tsx"), `import { Page, Text } from "ided";\n\nexport default function C() {\n  return (\n    <Page surface="paper" flow>\n      <Text type="body">Short now.</Text>\n    </Page>\n  );\n}\n`);
  writeFileSync(
    join(dir, "design/r/comments.json"),
    JSON.stringify({ comments: [{ id: "c9", project: "r", frame: "01-cover", target: { src: "design/r/pages/01-cover.tsx:6:7", primitive: "Text", ancestors: [], text: "", rect: null, page: 3 }, body: "x", author: "user", status: "open", createdAt: "2026-10-01T00:00:00.000Z", replies: [] }] }),
  );
  const issues = (JSON.parse(run(dir, "check", "r", "--json").stdout) as { issues: { rule: string; message: string }[] }).issues;
  assert.ok(issues.some((i) => i.rule === "comments" && /Comment c9 was left on page 4 of 01-cover, which now has 1 page/.test(i.message)), JSON.stringify(issues));
});
