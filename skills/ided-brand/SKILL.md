---
name: ided-brand
description: Build or change the design system of an ided workspace (design/brand/brand.ts and its logo SVGs): colors and surfaces, spacing and radius scales, type scale, fonts, logo mark, wordmark, lockups, colorways, and the exported brand kit. Use when the user asks to set up a brand, change brand colors, fonts or spacing, import a logo, add a token, fix brand errors from `ided check brand`, or publish the brand kit.
---

# ided-brand: the design system

`design/brand/brand.ts` is the only place a raw value may appear. Everything else in the
workspace refers to it by name, so a change here propagates to every deck, document, graphic
and the exported kit at once. Treat edits here as design decisions: make them deliberately,
explain them, and check the consequences with `ided check` (which re-audits every artifact).

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
the brand may contain fonts.

**Shared images.** Photos and illustrations that are part of the identity go in the brand's
`assets/` and are imported anywhere as `@brand/assets/<file>`. Campaign- or team-specific material
belongs in a library instead, so the brand stays small. The fallback stack is for resilience, not design.

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
