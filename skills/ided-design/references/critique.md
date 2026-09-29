# Critique

The builder cannot see its own work: after writing the code, you see what you meant, not what is
there. Critique is how you close that gap. Do it from screenshots, against the brief, in a fixed
order, and stop after two rounds.

## Get the pictures, and the measurements

```sh
ided check <project>                               # overflow, ratios and crops, measured
ided screenshot <project> --sheet                  # every frame on one contact sheet
ided screenshot <project> <frame> --zoom 2x2       # one frame as four full-resolution tiles
```

Clear `ided check` first. Anything with a right answer (text past its box, content past the
frame, a shape off its ratio) is measured there, exactly; do not spend critique rounds hunting
for it by eye, and never judge a frame that still has overflow errors.

Then look from far to near. The contact sheet is the most useful single picture: rhythm,
repetition and sameness across frames are invisible one frame at a time. Then zoom into each
frame that matters: the tiles are full size, so rag, spacing, alignment and small type can
actually be seen, which neither the sheet nor a whole-frame picture shows.

## Use a fresh pair of eyes when you can

If you can start a subagent, give it only: the screenshots (the sheet and the zoomed tiles), the Brief,
Message and Hierarchy sections from DESIGN.md, and the prompt below. No code, no Decisions
section, no previous scores. A critic that reads your reasoning grades the reasoning.

> You are a senior graphic designer reviewing work before it goes to a client. Here is the brief,
> the one-sentence message and the intended reading order, then screenshots. Work in this order
> and do not skip ahead to judgment: (1) Describe what you see, frame by frame, including what
> your eye lands on first, second, third. (2) Analyze: does that order match the intended one?
> Where does the eye stall or wander? What repeats, what is inconsistent? (3) Interpret: what
> does the piece seem to be saying, and to whom? (4) Judge against the brief, goal by goal: met
> or not met, not "do I like it". Then list what to KEEP (so it survives the next revision), the
> three changes that would matter most, and a verdict: SHIP, POLISH (details only), RETHINK
> STRUCTURE, or RETHINK DIRECTION. When torn between two verdicts, choose the stricter. Do not
> suggest adding decoration, but do call out timidity: a focal point too small for its frame, or
> large empty areas that look unfinished rather than intended. You tend to favor ruled, editorial, typographic work; notice if
> that is your taste rather than the brief's.

Without subagents, do the same yourself after finishing the build: re-read only the brief and
message, then look at the screenshots before looking at any code.

## Compare, do not score

Critics (human or model) are unreliable at absolute scores and reliable at "which is better, A
or B". After a revision, compare the new screenshots to the previous ones for the same frame and
decide whether it got better. Keep the previous round's images until you have decided.

## The tests

Run the ones that apply, and write what they found in the Critique section.

- **Squint.** Blur your view (or look at the screenshot at 10–15% size). Does the intended focal
  point still win? Do groups hold together?
- **Grayscale.** Desaturate. Is the hierarchy intact without hue? If two things differ only by
  color, change size, weight or position instead.
- **Glance.** Slides and social graphics are read in about three seconds. At feed size or from
  across a room, does the message land?
- **Reading order.** Write the order your eye actually takes. Compare it to Hierarchy.
- **Removal.** Delete each element in your head. If nothing is lost, delete it for real.
- **Swap.** Replace the name with a competitor's. If the piece still works unchanged, the
  concept is not specific yet (the content can be generic; the idea should not be).
- **Memory.** What would someone describe an hour later? If the answer is a mood, the concept has
  not committed.
- **Skeleton.** Imagine the copy replaced with grey bars. Does the hierarchy still read?
- **Dead zone.** Find the largest empty region of each frame. If it is more than about a third
  of the frame and Decisions does not say why it is empty, it is leftover space: scale up the
  focal element, re-anchor the composition to another edge, or move the evidence into it.
- **Scale.** Is the focal element sized to the frame, or to its neighbors? On a slide or poster,
  the one thing that matters should be visible from the back of the room at a glance.
- **Budget.** Count type styles, colors, distinct left edges and spacing values per frame. Over
  budget needs a reason.
- **Alignment.** Every edge meets another edge or a grid line. Stray edges read as mistakes.
- **Craft.** Widows and orphans in headlines, awkward rag, a word alone on the last line,
  hyphenation stacks, text crowding a frame edge.

## Two rounds, then stop

Round one fixes structure and direction; round two fixes details. If a third round seems
necessary, the direction is wrong or the brief is unclear: say so to the user instead of
polishing. A round that changes nothing is the end.

## The last pass subtracts

At the end the instinct is to add. Do the opposite: remove one element, cut the copy by a third
where you can, and make what remains more exact. Refine, do not decorate.
