// Threaded text: one story running through several <Thread> boxes. Each box renders the story
// from where the previous box ended; after layout, measureThread finds where this box's text
// ends, and the next box continues from there. Paragraphs split between lines (keeping at least
// two on each side); every other block moves whole; a heading stays with what follows it.

import type { StoryPoint, StoryPosition } from "./context.ts";

export const STORY_START: StoryPosition = { block: 0, seg: 0, char: 0 };

export function encodePoint(p: StoryPoint): string {
  return p === "end" ? "end" : `${p.block}.${p.seg}.${p.char}`;
}

export function decodePoint(s: string | undefined): StoryPoint | null {
  if (s === "end") return "end";
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(s ?? "");
  return m ? { block: Number(m[1]), seg: Number(m[2]), char: Number(m[3]) } : null;
}

/** The first character (as a child index and offset in `el`) whose line reaches below `limit`, and that line's top. */
function firstCutChar(el: HTMLElement, limit: number): { child: number; char: number; top: number } | null {
  const range = document.createRange();
  const bottomOf = (node: Node, i: number) => {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    return range.getBoundingClientRect().bottom;
  };
  const nodes = [...el.childNodes];
  for (const [child, node] of nodes.entries()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const n = node.textContent?.length ?? 0;
      if (n === 0 || bottomOf(node, n - 1) <= limit) continue;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (bottomOf(node, mid) > limit) hi = mid;
        else lo = mid + 1;
      }
      range.setStart(node, lo);
      range.setEnd(node, lo + 1);
      return { child, char: lo, top: range.getBoundingClientRect().top };
    }
    const over = node instanceof Element ? [...node.getClientRects()].find((r) => r.bottom > limit) : undefined;
    if (over) return { child, char: 0, top: over.top };
  }
  return null;
}

export interface ThreadMeasure {
  /** Where the next box continues. */
  end: StoryPoint;
  /** How much of the box (in screen px from its top) shows this box's part; the rest belongs to the next box. */
  visible?: number;
  /** A block too big for this box even on its own: it is skipped so the story can go on. */
  tooLarge?: HTMLElement;
}

/** Where the text in a rendered <Thread> box ends. */
export function measureThread(box: HTMLElement, scale = 1): ThreadMeasure {
  const start = decodePoint(box.dataset.idedThreadStart);
  const content = box.querySelector<HTMLElement>("[data-ided-thread-content]");
  if (!start || start === "end" || !content) return { end: "end" };
  const top = box.getBoundingClientRect().top;
  const limit = box.getBoundingClientRect().bottom + 0.5 * scale;
  const blocks = [...content.children] as HTMLElement[];
  const at = (i: number, child = 0, char = 0): StoryPosition => {
    // The first block may be a paragraph continued from the previous box.
    if (i === 0 && (start.seg || start.char)) return { block: start.block, seg: start.seg + child, char: child === 0 ? start.char + char : char };
    return { block: start.block + i, seg: child, char };
  };
  const before = (i: number): StoryPosition => (i > 0 && blocks[i - 1]!.hasAttribute("data-ided-heading") && i - 1 > 0 ? at(i - 1) : at(i));

  for (const [i, el] of blocks.entries()) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= limit) continue;
    if (el.hasAttribute("data-ided-splittable")) {
      const lh = parseFloat(getComputedStyle(el).lineHeight) * scale || r.height;
      const lines = Math.round(r.height / lh);
      const fit = Math.floor((limit - r.top) / lh + 0.01);
      if (fit >= 2 || (i === 0 && fit >= 1)) {
        // Keep two lines on each side of the break: pull one more line over if one would be left.
        const cutAt = lines - fit === 1 && fit >= 3 ? limit - lh : limit;
        const cut = firstCutChar(el, cutAt);
        if (cut && (cut.child > 0 || cut.char > 0)) return { end: at(i, cut.child, cut.char), visible: cut.top - top };
      }
    }
    if (i === 0) return { end: at(1), tooLarge: el };
    const end = before(i);
    // Show up to the bottom of the last block that stays in this box.
    const kept = blocks[end.block - start.block - 1] ?? blocks[i - 1];
    return { end, visible: kept ? kept.getBoundingClientRect().bottom - top : 0 };
  }
  return { end: "end" };
}

/**
 * Records the measurement on the box for the layout check: the last box of a story whose text
 * does not all fit, and a block too big to fit a box at all.
 */
export function markThread(box: HTMLElement, end: StoryPoint, tooLarge?: HTMLElement, visible?: number, scale = 1): void {
  // Clip the box's content right below its last line, so the next part does not peek out.
  const content = box.querySelector<HTMLElement>("[data-ided-thread-content]");
  if (content) {
    content.style.height = visible === undefined ? "" : `${visible / scale}px`;
    content.style.overflow = visible === undefined ? "" : "hidden";
  }
  box.toggleAttribute("data-ided-thread-more", box.hasAttribute("data-ided-thread-last") && end !== "end");
  if (tooLarge) box.dataset.idedThreadTooLarge = tooLarge.dataset.idedSrc ?? "";
  else delete box.dataset.idedThreadTooLarge;
}
