// End-to-end: drives the built CLI (run `npm run build` first).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { CLI, run, runWith, workspace } from "./helpers.ts";

test("init → check → break it → check → structure rules", { timeout: 60_000 }, () => {
  assert.ok(existsSync(CLI), "build first: npm run build");
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  assert.equal(run(dir, "init", "--here", "--name", "Test Co").status, 0);
  const clean = run(dir, "check");
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.match(clean.stdout, /Clean/);

  writeFileSync(
    join(dir, "design/intro/slides/05-bad.tsx"),
    `import { Slide, Stack, Text } from "ided";\nexport default function Bad() {\n  return (\n    <Slide surface="paper">\n      <Stack gap="16px">\n        <Text type="body" color="muted">ok</Text>\n      </Stack>\n    </Slide>\n  );\n}\n`,
  );
  const bad = run(dir, "check", "intro", "--json");
  assert.equal(bad.status, 1);
  const result = JSON.parse(bad.stdout) as { issues: { rule: string; file: string; line?: number }[] };
  const gap = result.issues.find((i) => i.rule === "invalid-token");
  assert.ok(gap, JSON.stringify(result.issues));
  assert.equal(gap.file, "design/intro/slides/05-bad.tsx");
  assert.equal(gap.line, 5);

  mkdirSync(join(dir, "design/intro/stuff"));
  writeFileSync(join(dir, "design/intro/slides/Bad Name.tsx"), "");
  const shape = JSON.parse(run(dir, "check", "intro", "--json", "--no-render").stdout) as { issues: { rule: string }[] };
  assert.ok(shape.issues.some((i) => i.rule === "structure"));
  assert.ok(shape.issues.some((i) => i.rule === "frame-name"));
});

test("new and add follow the numbering contract", { timeout: 30_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  run(dir, "init", "--here", "--bare");
  assert.equal(run(dir, "new", "doc", "report", "--page", "a4").status, 0);
  assert.equal(JSON.parse(readFileSync(join(dir, "design/report/project.json"), "utf8")).page, "a4");
  const add = run(dir, "add", "report", "Executive Summary");
  assert.match(add.stdout, /pages\/02-executive-summary\.tsx/);
  assert.equal(run(dir, "check").status, 0);
});

test("brand kit exports every variant × colorway", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  run(dir, "init", "--here", "--bare", "--name", "Kit");
  const r = run(dir, "export", "brand", "--out", "out");
  assert.equal(r.status, 0, r.stderr);
  const kit = join(dir, "out", "kit-brand-kit");
  const manifest = JSON.parse(readFileSync(join(kit, "manifest.json"), "utf8")) as { files: string[] };
  for (const f of ["tokens/tokens.css", "tokens/tailwind.css", "tokens/tokens.json", "logos/stacked/stacked-reversed.svg", "logos/mark/mark-primary-512.png"]) {
    assert.ok(manifest.files.includes(f), f);
    assert.ok(existsSync(join(kit, f)), f);
  }
  assert.match(readFileSync(join(kit, "tokens/tailwind.css"), "utf8"), /--color-\*: initial;/);
});

test("libraries: dependencies, typed assets and cycles", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  run(dir, "init", "--here", "--bare");
  assert.equal(run(dir, "new", "deck", "pitch").status, 0);
  assert.equal(run(dir, "new", "library", "kit").status, 0);
  mkdirSync(join(dir, "design/kit/assets"), { recursive: true });
  writeFileSync(join(dir, "design/kit/assets/dot.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>');
  const slide = (asset: string) =>
    writeFileSync(
      join(dir, "design/pitch/slides/02-kit.tsx"),
      `import { Slide, Image } from "ided";\nimport { Card } from "@kit/components/card";\nimport dot from "@kit/assets/${asset}";\nexport default function Kit() {\n  return (\n    <Slide surface="paper">\n      <Image src={dot} alt="dot" ratio="1:1" width="1/4" />\n      <Card title="a" body="b" />\n    </Slide>\n  );\n}\n`,
    );
  slide("dot.svg");
  const issues = (args: string[]) => (JSON.parse(run(dir, ...args, "--json").stdout) as { issues: { rule: string; line?: number }[] }).issues;
  assert.ok(issues(["check", "pitch"]).some((i) => i.rule === "imports"), "undeclared dependency");
  assert.equal(run(dir, "use", "pitch", "kit").status, 0);
  const ok = run(dir, "check");
  assert.equal(ok.status, 0, ok.stdout);
  slide("dott.svg");
  assert.ok(issues(["check", "pitch", "--no-render"]).some((i) => i.rule === "ts2307" && i.line === 3), "missing asset is a type error");
  slide("dot.svg");
  assert.equal(run(dir, "new", "library", "icons").status, 0);
  assert.equal(run(dir, "use", "icons", "kit").status, 0);
  const cycle = run(dir, "use", "kit", "icons");
  assert.equal(cycle.status, 1);
  assert.match(cycle.stderr, /cycle/);
  assert.equal(run(dir, "use", "kit", "pitch").status, 1);
  assert.equal(run(dir, "check").status, 0);
});

test("the export renderer is pinned and reported", () => {
  const status = JSON.parse(run(process.cwd(), "browser", "status", "--json").stdout) as { version: string; dir: string; installed: boolean; cache: string };
  assert.match(status.version, /^\d+\.\d+\.\d+\.\d+$/);
  assert.ok(status.dir.startsWith(status.cache));
  assert.equal(typeof status.installed, "boolean");
});

test("re-running init upgrades a 0.1 workspace without restoring what was removed", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  run(dir, "init", "--here", "--name", "Old");
  run(dir, "new", "doc", "memo");
  // What a 0.1 workspace looks like: no design documents. Also things the user removed on purpose.
  for (const f of ["design/brand/DESIGN.md", "design/memo/DESIGN.md", "design/intro"]) rmSync(join(dir, f), { recursive: true });
  rmSync(join(dir, "design/brand/assets/fonts/jetbrains-mono.woff2"));
  const errors = JSON.parse(run(dir, "check", "--json", "--no-render").stdout).issues.filter((i: { rule: string; severity: string }) => i.rule === "design-doc" && i.severity === "error");
  assert.equal(errors.length, 2);

  assert.equal(run(dir, "init", "--here").status, 0);
  assert.ok(!existsSync(join(dir, "design/intro")), "sample deck not restored");
  assert.ok(!existsSync(join(dir, "design/brand/assets/fonts/jetbrains-mono.woff2")), "removed font not restored");
  assert.doesNotMatch(readFileSync(join(dir, "design/brand/DESIGN.md"), "utf8"), /starter identity/, "no starter text over a real brand");
  const after = JSON.parse(run(dir, "check", "--json", "--no-render").stdout).issues as { rule: string; severity: string }[];
  assert.deepEqual(after.filter((i) => i.severity === "error"), []);
  assert.equal(after.filter((i) => i.rule === "design-doc").length, 2, "one 'not written yet' warning per project");
});

test("use --remove drops a dependency and names files still importing it", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-e2e-"));
  run(dir, "init", "--here", "--bare");
  run(dir, "new", "deck", "pitch");
  run(dir, "new", "library", "kit");
  run(dir, "use", "pitch", "kit");
  writeFileSync(join(dir, "design/pitch/slides/02-kit.tsx"), `import { Slide } from "ided";\nimport { Card } from "@kit/components/card";\nexport default function Kit() {\n  return (\n    <Slide surface="paper">\n      <Card title="a" body="b" />\n    </Slide>\n  );\n}\n`);
  const r = run(dir, "use", "pitch", "kit", "--remove");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no longer uses kit/);
  assert.match(r.stdout, /design\/pitch\/slides\/02-kit\.tsx/);
  assert.equal(JSON.parse(readFileSync(join(dir, "design/pitch/project.json"), "utf8")).dependencies, undefined);
});

test("open comments on a renamed frame are flagged; unknown projects are errors", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const comments = join(dir, "design/d/comments.json");
  const comment = (id: string, src: string, status = "open") => ({ id, project: "d", frame: "01-title", target: { src, primitive: "Text", ancestors: [], text: "", rect: null }, body: "x", author: "user", status, createdAt: "2026-09-28T00:00:00.000Z", replies: [] });
  writeFileSync(comments, JSON.stringify({ comments: [comment("c1", "design/d/slides/01-title.tsx:5:7"), comment("c2", "design/d/slides/01-title.tsx:5:7", "resolved")] }));
  const warnings = () => (JSON.parse(run(dir, "check", "d", "--json", "--no-render").stdout).issues as { rule: string; message: string }[]).filter((i) => i.rule === "comments");
  assert.deepEqual(warnings(), []);
  renameSync(join(dir, "design/d/slides/01-title.tsx"), join(dir, "design/d/slides/01-opening.tsx"));
  assert.deepEqual(warnings().map((w) => w.message), ["Comment c1 points at design/d/slides/01-title.tsx, which no longer exists."], "open ones only");

  const unknown = run(dir, "comments", "nope");
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /No project "nope"/);
});

test("list gives frame sizes to frame projects only", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "library", "kit");
  run(dir, "new", "web", "site", "--viewport", "mobile");
  const list = JSON.parse(run(dir, "list", "--json").stdout) as { id: string; size: string | null }[];
  assert.deepEqual(Object.fromEntries(list.map((p) => [p.id, p.size])), { brand: null, kit: null, site: "390xauto" });
});

test("browser remove deletes only the builds ided downloaded", { timeout: 30_000 }, () => {
  const cache = mkdtempSync(join(tmpdir(), "ided-browsers-"));
  for (const d of ["chromium_headless_shell-1", "ffmpeg-2", "someone-elses"]) mkdirSync(join(cache, d));
  const r = runWith({ IDED_BROWSERS_PATH: cache }, cache, "browser", "remove");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(cache), ["someone-elses"]);
  rmSync(cache, { recursive: true, force: true });
});
