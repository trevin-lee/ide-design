# Writing DESIGN.md

Every ided project has a DESIGN.md, and `ided check` insists on it. It is the document a designer
presents alongside the work: why the piece looks the way it does. It is written first (brief,
message, concept, hierarchy come before any frame) and finished last (critique). The viewer
shows it next to the frames, so the person reviewing the design reads the reasoning with it.

## What makes a rationale convincing

Real studio case studies share one arc: problem, insight, one named idea, every element derived
from that idea, the system shown in use. The writing that works:

- **Traces each choice to the brief.** "The schedule is the largest thing on the page because
  people read this flyer standing at a noticeboard for five seconds" beats "we chose a bold
  layout".
- **Claims effects, not symbolism.** "The dark ground makes the one lit number feel like a
  window at night" is an effect a reader can check. "Blue represents trust" is an after-the-fact
  theory; leave it out.
- **Is specific.** Name the tokens, components and frames. "`display` on slide 3 only" is a
  decision; "strong typography" is not.
- **Calls taste taste.** If a choice is preference within equally good options, say so in a
  clause and move on. Do not invent a reason.
- **Admits what is weak.** A critique section with nothing in it reads as not having looked.

## Section by section

**Brief.** Audience, setting, duration of attention, the action you want, what they already
believe, constraints. Include the reframed problem: what is actually hard. For a class-schedule
flyer, the stated problem is "list the classes"; the real one is "make a stranger in a coffee
shop decide to try pottery".

**Message.** One sentence. Get [who] to [think/do] by [the message]. If you cannot write it,
stop and ask, or state your assumption.

**Concept.** One sentence a stranger could repeat, then where it comes from. Concepts come from
the subject's world: its objects, documents, notation, places, rituals. "Clean and modern" is a
style, not a concept.

**Hierarchy.** A ranked list of the content, then the intended reading order per frame. This is
the brief for the layout; write it before you place anything.

**Decisions.** Structure, axis and grid, type styles by role, color strategy and what each color
means in this piece, imagery, copy tone, rhythm across frames, the signature move. Each with its
reason. Name tokens and components.

**Alternatives.** At least two routes that differ in idea, and why they lost. The roll from
`scripts/roll.mjs` and each override with its reason. This is where the obvious default is
rejected on purpose, in writing.

**Critique.** The tests you ran and what they showed, what changed, what you cut, what is still
weak. Keep it honest and short.

## A worked excerpt

A one-page annual summary for a public library, left in branch lobbies.

> **Message.** Get regular visitors to see the library as busier and more necessary than they
> assumed, by showing one year of use as a single, readable picture.
>
> **Concept.** The page is a due-date slip: the stamped card from the back of an old library
> book, with a year of activity stamped onto it. Everyone over thirty has held one; the stamps
> make "a lot of use" visible without a chart.
>
> **Hierarchy.** 1. 412,000 visits (the one number). 2. The stamped column of months. 3. Three
> smaller facts. 4. How to get a card. Read top to bottom like the slip.
>
> **Decisions.** Structure `document-fragment`. Restrained color: paper surface throughout, the
> accent only for the stamps, because the stamps are the evidence. Two type styles: `display`
> for the number, `code` for the stamps (it has the date-stamp's even rhythm). Everything hangs
> from one left edge like a card in a pocket.
>
> **Alternatives.** An infographic of icons and percentages: rejected, it is what every annual
> report does and nobody reads it in a lobby. A portrait of one patron: warm, but it tells one
> story when the message is volume. Rolled `drenched`; overrode to `restrained` because the
> stamps need a quiet ground to read as ink.
>
> **Critique.** Squint test: the number and the stamp column survive; the three facts blur into
> one grey block, so two were cut. Swap test: another library could use the format, which is
> fine; the content is theirs. Still weak: the card-application line is small for a lobby.

Notice what is absent: no claims about what colors symbolize, no adjectives standing in for
decisions, no invented numbers.

## Keep it current

When the design changes, change the document in the same edit. A DESIGN.md describing a layout
that no longer exists is worse than none: reviewers will trust it.
