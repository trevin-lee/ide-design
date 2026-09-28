---
name: ided
description: Create and edit design artifacts (slide decks, documents, social graphics, web screens, brand systems) in an ided workspace, where design is written as token-only React components and verified by `ided check`. Use whenever the repository has an ided.json file or a design/ folder with project.json files, or when the user asks for slides, a deck, a one-pager, a document, a poster, a social post, a landing page mock, a logo lockup or brand assets in such a repo. Also use to address review comments left in the ided viewer.
---

# ided: design as code

In an ided workspace every artifact is a pure React function built from 16 primitives, and
every value (color, space, radius, type, logo) is a named token from `design/brand/brand.ts`.
There is one way to do each thing, and `ided check` rejects anything else. That is the point:
the output is consistent because nothing can drift from the brand.

## Before writing anything

1. `ided list`: see the projects and frame files.
2. `ided brand`: the only values you may use. Keep this output in view while writing.
3. `ided rules`: the primitive reference. Read it in full the first time in a session;
   it is also in `references/primitives.md` next to this file.

If there is no workspace yet (`ided.json` missing), run `ided init --name "<Brand>"` from the
repository root, and use the `ided-brand` skill to shape the brand before making artifacts.

## The loop

1. **Scaffold, never hand-create structure.**
   - New project: `ided new deck q3-review --title "Q3 Review"` (kinds: deck, doc, graphic, web; doc takes `--page letter|a4`, graphic `--size square|portrait|story|landscape|og|banner`, web `--viewport desktop|tablet|mobile`).
   - New frame: `ided add q3-review agenda` creates the next `NN-agenda.tsx` from a template.
   - Shared components and assets live in a library: `ided new library kit`, `ided add kit stat`
     (adds a component), and `ided use q3-review kit` to let a project import from it.
2. **Write the frame** with primitives and tokens only. Pull repeated structure into the
   project's `components/`; if another project needs it too, move it to a library (or to
   `design/brand/components/` if it belongs to every medium). Images go in `assets/` and are
   imported: `import hero from "@kit/assets/hero.jpg"`.
3. **`ided check <project>`**, and fix every error. Treat warnings as errors unless there is a
   stated reason. The work is not done until the check is clean.
4. **Look at it.** `ided screenshot <project> <frame>` writes a PNG (or use the
   `ided_screenshot` MCP tool, which returns the image). Judge hierarchy, balance and spacing,
   then iterate. A clean check proves consistency; only looking proves quality.
5. Tell the user to run `ided run` (or that it is running) to review in the browser. They can
   present with `P` and leave comments on elements with `C`.

## Review comments

The user clicks elements in the viewer and leaves comments. Each comment records the source
location of the element (`design/deck/slides/02-x.tsx:14:11`) and its enclosing primitives.

1. `ided comments` (or `ided_list_comments`) to read open comments.
2. Open the file at the recorded line and make the change. The line points at the JSX element
   that was clicked; the `inside` chain shows its parents.
3. `ided check`, then `ided comments resolve <id> -m "what changed"`. If a comment is ambiguous,
   `ided comments reply <id> "question"` instead of guessing.

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
- `ided export <project>` gives a PDF (docs print at true Letter/A4 size); `-f png` or `-f jpeg` gives
  per-frame images at 2× (`--frames 01-title,03-x` to limit).
- `ided export brand --zip` produces the brand kit: every logo variant in every colorway as SVG
  and PNG, plus tokens as CSS, Tailwind v4, DTCG JSON and TypeScript.

See `ided-compose` for layout and typography judgment, and `ided-brand` for editing the design system.
