---
name: ided-design
description: Think and work like a professional graphic designer on any ided artifact (slide deck, document, flyer, poster, social or launch graphic, web mock) before and while building it. Covers the brief, the one-sentence message, a concept drawn from the subject's world, ranked hierarchy, choosing a structure and color strategy, self-critique from screenshots, and writing the project's DESIGN.md rationale. Use this skill for every design task in an ided workspace, even small ones, and whenever someone says a design looks generic, bland, templated, safe or AI-made, asks why a design looks the way it does, or asks for a design rationale.
---

# ided-design: think like a designer

ided makes inconsistency impossible: every value is a brand token and the checker catches
anything off-system. It cannot make a design good. A frame can pass `ided check` and still say
nothing, look like every other deck, and bury its point. The difference between correct and good
is the thinking a designer does before and after the pixels, and that is this skill.

The work has two outputs of equal importance: the frames, and the project's `DESIGN.md`, which
records the thinking so the person reviewing the work can follow it. The viewer shows the
document next to the frames. `ided check` warns until every section is written.

## The process

Work through these in order. Each step says what to write in DESIGN.md; write it as you go,
not at the end. Most of the quality is decided by step 7, before a frame is built.

**1. Read the room.** Run `ided brand` for the tokens. Read the brand's `design/brand/DESIGN.md`
for what the identity means and how it should be used. Skim the DESIGN.md of other projects: they
tell you which structures and moves this workspace has already used, so you do not repeat them
by accident.

**2. Brief.** Restate the request as a problem. Who sees this, where, for how long, what should
they do or think afterwards, what do they already believe, what must not change? What is
actually hard? If the answer to something would change the design and you cannot infer it
(audience, setting, must-have content), ask once, briefly. Otherwise state your assumptions in
the Brief and proceed. → **Brief**

**3. Message.** One sentence: get [who] to [think/do] by [the message]. If you cannot write it,
the design cannot land it either. → **Message**

**4. Rank the content.** Real content only: facts you were given, copy you wrote for this
audience. Never invent numbers, quotes, testimonials or logos. Names, links, contact details and
places come from the brand's data through `<Fact>` (`ided brand` lists them); if the piece needs
one the brand lacks, leave a visible placeholder such as "[signup link]" and ask, or add it to
`data` in brand.ts if the user gave it to you. Rank everything by importance and
decide the reading order before any layout. → **Hierarchy**

**5. Name the defaults.** Write down (for yourself) what this category always looks like and its
predictable opposite; both are ruts. Read `references/defaults.md` for the patterns generated
design falls into, including the look of ided's own scaffolds. You cannot avoid a pattern you
have not named.

**6. Diverge.** List about seven things from the audience's world, not the category's:
artifacts, documents, notation, places, tools, rituals, spanning at least three kinds. The
specific, surprising idea is usually there (a tide table, a due-date slip, a class register,
a nautical chart). Form three concepts that differ in idea, not styling. Each is a sentence.

**7. Roll and converge.** Run `node <this skill's folder>/scripts/roll.mjs --medium <deck|doc|graphic|web>`.
It proposes a structure, color strategy, scale, density, axis and a constraint. Your own "free"
choice is your most probable one; the roll is how the work escapes it. Keep what the brief can
live with; override any axis with a reason. Choose the concept that best serves the message and
record why the others lost. → **Concept**, **Alternatives**

**8. Plan the form, then check the plan.** Decide the structure (`references/structures.md`),
the color strategy (`references/color.md`), the type styles and their roles, the axis and grid,
and the one signature move where the piece spends its boldness. Then test the plan before
building: read it with the client's name removed. Would a similar request land somewhere
similar? If yes, the plan is generic; revise the part that is, and note what you changed.
→ **Decisions**

**9. Build rough, then refine.** Build all frames at low fidelity first: structure and
hierarchy, real copy, no polish. Look at them together (`ided screenshot <project> --sheet`)
before refining any single frame. Run `ided check` as you go; it is the floor, not the goal.

**10. Critique from screenshots.** Follow `references/critique.md`: a fresh-eyes critic if you
can start one, the tests (squint, grayscale, glance, swap, reading order, removal), comparison
against the previous round rather than a score. Two rounds at most. → **Critique**

**11. Subtract, then craft.** Remove one element. Cut copy that does not earn its place. Then the
craft pass: line breaks by sense, no single-word last lines in headlines, every edge aligned,
nothing crowding a frame edge. Refine what is there; do not add.

**12. Finish the document.** Make DESIGN.md describe what was actually built, fill in Critique
honestly, and run `ided check` until clean.

## What good looks like

- **One idea, visibly.** Someone should be able to say what the piece is about and what its idea
  is after one look. If they would describe a mood, the concept has not committed.
- **One focal point per frame**, much larger or more contrasted than everything else, with the
  rest deliberately quiet.
- **Boldness spent in one place.** One loud move (a huge number, a full-bleed dark frame, type as
  image), everything around it disciplined. Uniform emphasis reads as a template. The loud move
  has to actually be loud: sized to the frame, not to the paragraph next to it.
- **Space that is designed, not left over.** Restraint means few elements, not small ones. A frame
  with a modest headline at the top and nothing below it is not minimal, it is unfinished. Size
  the focal element to its frame, anchor the composition to more than one edge, and make every
  large empty area a decision you could defend in Decisions.
- **Restraint is not safety.** If your plan overrides the roll toward quieter options twice
  (smaller scale, less color, sparser), stop and check you are not retreating to the timid
  middle. Quiet work still needs one thing that is unmistakably the point.
- **Structure that carries information.** Numbering only for real sequences, boxes only for real
  groups, a divider only where a boundary means something.
- **Specific over clever.** Specific nouns, real numbers, the audience's own words. A headline
  that would fit a competitor is not finished.
- **Restraint with the brand.** Use few type styles per frame (two, sometimes three), a clear
  color strategy, and the accent for one kind of thing.

Depth, when you need it: `references/type-and-layout.md` (hierarchy, space, grid, type),
`references/color.md` (strategy within a fixed palette), `references/mediums.md` (decks,
documents, graphics, web), `references/structures.md` (the catalog the roll draws from),
`references/design-doc.md` (writing a rationale that convinces), `references/sources.md`.

## Doing it in ided

The design vocabulary maps onto primitives. Hierarchy is type styles and space tokens: a big jump
between styles, generous `gap` around the focal point. The axis is the root's `align` and
`justify`, fractional `width`s in a `Row`, or a `Grid` for true equals. The color strategy is
which `surface` each root and `Box` uses. Chrome (mark, page number) goes through `Place` and
brand components, and only where it helps. A repeated anatomy is a component in `components/`
fed with data. When the brand lacks something the concept truly needs (a size, a color),
propose a token in `brand.ts` and tell the user; brand values are the client's call.

The scaffold `ided new` writes is a placeholder with a recognizable look. Replace it; do not
decorate it.

**The brand is the client's.** Design within `brand.ts` as it is unless the request is about the
brand. Do not change its colors, fonts or mark, and do not invent an identity, because a design
task was asked for, not a rebrand. If the brand is still ided's starter placeholder (its DESIGN.md
says so), design within it anyway and say plainly in your final message that the logo and
palette are placeholders the client should replace before publishing. Adding one missing token
that the work needs (a larger size, say) is fine; name it and why when you report back.

**Images.** Prefer what you can do well: typography, diagrams built from primitives (`Box`,
`Row`, `Grid`, `Divider` give you bars, strips, tables and fields), and real photographs from
`assets/`. Hand-drawn SVG illustration is where generated work looks most amateur: shapes that
read as something else at a glance, wobbly proportions. If a drawing is essential, keep it
geometric, test it at thumbnail size with a fresh critic, and keep its colors out of the file
(an SVG with its own hex values bypasses the brand).

## Time

Spend real effort on steps 2–8: they are cheap to change and decide most of the outcome.

Scale the process to the request. A single graphic or a small edit gets the same steps in
miniature: a two-line brief, a one-line message, three concepts in three lines, one roll, one
build, one critique round (a fresh critic is still worth it; a second round only if its verdict
is RETHINK). A multi-frame piece or a brand gets the full process, two rounds at most.
