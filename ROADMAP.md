# Roadmap

## 0.4.0: layout you can trust

`ided check` renders frames on the server, which produces HTML but no layout, so it cannot see
text spilling out of a box. 0.4.0 measures layout in the pinned Chromium, adds the one sanctioned
way to overflow on purpose, and gives agents sharper eyes for what a check cannot judge.

- **Layout check.** `ided check` opens each frame in the pinned Chromium (the same one export
  uses) and reports, at the primitive's file and line:
  - error: text or content overflowing its box, or content past the frame edge (except `bleed`);
  - warning: an `Image` laid out at a different shape than its `ratio`, text ending within a
    hair of its box's edge.
  
  A tolerance of about 1 design px (like LaTeX's `\hfuzz`) keeps font-smoothing differences
  between macOS and Linux from changing the result. The viewer's Issues panel shows the same
  findings live. `--no-render` skips it. Too much empty space is not checked: that is taste,
  and it goes to the agent's critique.
- **`<Box crop>`, the sanctioned overflow.** Content may overflow a `crop` Box and is cut at its
  edge; with `bleed`, that edge is the frame's (a giant numeral running off the slide). Any
  overflow outside a `crop` Box is an error. Guards: a crop that cuts nothing is a warning, and
  so is a crop that cuts body-size text. Breakouts (an element poking past its card, uncut) stay
  with `Place`.
  A rounded `Box` clips its content today (to keep corners clean); the layout check measures
  what that clipping hides, so only `crop` may cut content.
- **Zoomed screenshots.** `ided screenshot <project> <frame> --zoom 2x2` splits a frame into
  full-resolution tiles, so an agent can inspect detail the contact sheet is too small to show.
- **Skills.** The critique step in `ided-design` looks at the contact sheet first, then the
  zoomed tiles, and reads the layout findings before judging; a deliberate `crop` is named in
  DESIGN.md's Decisions.

## Later

- Text that flows across doc pages.
- Responsive variants for web screens.
- Multi-color logos.
- Windows.
- Publishing the VS Code extension to the Visual Studio Marketplace (the workflow job is ready;
  it needs a publisher and an Azure identity).
