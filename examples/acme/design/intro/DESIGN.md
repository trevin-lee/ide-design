# Design as Code

The sample deck `ided init` writes. It is here to be read, presented and taken apart; delete its
folder (`design/intro`) when you no longer need it.

## Brief

Seen by a developer minutes after running `ided init`, in the viewer, before they have written a
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

- Structure: `statement-sequence` opening into `ledger` (slide 2) and `document-fragment`
  (slide 3), then `one-object`.
- Headlines are full sentences in `title`; nothing else on a slide competes with them. Evidence
  is set in `code` because it is code, and in `body` where it is explanation.
- Color strategy: restrained, with a dark opening. `ink` opens the deck and frames the terminal
  output; everything else sits on `paper`. The `accent` has one job: it marks where the system
  acts on your work (the error, the computed middle ring). It is never used to highlight words.
- The ledger on slide 2 uses hairline rules because they are table rules separating records, not
  decoration.
- `CornerMark` on the light slides demonstrates the promise itself: the mark sits the same
  distance from the corner here as on a page or a post, because it is the same component.
- No footer or slide numbers: four slides do not need wayfinding.

## Alternatives

- A feature tour (one slide per primitive): rejected, it describes the tool instead of making the
  reader trust it, and it is what every product deck does.
- Big-number cards ("0 raw values, 18 primitives, 1 brand file"): rejected, the card row is the
  most common template in generated slides, and the numbers are claims without proof.
- A dark, terminal-themed deck throughout: rejected; it would read as a costume. One dark slide
  and one dark block keep the code real without turning it into a theme.

## Critique

- Squint: each slide's headline wins, and on slide 3 the dark block reads as the evidence.
- Swap: another tool could not use slide 3 unchanged; the error is ided's own.
- Cut: an earlier version had a label above every headline and a numbered footer; both repeated
  what the reader already knew.
- Glance: at thumbnail size the code on slides 2 and 3 was unreadable at the starter's 22px `code`
  size, so the brand's `code` style was raised to 28px, the same as `body`.
- Contrast: the first draft dimmed the terminal's prompt and hint lines with `muted`, which fails
  contrast on `ink`; `ided check` caught it, and every line now uses the surface's own text color.
- Still weak: slide 3's terminal block is wider than its longest line, which leaves a dead area on
  the right.
