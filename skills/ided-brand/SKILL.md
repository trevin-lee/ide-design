---
name: ided-brand
description: Design or change the brand identity and design system of an ided workspace, the way an identity designer would. Covers positioning, the category audit, the brand idea, the mark and wordmark, type, color, spacing and radius scales, lockups and colorways, the brand's DESIGN.md (what the identity means and why), and the exported brand kit. Use when the user asks to set up, rework or "make it ours" for a brand, change brand colors, fonts or spacing, design or import a logo, add a token, fix brand errors from `ided check brand`, or publish the brand kit. Brand work happens when it is asked for; a request to design a deck, post or page is not a request to change the brand, even when the starter brand is still in place.
---

# ided-brand: the identity and the design system

`design/brand/brand.ts` is the only place a raw value may appear. Everything else in the
workspace refers to it by name, so a change here propagates to every deck, document, graphic
and the exported kit at once. Treat edits here as design decisions: make them deliberately,
explain them, and check the consequences with `ided check` (which re-audits every artifact).

`design/brand/DESIGN.md` says what the identity means: positioning, the category it departs
from, the brand idea, and the reasoning behind the mark, type, color, form and voice. Every
project's designer reads it before designing, so it is the most read document in the workspace.
`ided check` requires all its sections.

## Identity before tokens

Values are the last step. An identity designer works in this order, and so should you. The
thinking for each step goes in the brand's DESIGN.md; see the ided-design skill's
`references/design-doc.md` for how to write reasoning that convinces rather than decorates.

1. **Positioning.** Who the brand serves, what it does for them, what makes it different.
   Personality as three to five "X, not Y" pairs: "precise, not cold", "local, not quaint".
   These pairs are the test every later choice must pass.
2. **Category audit.** Write down what every competitor looks and sounds like: their colors,
   marks, type, photography, clichés (every coffee shop is kraft paper and a hand-drawn bean;
   every fintech is blue and a rounded sans). Decide deliberately where to depart and where to
   belong. A brand that looks like its category is invisible; one that looks like nothing in it
   can be confusing.
3. **The brand idea.** One line the whole identity expresses, found in the product, its method,
   its history or its place, not in a list of adjectives. Look for it in the subject's own
   world: materials, tools, processes, landscape, vernacular.
4. **The mark.** One idea, drawn simply. It identifies; it does not have to illustrate the
   business (Rand, Haviv). Tests it must pass: legible at 16px, works in one color and reversed,
   can be drawn from memory after one look, and does not resemble a well-known mark. Explore
   several routes on paper (in words) before drawing any.
5. **The system.** Type, color, form and voice derived from the idea, each by role. Decide what
   stays constant everywhere and what may vary per piece.
6. **Applications.** Before calling it done, make one real thing with it (a card, a slide, a
   post) and look at it. Identities are approved in use, not on a white page.

Change the brand only when the user asks for brand work. When they do, for example "rework the
starter brand" or "make the brand ours", everything above applies: the starter's
colors, type scale and mark are placeholders, not a foundation to preserve. Keep what survives
the category audit and the idea; replace the rest, including the mark and DESIGN.md.

## Shape

`brand.ts` is declarative: one import and `export default defineBrand({ … })` with an object
literal. No variables, functions or computed values; the lint rejects them.

```ts
defineBrand({
  name, unit,                       // unit: base grid in px (4 or 8)
  color: { paper: { value: "#FAFAF7", on: "ink", logo: "primary" }, muted: "#62626A", … },
  space: { xs: 8, s: 12, m: 16, … }, // multiples of unit, ascending
  radius: { s: 8, m: 16, … },        // multiples of unit, ascending
  stroke: { hairline: 1, thin: 2 },
  size?: { avatar: 96, … },          // fixed extents for width/height
  shadow?: { raised: "…css…" },
  font: { sans: { family, fallback, files: [{ src: "fonts/x.woff2", weight: "100 900" }] } },
  type: { display: { font: "sans", size: 160, weight: 700, leading: 0.95, tracking: -0.045 }, … },
  margin: { deck: "4xl", doc: "5xl", graphic: "3xl", web: "3xl" },
  logo: { mark: "mark.svg", wordmark: "wordmark.svg", lockups, colorways, sizes },
})
```

## Decisions and how to make them

**Unit.** 4px for dense UI-like work, 8px for bold editorial systems. Every space, radius,
size, logo size and computed line height snaps to it; `ided check` rejects off-grid values.

**Color: roles and proportions, then values.** Decide what leads (the ground most applications
sit on), what supports, and what signals, and in roughly what proportions, before choosing hex
values. Then choose values that serve the idea and depart from the category where the audit
said to. Avoid the generated-design palettes (cream with terracotta, near-black with one acid
accent) unless the idea demands them.

**Color: surfaces first.** A surface is `{ value, on, logo? }`: a background that names its
own text color and logo colorway. Only surfaces can be backgrounds, so text is legible by
construction. The `on` color must reach 4.5:1 (the checker computes it). Keep 2–4 surfaces
(light, alternate light, dark, and at most one saturated brand surface) and 1–3 foreground-only
colors (muted text, rules). Name tokens by role (`paper`, `ink`, `muted`, `line`, `accent`),
not by hue, so a palette change never makes a name a lie.

**Space.** A mostly geometric scale (×1.5 to ×2 steps) with small tight steps at the bottom:
`4 8 12 16 24 32 48 64 96 128 192`. Names are t-shirt sizes. Fewer, well-separated steps give
stronger hierarchy than many close ones.

**Type.** One scale for every medium (doc pages render at 2× so the same body size prints at
~10.5pt). Use a ratio around 1.25–1.5 between adjacent roles, declare largest to smallest,
tighten tracking and leading as size grows (display ≈ −0.04em / 0.95, body ≈ 0 / 1.45), and
set `wrap: "balance"` on headings. Uppercase labels get positive tracking (~0.08em). Line
heights snap to the unit, so choose leading and let the grid do the rest.

**Fonts.** Ship font files in `assets/fonts/` (woff2) so every machine and CI renders the same
glyphs; include the license alongside as `<font>-license.txt` (asset names are kebab-case). Only
the brand may contain fonts. The fallback stack is for resilience, not design.

Choose a typeface for what its forms do (a wide, low-contrast grotesque reads calm and
technical; a sharp, high-contrast serif reads literary and formal), and against the category
audit. To use one of the open-licensed families on npm's Fontsource packages without installing
anything in the workspace:

```sh
cd "$(mktemp -d)" && npm pack @fontsource-variable/fraunces && tar xzf *.tgz
cp package/files/fraunces-latin-wght-normal.woff2 <repo>/design/brand/assets/fonts/fraunces.woff2
cp package/LICENSE <repo>/design/brand/assets/fonts/fraunces-license.txt
```

Then declare it in `font` with its weight range (variable files: `weight: "100 900"` or the
family's actual range, listed in the package's `metadata.json`), and point the type styles at it. Check the license says SIL Open Font
License or similar before shipping it; brand kits redistribute the file.

**Shared images.** Photos and illustrations that are part of the identity go in the brand's
`assets/` and are imported anywhere as `@brand/assets/<file>`. Campaign- or team-specific material
belongs in a library instead, so the brand stays small.

**Radius.** Ascending scale. Nested corners use `radius="concentric"` in artifacts, so the
scale only needs outer radii.

## Logos

The mark and wordmark are separate SVG files in `design/brand/assets/`, and lockups are
composed from them by rule. Requirements the checker enforces:

- Single color, drawn with `currentColor` (fill or stroke). Colorways recolor them.
- A `viewBox`, cropped tight to the artwork (no built-in padding; clear space is a layout concern).
- No `<text>` (convert type to outlines) and no embedded raster images.

To import a logo the user provides: crop the viewBox to the artwork, replace every fill/stroke
color with `currentColor` (a multi-color logo needs to become one mark per color or a
single-color version), remove `width`/`height` attributes, and split mark and wordmark into
two files if they arrive as one lockup.

**Lockups** are relative to the wordmark height, so they are scale-free:
`{ direction: "row" | "column", mark: <mark height ÷ wordmark height>, gap: <gap ÷ wordmark height>, align }`.
Typical: horizontal `mark ≈ 1.8–2.4, gap ≈ 0.8–1.2`; stacked `mark ≈ 3–4, gap ≈ 1–1.4`.

**Colorways** map mark and wordmark to color tokens (`primary`, `reversed`, `black`, `white`).
Each surface names its default colorway via `logo`, which is what `<Logo>` uses unless told
otherwise. The checker requires 3:1 logo contrast on the surface.

**Sizes** are rendered heights in px, on the unit grid.

## Verify, then publish

1. `ided check`: brand validation plus a re-audit of every artifact. A palette change can
   break contrast in a deck three folders away, and this is where you find out.
2. Open the Brand page in `ided run`: logos in every colorway, surfaces with contrast ratios,
   the type scale at size, space and radius scales.
3. `ided export brand --zip` writes `out/<brand>-brand-kit/`: `logos/<variant>/<variant>-<colorway>.svg`
   plus 128/512px PNGs, `tokens/tokens.css`, `tokens/tailwind.css` (a Tailwind v4 theme that
   *replaces* the default palette and scales, so downstream apps can only use brand values),
   `tokens/tokens.json` (DTCG), `tokens/brand.ts`, `fonts/`, and a README.
4. `ided ci` writes a GitHub Actions workflow that exports the kit on every change to
   `design/brand/` and syncs it to a bucket, so deployed sites that import `tokens.css` from
   that URL update themselves.
