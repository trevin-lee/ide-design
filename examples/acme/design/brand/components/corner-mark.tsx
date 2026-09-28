import { Logo, Place } from "ided";

/**
 * The mark, pinned to the top-right corner at the frame margin. Every medium
 * uses this component, so the mark sits at the same distance from the corner
 * on a slide, a page and a social graphic.
 */
export function CornerMark() {
  return (
    <Place anchor="top-right" inset="margin">
      <Logo variant="mark" size="s" />
    </Place>
  );
}
