# Color inside a brand

In ided the palette is fixed: the brand chose the colors. What is left to decide is proportion
and placement, which changes the result more than hue ever does. The same three colors read as
a bank or a festival depending on how much of each appears and where.

## Choose a strategy before touching a surface

Name one of these in DESIGN.md before building, and hold it across every frame:

- **Restrained.** One light surface carries almost everything; the accent appears once or twice
  in the whole piece, at the point that matters most. Reads as calm, confident, editorial. The
  risk is blandness: restraint only works if the one accented moment is well chosen.
- **Committed.** A leading non-neutral surface (the dark one, or the brand color) covers 30–60%
  of the piece: whole frames, or a large field on each frame. Reads as assured and branded. The
  risk is a split personality; decide which frames are "loud" and why.
- **Drenched.** The brand color or the dark surface is the ground itself, nearly everywhere;
  other colors are small. Reads as bold, immersive, poster-like. The risk is fatigue across many
  frames; best for graphics, covers and short decks.

The roll (`scripts/roll.mjs`) proposes one. Override it only for a reason in the brief: a
retirement-community town hall and a festival poster should not share a strategy by accident.

## Rules that hold whatever the strategy

- **Color follows meaning.** If the accent marks "the answer" on one frame, it cannot mark
  "the problem" on the next. Decide what each color means in this piece and write it down.
- **One accent job.** Use the accent for one kind of thing (the key number, the action, the
  answer), not for decoration. Picking out one word in a headline is decoration.
- **Surfaces carry their own text color.** In ided a surface's `on` color is already legible;
  reach for another text color only when you mean something by it, and let `ided check` confirm
  the contrast.
- **Contrast of extension (Itten).** A small area of a strong color balances a large area of a
  quiet one. A little accent goes a long way; a lot of it stops being an accent.
- **Colors change each other (Albers).** The same accent looks different on the light and the
  dark surface. Check the frames side by side, not one at a time.
- **Test in grayscale.** Screenshot, desaturate, and look: the hierarchy must survive without
  hue. If two elements only differ by color, one of them needs a different size, weight or
  position.
- **Muted is for secondary text, not for everything.** Grey text everywhere lowers contrast
  without creating hierarchy.

## If the brand palette fights the brief

Sometimes the brand's accent is wrong for a piece (a signal orange on a condolence notice). Do
not invent a color: a raw value will not compile anyway. Use the restrained strategy with the
neutral surfaces, keep the accent out, and say so in DESIGN.md. If the brand genuinely lacks a
color it needs, propose the new token to the user and add it to `brand.ts` once they agree; brand
colors are the client's decision, not the piece's.
