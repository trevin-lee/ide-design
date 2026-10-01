// The brand kit's token files and the brand-kit workflow do what their docs say.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "./helpers.ts";

const version = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")).version as string;

test("the kit's CSS loads the brand fonts, and tokens.json is strict DTCG", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-kit-"));
  run(dir, "init", "--here", "--bare", "--name", "Kit");
  assert.equal(run(dir, "export", "brand", "--out", "out").status, 0);
  const kit = join(dir, "out", "kit-brand-kit");
  const css = readFileSync(join(kit, "tokens/tokens.css"), "utf8");
  assert.match(css, /@font-face\{font-family:"Inter";src:url\("\.\.\/fonts\/inter\.woff2"\);font-weight:100 900;font-style:normal;font-display:swap;\}/);
  assert.ok(existsSync(join(kit, "fonts/inter.woff2")));
  assert.match(readFileSync(join(kit, "tokens/tailwind.css"), "utf8"), /@font-face\{font-family:"Inter"/);

  const json = JSON.parse(readFileSync(join(kit, "tokens/tokens.json"), "utf8"));
  assert.deepEqual(json.color.ink.$value, { colorSpace: "srgb", components: [0.0667, 0.0667, 0.0745], hex: "#111113" });
  assert.deepEqual(json.space.m.$value, { value: 16, unit: "px" });
  assert.deepEqual(json.font.sans.$value.slice(0, 1), ["Inter"]);
  const shadow = json.shadow.raised.$value;
  assert.equal(shadow.length, 2);
  assert.deepEqual(shadow[1].offsetY, { value: 12, unit: "px" });
  assert.equal(shadow[1].color.alpha, 0.1);
  const body = json.typography.body.$value;
  assert.equal(typeof body.lineHeight, "number");
  assert.deepEqual(Object.keys(body).sort(), ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"]);
  assert.equal(json.typography.label.$extensions["dev.ided"].textTransform, "uppercase");
});

test("the Tailwind theme replaces weights and tracking, and maps size and stroke tokens", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-kit-"));
  run(dir, "init", "--here", "--bare", "--name", "Kit");
  run(dir, "export", "brand", "--out", "out");
  const tw = readFileSync(join(dir, "out/kit-brand-kit/tokens/tailwind.css"), "utf8");
  for (const reset of ["--font-weight-*", "--tracking-*", "--leading-*", "--container-*"]) assert.ok(tw.includes(`  ${reset}: initial;`), reset);
  assert.match(tw, /--size-icon: 32px;/);
  assert.match(tw, /@utility size-\* \{\n  width: --value\(--size-\*\);\n  height: --value\(--size-\*\);\n\}/);
  assert.match(tw, /@utility border-t-\* \{\n  border-top-width: --value\(--stroke-\*\);\n\}/);
});

test("ided ci writes the workflow at the repository root and pins its ided version", { timeout: 60_000 }, () => {
  const repo = mkdtempSync(join(tmpdir(), "ided-ci-"));
  mkdirSync(join(repo, ".git"));
  const site = join(repo, "site");
  mkdirSync(site);
  run(site, "init", "--here", "--bare");
  const r = run(site, "ci");
  assert.equal(r.status, 0, r.stderr);
  const file = join(repo, ".github/workflows/brand-kit.yml");
  const yml = readFileSync(file, "utf8");
  assert.ok(!existsSync(join(site, ".github")), "not in the workspace folder, where GitHub never looks");
  assert.match(yml, /paths: \["site\/design\/brand\/\*\*", "site\/ided\.json"\]/);
  assert.match(yml, /defaults:\n      run:\n        working-directory: site\n/);
  assert.match(yml, /path: site\/out\n/);
  assert.match(yml, new RegExp(`IDED_VERSION: "${version.replace(/\./g, "\\.")}"`));
  assert.match(run(site, "ci").stderr, /exists\. Use --force/);

  const ci = () => (JSON.parse(run(site, "check", "brand", "--no-render", "--json").stdout) as { issues: { rule: string; message: string }[] }).issues.filter((i) => i.rule === "ci");
  assert.deepEqual(ci(), []);
  writeFileSync(file, yml.replace(/IDED_VERSION: "[^"]+"/, 'IDED_VERSION: "0.1.0"'));
  assert.match(ci()[0]?.message ?? "", new RegExp(`runs ided 0\\.1\\.0; this is ${version.replace(/\./g, "\\.")}`));
});
