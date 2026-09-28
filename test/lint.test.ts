import assert from "node:assert/strict";
import { test } from "node:test";
import { lintFile } from "../src/check/lint.ts";
import type { Project } from "../src/core/workspace.ts";

const root = "/ws";
const project: Project = {
  id: "deck",
  dir: "/ws/design/deck",
  kind: "deck",
  title: "Deck",
  manifest: { kind: "deck", title: "Deck" },
  geometry: null,
  frames: [],
  components: [],
  assets: [],
  dependencies: ["kit"],
  issues: [],
};
const packages = new Map([
  ["brand", "brand"],
  ["deck", "deck"],
  ["kit", "library"],
  ["other-lib", "library"],
  ["other-deck", "deck"],
]);
const lintAll = (code: string, role: "frame" | "component" | "brand" = "frame", file = "/ws/design/deck/slides/01-a.tsx") =>
  lintFile(file, code, role, project, root, packages);
const lint = (...args: Parameters<typeof lintAll>) => lintAll(...args).map((i) => i.rule);

test("a canonical frame is clean", () => {
  const code = `import { Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";
import { Stat } from "@deck/components/stat";
import { Card } from "@kit/components/card";
import hero from "@kit/assets/photos/hero.jpg";

const rows = [{ v: "41%", l: "growth" }];

export default function Title() {
  return (
    <Slide surface="paper" gap="l">
      <CornerMark />
      <Stack gap="m">
        <Text type="title">Grew 41% this year</Text>
        {rows.map((r) => <Stat key={r.l} value={r.v} label={r.l} />)}
        <Card title="x" body="y" image={hero} />
      </Stack>
    </Slide>
  );
}
`;
  assert.deepEqual(lint(code), []);
});

test("escape hatches are each caught", () => {
  const code = `import { Slide } from "ided";
import styled from "styled-components";
// @ts-ignore
export default function Bad() {
  const [x] = useState(Math.random());
  const now = new Date();
  const w = window.innerWidth;
  const v = 1 as unknown as any;
  return (
    <Slide surface="paper" gap={16}>
      <div className="p-4" style={{ padding: "16px", color: "#ff0000" }}>loose</div>
    </Slide>
  );
}
export const extra = 1;
`;
  const rules = new Set(lint(code));
  for (const r of ["imports", "no-escape-hatch", "pure", "deterministic", "no-html", "no-raw-values", "frame-export"]) {
    assert.ok(rules.has(r), `expected ${r} in ${[...rules].join(", ")}`);
  }
});

test("copy that mentions numbers is not a raw value", () => {
  const code = `import { Slide, Text } from "ided";
export default function A() {
  return <Slide surface="paper"><Text type="body">Up 50% from 16px icons</Text></Slide>;
}
`;
  assert.deepEqual(lint(code), []);
});

test("loose text in layout primitives is caught", () => {
  const code = `import { Slide, Stack } from "ided";
export default function A() {
  return <Slide surface="paper"><Stack>hello</Stack></Slide>;
}
`;
  assert.ok(lint(code).includes("loose-text"));
});

test("imports are package paths to declared dependencies", () => {
  const imports = (line: string) => lintAll(`import { Slide } from "ided";\n${line}\nexport default function A() { return <Slide surface="paper" />; }\n`).filter((i) => i.rule === "imports");
  assert.equal(imports('import x from "@kit/assets/logo-grid.svg";').length, 0);
  assert.equal(imports('import { X } from "@brand/components/x";').length, 0);
  // relative imports are rejected, with the package path as the fix
  const rel = imports('import { Stat } from "../components/stat";');
  assert.equal(rel.length, 1);
  assert.match(rel[0]!.hint!, /"@deck\/components\/stat"/);
  // frames are never importable, undeclared libraries and other decks are not dependencies
  assert.equal(imports('import Other from "@deck/slides/02-other";').length, 1);
  assert.match(imports('import { X } from "@other-lib/components/x";')[0]!.hint!, /ided use deck other-lib/);
  assert.equal(imports('import { X } from "@other-deck/components/x";').length, 1);
  assert.equal(imports('import { X } from "@nope/components/x";').length, 1);
  assert.equal(imports('import f from "@brand/assets/fonts/inter.woff2";').length, 1);
  assert.equal(imports('import { X } from "@kit/components/x.tsx";').length, 1);
});

test("component files use named PascalCase exports", () => {
  assert.deepEqual(lint(`import { Text } from "ided";\nimport { Card } from "@kit/components/card";\nexport function Callout(props: { t: string }) { return <Text type="body">{props.t}</Text>; }\n`, "component", "/ws/design/deck/components/callout.tsx"), []);
  assert.ok(lint(`import { Text } from "ided";\nexport default function Callout() { return <Text type="body">x</Text>; }\n`, "component", "/ws/design/deck/components/callout.tsx").includes("component-export"));
});

test("brand.ts must stay declarative", () => {
  const ok = `import { defineBrand } from "ided";\nexport default defineBrand({ name: "X" });\n`;
  assert.deepEqual(lint(ok, "brand", "/ws/design/brand/brand.ts"), []);
  const bad = `import { defineBrand } from "ided";\nconst c = "#fff";\nexport default defineBrand({ name: c });\n`;
  assert.ok(lint(bad, "brand", "/ws/design/brand/brand.ts").includes("brand-export"));
});
