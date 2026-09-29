# ided rules and primitive reference

ided is parametric graphic design: every artifact is a React function composed from a
fixed set of primitives, and every value is a token from `design/brand/brand.ts`. There is
exactly one way to express each design decision. `ided check` enforces all of it.

## The laws

1. **Every value is a token.** No px, rem, %, hex, rgb, font names or numbers in artifacts.
   If a value is missing, add a token to `brand.ts`. Never approximate with a nearby one.
2. **Only primitives.** No HTML (`<div>`), no `style`, no `className`, no CSS, no npm imports.
3. **Text is a type style.** `<Text type="body">`. Size, weight, leading and tracking come as one unit.
4. **Space is `gap`, padding is `Box pad`.** No margins, no spacers, no empty boxes for spacing.
5. **Backgrounds are surfaces.** A surface declares its own text and logo color, so text on it is legible by construction.
6. **Nested corners are concentric.** Inside a padded, rounded `Box`, use `radius="concentric"`.
7. **Facts come from the brand too.** Names, links, contact details and places are `<Fact>`s from
   the brand's `facts`, never typed, so they are written once and cannot be invented.
8. **Artifacts are pure and deterministic.** No hooks, no state, no dates, no randomness, no browser APIs.
9. **The shape of the workspace is fixed.** Create things with `ided new` / `ided add`; never invent folders.
   Every project has a `DESIGN.md` explaining its design (see the ided-design skill).
10. **Every import names its package.** `"ided"`, or `@<package>/components/<name>` / `@<package>/assets/<file>`. No relative imports.

## Workspace shape

```
<repo>/
  ided.json                    # workspace marker
  design/
    tsconfig.json              # extends .ided/ (generated, gitignored)
    brand/                     # exactly one, always this name; every project may import it
      project.json             # { "kind": "brand", "title": "…" }
      DESIGN.md                # what the identity means and why it looks the way it does
      brand.ts                 # export default defineBrand({ … })
      assets/                  # mark.svg, wordmark.svg, fonts/, shared images
      components/              # chrome shared by every medium
    kit/                       # a library: shared components and assets, no frames
      project.json             # { "kind": "library", "title": "…", "dependencies": [] }
      DESIGN.md                # purpose, contents, rules
      components/  assets/
    <project>/                 # kebab-case
      project.json             # { "kind": "deck" | "doc" | "graphic" | "web", "title", "dependencies": ["kit"], … }
      DESIGN.md                # brief, message, concept, hierarchy, decisions, alternatives, critique
      slides/ | pages/ | artboards/ | screens/   # NN-name.tsx, ordered by number
      components/              # kebab-case.tsx, named exports (private to this project)
      assets/                  # images (private to this project)
      comments.json            # review comments (written by the viewer)
```

**Packages.** Every project folder is a package named by its folder. A file may import from
its own package, from `brand`, and from the libraries listed in its `project.json`
`"dependencies"` (add one with `ided use <project> <library>`). Only libraries can be
dependencies; decks, docs, graphics and web projects are never imported. Dependencies may not
form a cycle. There are no versions: everything in the repo is used at its current state.

**Assets.** Images live in a package's `assets/` (kebab-case names and folders; png, jpg, jpeg,
webp, avif, gif, svg). SVGs may only use the brand's color values (alpha allowed). Only the brand has `assets/fonts/`. Assets are imported, and every file
has an exact generated type, so a misspelled or missing file is a compile error:

```tsx
import hero from "@kit/assets/photos/hero.jpg";
<Image src={hero} alt="Launch day" ratio="16:9" />
```

Reuse goes up, not sideways: if two projects need the same image or component, move it to a
library (or to the brand, if it is part of the identity), never import across projects.

| kind    | frames in    | root primitive | size (design px)                                             | manifest extra                                   |
|---------|--------------|----------------|--------------------------------------------------------------|--------------------------------------------------|
| deck    | `slides/`    | `<Slide>`      | 1920×1080                                                    | none                                             |
| doc     | `pages/`     | `<Page>`       | letter 1632×2112, a4 1588×2246 (2×, prints at true size)     | `"page": "letter" \| "a4"`                       |
| graphic | `artboards/` | `<Artboard>`   | square 1080², portrait 1080×1350, story 1080×1920, landscape 1920×1080, og 1200×630, banner 1500×500 | `"size": …` |
| web     | `screens/`   | `<Screen>`     | desktop 1440, tablet 834, mobile 390 wide; height grows      | `"viewport": …`                                  |

## File shapes

A **frame** has exactly one default-exported, prop-less, PascalCase function returning its root:

```tsx
import { Slide, Stack, Text } from "ided";
import { CornerMark } from "@brand/components/corner-mark";
import { Stat } from "@q3-review/components/stat";

export default function Results() {
  return (
    <Slide surface="paper" justify="between">
      <CornerMark />
      <Text type="heading">Q3 results</Text>
      <Stat value="41%" label="growth" />
    </Slide>
  );
}
```

A **component** file exports PascalCase functions (named, not default). Props are typed with
token types from `ided` so callers cannot pass raw values either:

```tsx
import { Box, Stack, Text, type SurfaceToken } from "ided";

export function Stat(props: { value: string; label: string; surface?: SurfaceToken }) {
  return (
    <Box surface={props.surface ?? "paper"} pad="2xl" radius="l">
      <Stack gap="m">
        <Text type="display">{props.value}</Text>
        <Text type="body" color="muted">{props.label}</Text>
      </Stack>
    </Box>
  );
}
```

Imports allowed: `"ided"` and package paths `@<package>/components/<name>` / `@<package>/assets/<file>`,
where the package is this project, `brand`, or a declared dependency. A project's own files use
its own name too: `@q3-review/components/stat`.

## Primitives

Keywords shown in quotes are framework keywords; everything else is a brand token name.
`Extent` = `"auto" | "full" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | <size token>`.
Fractions subtract the parent's gap, so `1/3 + 2/3` inside a `Row gap="l"` fills exactly.

### Roots: `Slide` `Page` `Artboard` `Screen`
The outermost element of a frame. Fills the frame, pads it by the brand margin for the medium, and lays children out as a column.
- `surface` **required** surface token
- `gap?` space | `"none"`, `align?` `"start" | "center" | "end" | "stretch"`, `justify?` `"start" | "center" | "end" | "between"`

### `Stack` (vertical) and `Row` (horizontal)
Layout only: no background, no padding.
- `gap?`, `align?`, `justify?`, `width?` Extent, `height?` Extent, `grow?` boolean (take remaining space)
- `Row` also: `wrap?` boolean

### `Grid`
Equal columns. For unequal columns use `Row` with fractional widths.
- `columns` **required** `1 | 2 | 3 | 4 | 5 | 6 | 12`, `gap?`, `width?`, `height?`, `grow?`

### `Box`
Decoration: surface, padding, corners, border, shadow. **At most one child**; put a `Stack`/`Row` inside for several.
- `surface?` surface token (children inherit its text and logo colors)
- `pad?` space | `[vertical, horizontal]`
- `radius?` radius token | `"full"` | `"concentric"` (parent radius minus parent padding)
- `border?` stroke token + `borderColor?` color token (both or neither)
- `shadow?` shadow token, `ratio?` `"1:1" | "4:3" | "3:2" | "16:9" | "21:9" | "3:4" | "2:3" | "9:16"`
- `width?`, `height?`, `grow?`
- `bleed?` `"top" | "bottom" | "left" | "right" | "x" | "y" | "all"` or a list of them: the Box runs
  past the frame margin to that edge, while its content stays aligned to the margin. Only on a
  direct child of the root; `"top"` only on the first child and `"bottom"` only on the last; a
  narrower Box bleeds only toward the side the root aligns it to. Bled corners are square (no
  `radius`). Use it for color bands, split frames and full-bleed images.

### `Place`
Pins one child to an anchor of the enclosing `Box` or frame, outside the flow. Use it for chrome (logos, page marks), not for layout.
- `anchor` **required** `"top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right"`
- `inset` **required** space | `"margin"` (the frame's content edge) | `"none"`

### `Text`
All copy. Children: strings, numbers, `<Em>`, `<Fact>`, `<Equation>`, `<FrameNumber>`.
- `type` **required** type token, `color?` color token (default: the surface's text color), `align?` `"start" | "center" | "end"`

### `Em`
Emphasis inside `Text`: the style's emphasis weight. `color?` color token (checked for contrast at the Text's size).

### `FrameNumber`
Current slide/page number inside `Text`. `format?` `"n"` (3) | `"nn"` (03) | `"n/total"` (3 / 12).

### `Fact`
A fact from the brand's `facts`, inside `Text`: names, links, contact details, locations, social
handles, abbreviations. Links, emails, phone numbers and domains typed by hand fail `ided check`.
- `name` **required**: `"<group>.<key>"`, e.g. `"links.signup"`, `"contact.email"`, `"locations.studio"`
- `format?`: links `"display"` (default, `kilnandcopper.com`) | `"full"`; locations `"line"` (default,
  street and city) | `"city"` | `"street"` | `"full"`; abbreviations `"short"` (default, `MW`) | `"long"`
  (`megawatt`) | `"both"` (`megawatt (MW)`)

```tsx
<Text type="body">Sign up at <Fact name="links.signup" /> or call <Fact name="contact.phone" />.</Text>
```

### `Equation`
Math set from TeX (KaTeX), inside `Text`. The Text gives it size, color and alignment; there is
no other way to size an equation. Inline by default; `display` sets it on its own line with
full-size fractions and limits above and below (make it the Text's only child).
- `tex` **required** TeX math. In a JSX string attribute a backslash is written once:
  `tex="\frac{a}{b}"`
- `display?` boolean
- Color parts with brand tokens: `\textcolor{accent}{x}` or `\color{accent}`. Size, spacing,
  boxes and links (`\Huge`, `\hspace`, `\kern`, `\rule`, `\colorbox`, `\href`…) are rejected.

```tsx
<Text type="body">The area is <Equation tex="\pi r^2" />.</Text>
<Text type="title" align="center">
  <Equation display tex="\sum_{n=1}^{\infty} \frac{1}{n^2} = \textcolor{accent}{\frac{\pi^2}{6}}" />
</Text>
```

### `List`
- `type` **required**, `items` **required** `string[]`, `marker?` `"bullet" | "number" | "dash"`, `gap?`, `color?`

### `Logo`
Composed from the brand's mark and wordmark.
- `variant` **required** `"mark" | "wordmark" | <lockup name>`, `size` **required** logo size token
- `colorway?` colorway token (default: the one the current surface declares)

### `Image`
- `src` **required**, an imported asset (`import team from "@kit/assets/team.jpg"`), `alt` **required**
- `ratio?`, `fit?` `"cover" | "contain"`, `radius?` (as Box), `width?`, `height?`, `grow?`

### `Divider`
A rule, horizontal in a `Stack` and vertical in a `Row`. `color` **required** color token, `weight` **required** stroke token.

## Recipes

```tsx
// Logo in the same corner, same inset, in every medium: use the brand component.
<CornerMark />                                  // = <Place anchor="top-right" inset="margin"><Logo variant="mark" size="s" /></Place>

// Asymmetric two columns
<Row gap="4xl" align="start">
  <Stack gap="l" width="1/3">…</Stack>
  <Stack gap="l" grow>…</Stack>
</Row>

// Header / content / footer on a slide
<Slide surface="paper" justify="between">…header… …content… <Footer label="Acme" /></Slide>

// Card with an inset image whose corners follow the card's
// (import team from "@q3-review/assets/team.jpg";)
<Box surface="sand" pad="l" radius="xl">
  <Stack gap="l">
    <Image src={team} alt="The team at the offsite" ratio="16:9" radius="concentric" />
    <Text type="subhead">Offsite 2026</Text>
  </Stack>
</Box>

// Repeated content is data mapped through a component
{stats.map((s) => <Stat key={s.label} value={s.value} label={s.label} />)}
```

## When `ided check` complains

| rule | meaning | fix |
|---|---|---|
| `ts2322`, `invalid-token` | value is not a token of that kind | pick from the listed tokens (`ided brand`), or add one to `brand.ts` |
| `no-raw-values` | a CSS-looking literal (`16px`, `#fff`, `calc(`) | use a token |
| `no-html`, `ts2339` | an HTML element | use a primitive |
| `no-escape-hatch` | `style`, `className`, `any`, `@ts-ignore`, … | remove it; express the intent with primitives and tokens |
| `loose-text` | raw text inside a layout primitive | wrap in `<Text type="…">` |
| `box-children` | Box with several children | put a `Stack`/`Row` inside the Box |
| `contrast` | text or logo not legible on its surface | use the surface's default text color, or a different surface |
| `concentric` | nested radius does not share the parent's corner center | `radius="concentric"` |
| `bleed` | a Box bleeds to an edge it cannot touch (nested, not first/last, aligned away) or has a radius | make it the root's first/last child, span the width, or drop that side |
| `imports` | relative import, undeclared package, or a non-importable path | `@<package>/components/<name>` or `@<package>/assets/<file>`; `ided use <project> <library>` to declare a library |
| `ts2307` on an asset | the asset file does not exist | check the name (`ided list` shows every asset) |
| `asset-name`, `asset-type` | asset file or folder breaks the naming/format rules | rename to kebab-case; images only (fonts only in the brand) |
| `equation` | TeX that does not parse, or a command that sets size, spacing, boxes or links | fix the TeX; size comes from the Text's type style |
| `svg-colors` | an SVG asset uses a color that is not in the brand (error) or one ided cannot read, like `hsl()` (warning) | recolor it with the brand hex values the message suggests; add a color to brand.ts only if the brand truly needs it |
| `dependencies` | unknown, non-library, self or cyclic dependency | depend only on libraries; move shared pieces down into a library |
| `no-raw-facts` | a URL, email, phone number or domain typed into an artifact | `<Fact name="…" />`; if the brand lacks it, add it to `facts` in brand.ts or ask, never invent one |
| `comments` | an open review comment points at a file or frame that no longer exists (warning) | address it and `ided comments resolve <id> -m …`, or have the reviewer leave it again |
| `design-doc` | DESIGN.md missing (error), a section heading missing (error), or sections not written yet (warning) | write each section; its prompt says what it must answer |
| `pure`, `deterministic` | hooks, globals, `Date`, `Math.random` | hard-code data; artifacts are pure |
| `frame-export`, `component-export` | wrong file shape | see "File shapes" |
| `structure`, `frame-name`, `manifest` | workspace shape is off | use `ided new` / `ided add`; frames are `NN-name.tsx` |
| `missing-root`, `wrong-root` | frame does not return its kind's root | return `<Slide>` / `<Page>` / `<Artboard>` / `<Screen>` |

Suppressing a rule is not possible and not wanted. If a rule blocks a legitimate design, the
brand is missing a token: add it to `brand.ts`, where it becomes available everywhere at once.
