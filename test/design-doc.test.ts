import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkDesignDoc, designDocTemplate, designSections } from "../src/core/design-doc.ts";
import { run, workspace } from "./helpers.ts";

test("a scaffolded design document has every section, all unwritten", () => {
  for (const kind of ["brand", "library", "deck", "doc", "graphic", "web"] as const) {
    const status = checkDesignDoc(kind, designDocTemplate(kind, "Title"));
    assert.deepEqual(status.missing, []);
    assert.deepEqual(status.empty, designSections(kind).map((s) => s.title));
  }
});

test("prompts do not count as writing; prose does", () => {
  const doc = designDocTemplate("graphic", "Launch").replace("## Message\n", "## Message\n\nGet researchers to try Loam by showing their notes stay theirs.\n");
  const status = checkDesignDoc("graphic", doc);
  assert.ok(!status.empty.includes("Message"));
  assert.ok(status.empty.includes("Concept"));
});

test("check: missing is an error, unwritten is a warning, written is clean", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  assert.equal(run(dir, "new", "graphic", "post").status, 0);
  const issues = () => JSON.parse(run(dir, "check", "post", "--json", "--no-render").stdout).issues as { rule: string; severity: string; message: string }[];

  const unwritten = issues().filter((i) => i.rule === "design-doc");
  assert.equal(unwritten.length, 1);
  assert.equal(unwritten[0]!.severity, "warning");
  assert.match(unwritten[0]!.message, /Brief, Message, Concept, Hierarchy, Decisions, Alternatives, Critique are not written yet/);

  const file = join(dir, "design/post/DESIGN.md");
  const written = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "Written.");
  writeFileSync(file, written);
  assert.deepEqual(issues().filter((i) => i.rule === "design-doc"), []);

  writeFileSync(file, written.replace("## Concept", "## Idea"));
  assert.ok(issues().some((i) => i.rule === "design-doc" && i.severity === "error" && /missing "## Concept"/.test(i.message)));

  rmSync(file);
  assert.ok(issues().some((i) => i.rule === "design-doc" && i.severity === "error" && /Missing DESIGN\.md/.test(i.message)));
});

test("init writes design documents that check clean, and the brand kit carries the brand's", { timeout: 60_000 }, () => {
  const dir = workspace("--name", "Docs");
  const r = run(dir, "check");
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Clean/);
  assert.equal(run(dir, "export", "brand", "--out", "out").status, 0);
  assert.match(readFileSync(join(dir, "out/docs-brand-kit/DESIGN.md"), "utf8"), /^# Docs identity/);
});
