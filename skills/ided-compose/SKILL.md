---
name: ided-compose
description: Layout, typography and visual-hierarchy judgment for composing ided frames (slides, document pages, graphics, web screens) from primitives and brand tokens. Use when designing or reviewing the content and composition of any ided artifact, e.g. "make a deck about X", "design a one-pager", "this slide feels cluttered", "improve the hierarchy", "make it look more professional".
---

# ided-compose: making it good within the rules

The framework guarantees consistency: correct tokens, legible contrast, concentric corners.
It cannot guarantee a good composition. That is your job, and these are the rules of thumb.
Always finish by looking at a screenshot (`ided screenshot`) and critiquing it honestly.

## Hierarchy

- **One focal point per frame.** One `display` or `title`, never two. If everything is big, nothing is.
- **Skip a step between levels.** Pair `title` with `subhead` or `body`, not `heading`. Adjacent
  scale steps read as the same level, just slightly off.
- **Three levels are usually enough:** headline, supporting text, meta (`label`).
- **Color is hierarchy too.** Secondary text uses `color="muted"`. Use the accent for one idea
  per frame, typically an `<Em color="accent">` on the key phrase, not for decoration.

## Space

- **Proximity shows grouping.** Gaps grow with structural level: inside a group `s`/`m`,
  between a heading and its content `l`/`xl`, between groups `2xl`–`4xl`. A frame whose gaps are
  all equal has no structure.
- **Let the margin do its job.** Roots already pad by the brand margin. Don't wrap frame
  content in a padded `Box` to push it in further.
- **Use `justify="between"`** on the root to pin a header to the top and a footer to the bottom,
  and `grow` for the region that should absorb leftover space.
- **Whitespace is not waste.** On slides, a headline and three short lines is a full slide.

## Alignment and grid

- **Everything aligns to something.** Content edges sit on the frame margin; columns share edges.
  `Place` is for chrome (logos, marks, page furniture), never for positioning content.
- **Equal columns: `Grid`. Unequal: `Row` with fractions** (`1/3` + `grow`, `2/5` + `3/5`).
  Fractions account for gaps, so columns meet their edges exactly.
- **Align text to the start.** Centered text is for short, symmetric compositions (a cover, a quote), not paragraphs.

## Consistency across frames and media

- **Chrome is a component.** Logo corner, footer, page number: one component in
  `design/brand/components/`, used by every frame in every project. A logo 64px from the corner
  on a slide is 64px from the corner on a page, because it is the same component and the same token.
- **Repeated patterns are components with data.** Three stat cards means one `Stat` component and
  an array, never three hand-written copies that can drift.
- **Shared patterns live in a library.** When a second project needs a component or image, move
  it into a library (`ided new library kit`, `ided use <project> kit`) instead of copying it. Two
  copies are two versions of the truth.
- **Same role, same token.** If section titles are `heading` on one slide, they are `heading` on all of them.

## Per medium

**Decks (1920×1080).** One idea per slide, stated in the headline as a sentence ("Churn fell 40%",
not "Churn"). Body copy at `subhead` or `body`, never smaller than `small` except labels. At most
5–6 list items. Alternate surfaces (paper / sand / ink) to give sections rhythm; use the dark
surface for title and section-divider slides.

**Docs (pages, 2× density).** `body` for running text, and keep the measure readable: text columns
around `2/3` of the page width, or a `size` token such as `measure`. Headings `heading`/`subhead`.
Every page gets the same furniture: a running header or `CornerMark`, and a page number via `<FrameNumber>`.

**Graphics (social/print).** Fewer words than you think: a display line, a supporting line,
the logo. Keep important content away from edges (the margin handles this). Test legibility at
thumbnail size: screenshot at `--scale 0.25` and check that it still reads.

**Web screens.** Real content structure: navigation row, hero, sections with consistent vertical
rhythm (`4xl`–`6xl` between sections). Keep line length readable with fractional widths.

## Self-review checklist (before calling it done)

1. `ided check` is clean.
2. Screenshot every changed frame and look at it at full size and small.
3. Can you name the single focal point of each frame? Is it the biggest or most contrasting thing?
4. Do gaps get larger as structure gets coarser?
5. Does every edge line up with something?
6. Is the accent used once, on purpose?
7. Would removing any element make the frame better? If so, remove it.
