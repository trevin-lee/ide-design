import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { displayUrl, factNames, formatFact, validateBrandFacts, type BrandFacts } from "../src/shared/brand-facts.ts";
import { lintFile } from "../src/check/lint.ts";
import type { Project } from "../src/core/workspace.ts";
import { run, workspace } from "./helpers.ts";

const data: BrandFacts = {
  names: { full: "Kiln & Copper", legal: "Kiln and Copper LLC" },
  links: { website: "https://www.kilnandcopper.com/", signup: "https://kilnandcopper.com/classes" },
  contact: { email: "hello@kilnandcopper.com", phone: "+1 828 555 0142" },
  locations: { studio: { label: "Studio", street: "12 Clingman Ave", city: "Asheville", region: "NC", postal: "28801" } },
  social: { instagram: "@kilnandcopper" },
  abbreviations: { MW: "megawatt" },
};

test("facts format by group", () => {
  assert.equal(formatFact(data, "links.website"), "kilnandcopper.com");
  assert.equal(formatFact(data, "links.website", "full"), "https://www.kilnandcopper.com/");
  assert.equal(formatFact(data, "locations.studio"), "12 Clingman Ave, Asheville, NC 28801");
  assert.equal(formatFact(data, "locations.studio", "city"), "Asheville, NC");
  assert.equal(formatFact(data, "abbreviations.MW"), "MW");
  assert.equal(formatFact(data, "abbreviations.MW", "both"), "megawatt (MW)");
  assert.equal(formatFact(data, "links.nope"), undefined);
  assert.equal(displayUrl("http://example.org/a/"), "example.org/a");
  assert.ok(factNames(data).includes("contact.phone"));
});

test("brand data is validated", () => {
  assert.deepEqual(validateBrandFacts(data), []);
  const paths = validateBrandFacts({
    links: { website: "kilnandcopper.com" },
    contact: { email: "not an address" },
    social: { x: "kiln" },
    locations: { studio: { street: "12 Clingman Ave" } },
    names: { Full: "K" },
    colors: {},
  }).map((i) => i.path);
  for (const p of ["facts.links.website", "facts.contact.email", "facts.social.x", "facts.locations.studio", "facts.names.Full", "facts.colors"]) assert.ok(paths.includes(p), p);
});

test("typed contact details are rejected in artifacts", () => {
  const project = { id: "deck", dir: "/ws/design/deck", kind: "deck", title: "D", manifest: { kind: "deck", title: "D" }, geometry: null, frames: [], components: [], assets: [], dependencies: [], issues: [] } as unknown as Project;
  const lint = (text: string) =>
    lintFile("/ws/design/deck/slides/01-a.tsx", `import { Slide, Text } from "ided";\nexport default function A() { return <Slide surface="paper"><Text type="body">${text}</Text></Slide>; }\n`, "frame", project, "/ws", new Map([["deck", "deck"]])).filter((i) => i.rule === "no-raw-facts");
  for (const bad of ["kilnandcopper.com", "https://x.org", "hello@x.io", "828-555-0142", "www.x.net"]) assert.equal(lint(bad).length, 1, bad);
  for (const fine of ["[signup link]", "loam-1.0.md", "1.2 MW", "e.g. U.S.", "2026-09-28", "$340"]) assert.equal(lint(fine).length, 0, fine);
});

test("facts render, are typed, and reach the brand kit", { timeout: 60_000 }, () => {
  const dir = workspace("--bare", "--name", "Facts Co");
  const brandFile = join(dir, "design/brand/brand.ts");
  writeFileSync(brandFile, readFileSync(brandFile, "utf8").replace('// links: { website: "https://example.com" },', 'links: { website: "https://facts.example.org" },'));
  assert.equal(run(dir, "new", "graphic", "post").status, 0);
  const frame = join(dir, "design/post/artboards/01-main.tsx");
  const write = (fact: string) =>
    writeFileSync(frame, `import { Artboard, Fact, Text } from "ided";\n\nexport default function Main() {\n  return (\n    <Artboard surface="paper">\n      <Text type="body">\n        Visit <Fact name="${fact}" />\n      </Text>\n    </Artboard>\n  );\n}\n`);

  write("links.website");
  const ok = JSON.parse(run(dir, "check", "post", "--json").stdout).issues as { severity: string; rule: string }[];
  assert.deepEqual(ok.filter((i) => i.severity === "error"), []);

  write("links.blog");
  const bad = JSON.parse(run(dir, "check", "post", "--json").stdout).issues as { rule: string; line?: number }[];
  assert.ok(bad.some((i) => i.rule === "ts2322" || i.rule === "invalid-token"), "unknown fact is an error");

  assert.match(run(dir, "brand").stdout, /links\.website\s+https:\/\/facts\.example\.org/);
  assert.equal(run(dir, "export", "brand", "--out", "out").status, 0);
  const kit = join(dir, "out/facts-co-brand-kit");
  assert.ok(existsSync(join(kit, "facts.json")));
  assert.equal(JSON.parse(readFileSync(join(kit, "facts.json"), "utf8")).links.website, "https://facts.example.org");
});
