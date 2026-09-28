import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, workspace } from "./helpers.ts";

const frame = (body: string, rootProps = "") =>
  `import { Box, Row, Slide, Stack, Text } from "ided";\n\nexport default function Main() {\n  return (\n    <Slide surface="paper"${rootProps}>\n${body}\n    </Slide>\n  );\n}\n`;

test("bleed is allowed only where the Box touches that edge", { timeout: 120_000 }, () => {
  const dir = workspace("--bare");
  run(dir, "new", "deck", "d");
  const file = join(dir, "design/d/slides/01-title.tsx");
  const bleedErrors = (body: string, rootProps = "") => {
    writeFileSync(file, frame(body, rootProps));
    const issues = JSON.parse(run(dir, "check", "d", "--json").stdout).issues as { rule: string; message: string }[];
    return issues.filter((i) => i.rule === "bleed").map((i) => i.message);
  };
  const band = (bleed: string, extra = "") => `      <Box surface="ink" bleed=${bleed} pad="l"${extra}>\n        <Text type="body">band</Text>\n      </Box>`;
  const text = `      <Text type="body">text</Text>`;

  assert.deepEqual(bleedErrors(`${band(`{["top", "x"]}`)}\n${text}`), [], "first child may bleed up and sideways");
  assert.deepEqual(bleedErrors(`${text}\n${band(`{["bottom", "x"]}`)}`), [], "last child may bleed down");
  assert.deepEqual(bleedErrors(band('"all"')), [], "an only child may bleed everywhere");
  assert.deepEqual(bleedErrors(band('"left"', ' width="1/2"'), ' align="start"'), [], "a half-width box at the left edge may bleed left");

  assert.match(bleedErrors(`${text}\n${band('"top"')}`).join(), /not the first thing/);
  assert.match(bleedErrors(`${band('"bottom"')}\n${text}`).join(), /not the last thing/);
  assert.match(bleedErrors(band('"right"', ' width="1/2"')).join(), /does not reach the right edge/);
  assert.match(bleedErrors(band('"top"', ' radius="l"')).join(), /corners are square/);
  assert.match(bleedErrors(`      <Stack>\n  ${band('"top"')}\n      </Stack>`).join(), /direct child of the frame's root/);
});
