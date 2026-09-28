# Type and layout

Rules of thumb from the canon (Vignelli, Müller-Brockmann, Bringhurst, Butterick, Refactoring
UI, Tufte, Alley), translated into ided's primitives. They are defaults with reasons; break one
when the concept needs it and say so in DESIGN.md.

## Hierarchy

- **One focal point per frame.** Decide it in Hierarchy before layout. Make it much larger than
  the next thing (a jump of three times or more in size reads as intentional; small steps read as
  indecision).
- **Emphasize by quieting the rest.** Before making the important thing louder, make the
  competing things quieter: `muted`, a smaller style, more space around the hero.
- **Two or three type styles per frame.** Most frames need two. A third needs a named role.
  Across a whole piece, stay within four or five of the brand's styles.
- **No louder by default.** Size and weight are not the only way to be seen. White space around
  an element is the most expensive emphasis a layout has, and the most effective.
- **Avoid the timid middle.** Medium size, medium spacing and mid-grey everywhere is what
  undecided work looks like. Commit to contrast of scale and generous space.

## Space

- **More space between groups than within them.** Group with `gap` before reaching for a
  `Box`. Proximity groups things more strongly than borders do; most boxes and dividers can go.
- **Big jumps between levels.** Inside a group `s`–`m`, between a heading and its content
  `l`–`xl`, between groups `2xl` and up. Adjacent steps (`m` then `l`) read as the same level.
- **Start with too much space, then remove.** Crowding is harder to see than emptiness.
- **Let the margin work.** Frames already pad by the brand margin; do not pad them again.

## Grid and alignment

- **Decide the axis first**: hung left, an asymmetric split, a modular grid, a single column,
  or centered. Centered is a choice for short, symmetrical content, not the default.
- **Every edge meets another edge.** Content sits on the margin or on a column line. Count
  distinct left edges per frame; fewer is calmer.
- **Unequal columns carry more tension than equal ones.** `Row` with `1/3` + `grow` or
  `2/5` + `3/5`; `Grid` only when the content really is a set of equals.
- **Narrow margins create tension, wide margins calm.** Use `Place` with a smaller inset or a
  full-bleed `Box` when the concept wants tension, and say why.
- **A few large images beat many small ones.** One image, cropped with intent (`ratio`,
  `fit="cover"`), usually beats a gallery.
- **If you can see the layout, it is probably too much layout.** Rules, boxes and frames that
  do not carry information are noise.

## Type

- **Measure.** Body text reads best at 45–75 characters per line. Constrain it with fractional
  widths or a `size` token; a full-width paragraph on a slide or page is too long.
- **Flush left, ragged right.** Do not center paragraphs. Justified text needs care that ided
  cannot give it; avoid it.
- **Headlines are claims.** On slides, write the headline as a full sentence stating the point
  ("Rates fall 22% for members"), with the evidence underneath, not a topic ("Rates") over
  bullets. Measured: audiences retain more.
- **All caps only for short labels**, and only if the brand's style for them is tracked. Never
  for sentences.
- **Emphasis within text is rare.** `<Em>` for a word that must be stressed in reading, not for
  color highlighting a phrase in a headline.
- **Numbers deserve design.** A key figure set large with its unit and one line of context
  outperforms a chart with one number in it. Do not invent numbers.
- **Break lines by sense.** In a headline, rewrite until each line is a phrase, and no line is a
  single short word.

## Lists, charts and diagrams

- **Bullets are a last resort on slides.** Three parallel items can be three statements with
  space between them; a sequence can be a timeline; a comparison can be a table.
- **Charts: remove the ink that is not data.** No gridlines, borders or legends that the labels
  can replace. Label directly.
- **Numbering only for real sequences.** "01 / 02 / 03" on things that are not steps is chrome.

## Consistency across frames

- **Fixed identifiers, varied content.** The logo, margins and type roles hold still on every
  frame; the composition inside them can change. Too much sameness is forgettable, too much
  variety fragments.
- **Repeated anatomy is a component.** If three frames share a structure, build it once in
  `components/` and feed it data.
