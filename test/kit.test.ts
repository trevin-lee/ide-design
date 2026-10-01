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

test("the kit draws favicons and app icons from the mark", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-kit-"));
  run(dir, "init", "--here", "--bare", "--name", "Kit");
  assert.equal(run(dir, "export", "brand", "--out", "out").status, 0);
  const icons = join(dir, "out/kit-brand-kit/icons");
  const pngSize = (f: string) => {
    const b = readFileSync(join(icons, f));
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (const [f, n] of [["favicon-16.png", 16], ["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-maskable-512.png", 512], ["app-icon-1024.png", 1024]] as const) {
    assert.deepEqual(pngSize(f), [n, n], f);
  }
  assert.match(readFileSync(join(icons, "favicon.svg"), "utf8"), /^<svg[^>]*viewBox="0 0 64 64"/);
  const manifest = JSON.parse(readFileSync(join(icons, "manifest.json"), "utf8")) as { icons: { src: string; purpose?: string }[] };
  assert.deepEqual(manifest.icons.map((i) => i.src), ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]);
  assert.equal(manifest.icons[2]!.purpose, "maskable");

  const file = join(dir, "design/brand/brand.ts");
  writeFileSync(file, readFileSync(file, "utf8").replace("  logo: {", '  logo: {\n    icon: { ground: "paper", colorway: "white" },'));
  const issues = (JSON.parse(run(dir, "check", "brand", "--no-render", "--json").stdout) as { issues: { message: string }[] }).issues.map((i) => i.message);
  assert.ok(issues.some((m) => /The icons draw the mark in "paper" on "paper", 1\.00:1/.test(m)), issues.join("\n"));
});

test("an asset named or drawn like the logo is flagged; a square brand needs no radius", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-kit-"));
  run(dir, "init", "--here", "--bare");
  const assets = join(dir, "design/brand/assets");
  writeFileSync(join(assets, "favicon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#111113"/></svg>');
  writeFileSync(join(assets, "dial.svg"), readFileSync(join(assets, "mark.svg"), "utf8").replace("currentColor", "#111113"));
  const brandFile = join(dir, "design/brand/brand.ts");
  writeFileSync(brandFile, readFileSync(brandFile, "utf8").replace(/radius: \{[^}]*\}/, "radius: {}"));
  const issues = (JSON.parse(run(dir, "check", "brand", "--no-layout", "--json").stdout) as { issues: { rule: string; file: string; message: string; severity: string }[] }).issues;
  const copies = issues.filter((i) => i.rule === "logo-copy").map((i) => `${i.file}: ${i.message}`);
  assert.ok(copies.some((m) => /favicon\.svg: is named like the logo/.test(m)), copies.join("\n"));
  assert.ok(copies.some((m) => /dial\.svg: repeats the logo's drawing/.test(m)), copies.join("\n"));
  assert.ok(!issues.some((i) => i.severity === "error" && /radius/.test(i.message)), "radius: {} is allowed");
});

test("init over an existing design folder says what it kept and what does not fit", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ided-kit-"));
  mkdirSync(join(dir, "design/brand/assets"), { recursive: true });
  writeFileSync(join(dir, "design/README.md"), "old");
  writeFileSync(join(dir, "design/brand/assets/mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor"/></svg>');
  const out = run(dir, "init", "--here", "--bare", "--no-agents-md").stdout;
  assert.match(out, /left as it was:\n {2}= design\/brand\/assets\/mark\.svg/);
  assert.match(out, /design\/README\.md: Unexpected file/);
});
