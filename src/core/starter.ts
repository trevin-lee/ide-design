// What `ided init` writes besides the brand tokens: the sample deck and the
// design documents for it and for the starter brand. They are the first ided
// work anyone sees, so they model the practice the skills teach: an idea from
// the subject's world, one focal point per slide, and a rationale that traces
// every decision back to the brief.

export function sampleSlides(): Record<string, string> {
  return {
    "01-statement.tsx": `import { Logo, Slide, Stack, Text } from "ided";

export default function Statement() {
  return (
    <Slide surface="ink" justify="between">
      <Logo variant="horizontal" size="m" />
      <Stack gap="xl" width="3/4">
        <Text type="display">Design as code.</Text>
        <Text type="subhead">Every value here comes from one file. Change it, and everything follows.</Text>
      </Stack>
    </Slide>
  );
}
`,
    "02-one-way.tsx": `import { Divider, Row, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

const decisions = [
  { code: 'gap="l"', meaning: "24 pixels, the same on every slide, page, post and screen." },
  { code: '<Text type="body">', meaning: "Size, weight, leading and tracking chosen once, as a unit." },
  { code: 'surface="ink"', meaning: "A background that brings its own legible text and logo colors." },
  { code: 'radius="concentric"', meaning: "An inner corner computed from the corner around it." },
];

export default function OneWay() {
  return (
    <Slide surface="paper" gap="4xl">
      <CornerMark />
      <Stack width="2/3">
        <Text type="title">There is one way to write each design decision.</Text>
      </Stack>
      <Stack gap="xl">
        {decisions.map((d) => (
          <Stack key={d.code} gap="xl">
            <Divider color="line" weight="hairline" />
            <Row gap="2xl" align="start">
              <Stack width="1/3">
                <Text type="code">{d.code}</Text>
              </Stack>
              <Stack grow>
                <Text type="body">{d.meaning}</Text>
              </Stack>
            </Row>
          </Stack>
        ))}
      </Stack>
    </Slide>
  );
}
`,
    "03-the-check.tsx": `import { Box, Em, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function TheCheck() {
  return (
    <Slide surface="paper" gap="3xl" justify="center">
      <CornerMark />
      <Stack width="2/3">
        <Text type="title">An off-brand value does not compile.</Text>
      </Stack>
      <Box surface="ink" pad={["2xl", "3xl"]} radius="l">
        <Stack gap="s">
          <Text type="code">$ ided check</Text>
          <Text type="code">design/intro/slides/02-one-way.tsx</Text>
          <Text type="code">
            {"  "}9:14 <Em color="accent">error</Em> {'<Stack> \`gap\` got "16px", which is not a space token.'}
          </Text>
          <Text type="code">{"       → Use one of: none, 2xs, xs, s, m, l, xl, 2xl, 3xl, 4xl, 5xl, 6xl."}</Text>
        </Stack>
      </Box>
    </Slide>
  );
}
`,
    "04-concentric.tsx": `import { Box, Row, Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function Concentric() {
  return (
    <Slide surface="paper" justify="center">
      <CornerMark />
      <Row gap="4xl" align="center">
        <Stack gap="l" width="2/5">
          <Text type="title">Corners that line up.</Text>
          <Text type="body" color="muted">
            Nested corners share a center when the inner radius is the outer radius minus the padding
            between them. Write radius="concentric" and the framework does the arithmetic, at any size.
          </Text>
        </Stack>
        <Box surface="ink" pad="l" radius="xl" grow>
          <Box surface="accent" pad="m" radius="concentric" ratio="16:9">
            <Box surface="paper" pad="l" radius="concentric" grow>
              <Text type="code">radius="concentric"</Text>
            </Box>
          </Box>
        </Box>
      </Row>
    </Slide>
  );
}
`,
  };
}

export function sampleDesignDoc(): string {
  return `# Design as Code

The sample deck \`ided init\` writes. It is here to be read, presented and taken apart; delete the
project when you no longer need it.

## Brief

Seen by a developer minutes after running \`ided init\`, in the viewer, before they have written a
frame. They already believe design tools are loose (anything can be dragged anywhere) and that
"design systems" are documents people ignore. The real problem is trust: they need to believe
the rules are enforced, not suggested, and that working this way is worth the constraint.
Constraints: four slides, the starter brand, no product screenshots.

## Message

Get a developer who just installed ided to trust that design can be held to the same standard as
code, by showing the rules as code and the checker enforcing them.

## Concept

The deck is made of the material it describes. Its evidence is literal code and a literal
compiler error, set as type, the way a developer meets them in an editor and a terminal, rather
than diagrams or cards about code.

## Hierarchy

1. The claim on each slide, stated as a sentence.
2. The code or the error that proves it.
3. The mark in the corner, identical on every light slide.

Across the deck: the statement, then the rules, then the enforcement, then one principle shown
working (concentric corners), which is the part people remember.

## Decisions

- Structure: \`statement-sequence\` opening into \`ledger\` (slide 2) and \`document-fragment\`
  (slide 3), then \`one-object\`.
- Headlines are full sentences in \`title\`; nothing else on a slide competes with them. Evidence
  is set in \`code\` because it is code, and in \`body\` where it is explanation.
- Color strategy: restrained, with a dark opening. \`ink\` opens the deck and frames the terminal
  output; everything else sits on \`paper\`. The \`accent\` has one job: it marks where the system
  acts on your work (the error, the computed middle ring). It is never used to highlight words.
- The ledger on slide 2 uses hairline rules because they are table rules separating records, not
  decoration.
- \`CornerMark\` on the light slides demonstrates the promise itself: the mark sits the same
  distance from the corner here as on a page or a post, because it is the same component.
- No footer or slide numbers: four slides do not need wayfinding.

## Alternatives

- A feature tour (one slide per primitive): rejected, it describes the tool instead of making the
  reader trust it, and it is what every product deck does.
- Big-number cards ("0 raw values, 16 primitives, 1 brand file"): rejected, the card row is the
  most common template in generated slides, and the numbers are claims without proof.
- A dark, terminal-themed deck throughout: rejected; it would read as a costume. One dark slide
  and one dark block keep the code real without turning it into a theme.

## Critique

- Squint: each slide's headline wins, and on slide 3 the dark block reads as the evidence.
- Swap: another tool could not use slide 3 unchanged; the error is ided's own.
- Cut: an earlier version had a label above every headline and a numbered footer; both repeated
  what the reader already knew.
- Glance: at thumbnail size the code on slides 2 and 3 was unreadable at the starter's 22px \`code\`
  size, so the brand's \`code\` style was raised to 28px, the same as \`body\`.
- Contrast: the first draft dimmed the terminal's prompt and hint lines with \`muted\`, which fails
  contrast on \`ink\`; \`ided check\` caught it, and every line now uses the surface's own text color.
- Still weak: slide 3's terminal block is wider than its longest line, which leaves a dead area on
  the right.
`;
}

export function starterBrandDesignDoc(name: string): string {
  const n = name;
  return `# ${n} identity

This is ided's starter identity, written for ${n} by \`ided init\`. It is a working placeholder: a
coherent system you can design with today, and the first thing to replace. The ided-brand skill
walks through making it yours; rewrite each section below as you do.

## Positioning

Not yet written for ${n}. Until it is, the starter assumes a clear, practical organization that
wants to be taken seriously without looking corporate: precise, not cold; direct, not loud;
modern, not trendy.

## Category

Unknown until ${n}'s category is named. The starter avoids the most common generated palettes
and marks on purpose, but it cannot avoid ${n}'s competitors without knowing who they are. Write
down what they all look like before changing anything else.

## Concept

The starter's idea is ided's own: things that line up. The mark's dot shares its center with the
corner it sits in, spacing and line heights share one 4px grid, and nested corners are
concentric. Replace it with an idea from ${n}'s own world.

## Mark

A rounded square with a circle cut from its top-right corner, concentric with the corner's arc.
It is built from two measurements (a 30-unit corner radius and a 14-unit inset), reads as a
single shape at 16px, and needs no second color. The wordmark is generated from the name in a
monoline geometric alphabet, stroked at the weight of the mark's cut. Both are placeholders:
replace them with ${n}'s own mark before anything is published.

## Typography

Inter for everything, set tight at display sizes and open at text sizes, because its forms stay
neutral and legible from 18px labels to 160px statements; JetBrains Mono for code and data. One
scale serves every medium: documents render at twice the density, so \`body\` reads the same on a
slide and prints at 10.5pt.

## Color

\`paper\` leads as the ground for most work, with \`ink\` for text and for the occasional dark
frame. \`sand\` is a second, warmer ground for variety within a piece. \`accent\` is a signal,
used in small amounts for the one thing that matters most; at more than a tenth of a surface it
stops being a signal. \`muted\` is for secondary text only.

## Form

A 4px unit. Spacing climbs roughly geometrically (4 to 192) so adjacent steps are clearly
different; corners run from 8 to 48 and nest concentrically. Constant everywhere: the unit, the
margins per medium, the mark's position in \`CornerMark\`. Free to vary: composition, which ground
leads, and scale.

## Voice

Plain and specific: short sentences, concrete nouns, numbers where they exist, no superlatives.
It explains rather than sells. "Every value comes from one file." Not "A revolutionary way to
design."

## Usage

\`horizontal\` lockup where the name must be read, \`mark\` alone once the name is established or
space is tight, \`stacked\` for square and centered formats. Colorways follow the surface: each
surface names its own. Keep clear space of at least the mark's height around any lockup; never
set the logo below the \`xs\` size.

## Alternatives

None explored: this is the starter. Record the routes you consider for ${n} here, and why they
lost.
`;
}
