---
name: ided
description: Create and edit design artifacts (slide decks, documents, social graphics, web screens, brand systems) in an ided workspace, where design is written as token-only React components and verified by `ided check`. Use whenever the repository has an ided.json file or a design/ folder with project.json files, or when the user asks for slides, a deck, a one-pager, a document, a poster, a social post, a landing page mock, a logo lockup or brand assets in such a repo. Also use to set up ided in a repository (`ided init`), to create a new ided project, deck, document, graphic, web mock or shared library (`ided new`), and to address review comments left in the ided viewer.
---

# ided: design as code

In an ided workspace every artifact is a pure React function built from 19 primitives, and
every value (color, space, radius, type, logo) is a named token from `design/brand/brand.ts`.
There is one way to do each thing, and `ided check` rejects anything else. That is the point:
the output is consistent because nothing can drift from the brand.

Consistency is the floor, not the goal. This skill covers the mechanics; the design thinking
(brief, message, concept, hierarchy, critique) lives in the **ided-design** skill, and identity
work in **ided-brand**. Use ided-design for every piece of design work, however small.

## Before writing anything

1. `ided list`: see the projects and frame files.
2. `ided brand`: the only values you may use. Keep this output in view while writing.
3. `ided rules`: the primitive reference. Read it in full the first time in a session;
   it is also in `references/primitives.md` next to this file.

If there is no workspace yet (`ided.json` missing), run `ided init --name "<Brand>"` from the
repository root; it also adds an ided section to `AGENTS.md` so other agents know the rules. If
the user wants these skills available to every agent and teammate who opens the repository,
`ided setup --project` commits them to `.agents/skills/`.

## The loop

0. **Think before building.** Every project has a `DESIGN.md` that `ided new` scaffolds with one
   prompt per section. Write its Brief, Message, Concept and Hierarchy (following ided-design)
   before designing frames: they decide the frames. `ided check` warns until every section is
   written, and the viewer shows the document beside the frames.
1. **Scaffold, never hand-create structure.**
   - New project: `ided new deck q3-review --title "Q3 Review"` (kinds: deck, doc, graphic, web; doc takes `--page letter|a4`, graphic `--size square|portrait|story|landscape|og|banner`, web `--viewport desktop|tablet|mobile`).
   - New frame: `ided add q3-review agenda` creates the next `NN-agenda.tsx` from a template.
     Frames are ordered by their number: to insert or reorder, rename the files (`git mv`,
     numbers unique); to drop a frame or a whole project, delete its file or folder. `ided check`
     then flags anything still importing it and comments left on it.
   - Shared components and assets live in a library: `ided new library kit`, `ided add kit stat`
     (adds a component), and `ided use q3-review kit` to let a project import from it.
2. **Write the frame** with primitives and tokens only. Pull repeated structure into the
   project's `components/`; if another project needs it too, move it to a library (or to
   `design/brand/components/` if it belongs to every medium). Images go in `assets/` and are
   imported: `import hero from "@kit/assets/hero.jpg"`.
3. **`ided check <project>`**, and fix every error. Treat warnings as errors unless there is a
   stated reason. The work is not done until the check is clean.
4. **Look at it.** `ided screenshot <project> <frame>` writes a PNG; `ided screenshot <project> --sheet`
   puts every frame on one contact sheet (the `ided_screenshot` MCP tool returns the images).
   Critique against the brief (ided-design's `references/critique.md`), revise, and update
   DESIGN.md in the same edit. A clean check proves consistency; only looking proves quality.
5. Tell the user to run `ided run` (or that it is running) to review in the browser. The Design
   tab shows DESIGN.md next to the frames; they can present with `P` and leave comments on
   elements with `C`.

## Review comments

The user clicks elements in the viewer and leaves comments. Each comment records the source
location of the element (`design/deck/slides/02-x.tsx:14:11`) and its enclosing primitives.

1. `ided comments` (or `ided_list_comments`) to read open comments.
2. Open the file at the recorded line and make the change. The line points at the JSX element
   that was clicked; the `inside` chain shows its parents.
3. `ided check`, then `ided comments resolve <id> -m "what changed"`. If a comment is ambiguous,
   `ided comments reply <id> "question"` instead of guessing.
4. If a comment changes the design's reasoning (a new audience, a different message, a
   rejected concept), update DESIGN.md too.

Reply and resolve are yours; reopening or deleting a comment is the reviewer's, in the viewer.
Renaming or deleting a frame leaves its open comments pointing at nothing (`ided check` warns):
address and resolve them rather than letting them go stale.

## Hard rules (the checker enforces them; do not try to get around them)

- No HTML elements, no `style`, no `className`, no CSS files, no npm imports, no React import.
- No raw values: no px, %, rem, hex, rgb, font names, or numbers for design props.
- Only `ided` and package-path imports: `@<package>/components/<name>`, `@<package>/assets/<file>`,
  from this project, `brand`, or a declared library. No relative imports.
- No hooks, state, effects, `Date`, `Math.random`, `window`, `fetch`. Artifacts are pure.
- No `any`, casts through `unknown`, `@ts-ignore` or lint suppressions.
- Frame files: `export default function Name()` with no props. Component files: named PascalCase function exports.

When a rule blocks what you are trying to express, the fix is almost always a missing brand
token. Add it to `brand.ts` (it must sit on the unit grid), explain the addition to the user,
and use it. Never approximate with the nearest existing token silently: a new token is a
design decision the user should see.

## Exports

- Exports and screenshots render with ided's pinned Chromium. The first one downloads it (about
  100 MB, one time); if a command seems to pause on first use, that is why.
- `ided export <project>` gives a PDF (docs print at true Letter/A4 size; web projects export
  PNG, since screens have no page size); `-f png` or `-f jpeg` gives per-frame images at 2×
  (`--frames 01-title,03-x` to limit).
- `ided screenshot <project> <frame> --zoom 2x2` cuts a frame into full-resolution tiles for
  inspecting detail; `--sheet` puts every frame on one image; `--page <n>` picks a page of a
  flowing doc page.
- A doc page with `flow` runs onto as many pages as it needs (see the primitive reference):
  export and screenshots produce every page, and `FrameNumber` counts them. For text that runs
  through boxes on designed pages, use `<Thread story={…}>`.

## Layout

`ided check` lays every frame out in the pinned Chromium and measures it. Text or content that
runs past its box, into the frame's margin or off the frame is an error at the line that
overflows; fix it by cutting copy, a smaller type style, or more room. A shape laid out off its
`ratio` is a warning. The one sanctioned overflow is `<Box crop>`: content may run past a crop
Box's edge and is cut there (with `bleed`, at the frame's edge). A crop that cuts nothing, or
that cuts reading-size text, is a warning. `--no-layout` skips the measurement.
- `ided export brand --zip` produces the brand kit: every logo variant in every colorway as SVG
  and PNG, plus tokens as CSS, Tailwind v4, DTCG JSON and TypeScript.

See **ided-design** for the design process and craft, and **ided-brand** for the identity and design system.
