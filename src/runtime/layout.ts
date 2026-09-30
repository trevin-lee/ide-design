// The layout check: measures a rendered frame in a real browser and reports what server
// rendering cannot see. Runs in the viewer (live, in the Issues panel) and in `ided check`
// (in the pinned Chromium, through the export render route).
//
// A primitive must fit inside its parent primitive's content box; an element placed with
// <Place> must fit inside its parent's padding box; a bleeding Box must stay inside the frame.
// Text is measured across the full width of its lines, so a word longer than its box counts.
// The one sanctioned overflow is <Box crop>: whatever reaches a crop Box's edge is cut there
// on purpose. Differences under the tolerance (about one design pixel) are font-rendering
// noise between machines and are ignored.

import type { Violation } from "./context.ts";

export const LAYOUT_RULES = ["overflow", "ratio", "crop"] as const;

export interface LayoutOptions {
  /** The frame's design width, to convert screen pixels back to design pixels. */
  width: number;
  /** The brand's body text size in design px: cropping text this size or near it is a warning. */
  bodySize: number;
  /** Design pixels of overflow to ignore. */
  tolerance?: number;
}

type Side = "top" | "right" | "bottom" | "left";
const SIDES: Side[] = ["top", "right", "bottom", "left"];
interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Primitives that live inside a Text's lines; the Text's own measurement covers them. */
const INLINE = new Set(["Em", "Fact", "FrameNumber", "Equation"]);
/** Primitives whose content is text, measured across its line boxes. */
const TEXTUAL = new Set(["Text", "List"]);

const RATIOS: Record<string, number> = { "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:9": 16 / 9, "21:9": 21 / 9, "3:4": 3 / 4, "2:3": 2 / 3, "9:16": 9 / 16 };

export function measureLayout(root: HTMLElement, opts: LayoutOptions): Violation[] {
  const scale = root.getBoundingClientRect().width / opts.width || 1;
  const tolerance = (opts.tolerance ?? 1) * scale;
  const px = (n: number) => Math.round(n / scale);
  const out: Violation[] = [];

  const rectOf = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
  };
  /** The element's box shrunk by its border and, for the content box, its padding. */
  const inner = (el: Element, withPadding: boolean): Box => {
    const r = rectOf(el);
    const cs = getComputedStyle(el);
    const d = (prop: string) => (parseFloat(cs.getPropertyValue(prop)) || 0) * scale;
    const inset = (side: Side) => d(`border-${side}-width`) + (withPadding ? d(`padding-${side}`) : 0);
    return { top: r.top + inset("top"), right: r.right - inset("right"), bottom: r.bottom - inset("bottom"), left: r.left + inset("left") };
  };
  /** Is this node hidden or clipped by something between it and `stop` (like KaTeX's screen-reader MathML)? */
  const hiddenCache = new Map<Element, boolean>();
  const hidden = (from: Element | null, stop: Element): boolean => {
    for (let e = from; e && e !== stop; e = e.parentElement) {
      let h = hiddenCache.get(e);
      if (h === undefined) {
        const cs = getComputedStyle(e);
        h = cs.display === "none" || cs.visibility === "hidden" || (cs.overflow !== "visible" && cs.overflow !== "");
        hiddenCache.set(e, h);
      }
      if (h) return true;
    }
    return false;
  };
  /** How far an element reaches: its box, widened by the visible text in its lines. */
  const extentOf = (el: HTMLElement): Box => {
    const r = rectOf(el);
    if (!TEXTUAL.has(el.dataset.ided ?? "")) return r;
    let left = r.left;
    let right = r.right;
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || hidden(n.parentElement, el)) continue;
      range.selectNodeContents(n);
      for (const t of range.getClientRects()) {
        if (t.width === 0) continue;
        left = Math.min(left, t.left);
        right = Math.max(right, t.right);
      }
    }
    // Horizontal only: in tight leading, glyphs reach above and below their line boxes by design.
    return { ...r, left, right };
  };
  const beyond = (e: Box, limit: Box): Record<Side, number> => ({
    top: limit.top - e.top,
    right: e.right - limit.right,
    bottom: e.bottom - limit.bottom,
    left: limit.left - e.left,
  });
  const primitiveParent = (el: Element): HTMLElement | null => {
    const p = el.parentElement?.closest<HTMLElement>("[data-ided]") ?? null;
    return p && root.contains(p) ? p : null;
  };
  const cropAround = (el: Element): HTMLElement | null => {
    const c = el.parentElement?.closest<HTMLElement>("[data-ided-crop]") ?? null;
    return c && root.contains(c) ? c : null;
  };
  const frame = rectOf(root);
  const tag = (el: HTMLElement) => `<${el.dataset.ided}>`;
  const report = (el: HTMLElement, rule: string, severity: "error" | "warning", message: string, hint: string) =>
    out.push({ rule, severity, message: `${tag(el)} ${message}`, src: el.dataset.idedSrc, hint });

  const cut = new Map<HTMLElement, HTMLElement[]>(); // crop Box → what it cuts
  const elements = [...root.querySelectorAll<HTMLElement>("[data-ided]")].filter((el) => !INLINE.has(el.dataset.ided!) && !el.parentElement?.closest("[data-ided='Text']"));

  /** Rects of an element's visible text (the lines of a paragraph, wherever they landed). */
  const textRects = (el: HTMLElement): DOMRect[] => {
    const out: DOMRect[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || hidden(n.parentElement, el)) continue;
      range.selectNodeContents(n);
      for (const t of range.getClientRects()) if (t.width > 0) out.push(t);
    }
    return out;
  };

  /**
   * A flowing page's content runs through page-sized columns; the page shows one of them. Each
   * piece must fit the column's width, and a block that cannot break must fit on one page.
   */
  const checkFlowChild = (el: HTMLElement, flow: HTMLElement) => {
    const col = rectOf(flow);
    const step = Number(flow.dataset.idedFlowStep) * scale;
    const fragments = [...el.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
    let right = 0;
    let left = 0;
    for (const r of [...fragments, ...(TEXTUAL.has(el.dataset.ided!) ? textRects(el) : [])]) {
      const k = Math.max(0, Math.floor((r.left - col.left + tolerance) / step));
      right = Math.max(right, r.right - k * step - col.right);
      left = Math.max(left, col.left - (r.left - k * step));
    }
    const tallest = Math.max(0, ...fragments.map((r) => r.bottom - r.top));
    const hint = "Shorten it, make it smaller, or split it; a flowing page breaks only between paragraph lines.";
    if (right > tolerance || left > tolerance) {
      report(el, "overflow", "error", `runs ${px(Math.max(right, left))}px past the page's text column at the ${right >= left ? "right" : "left"}.`, hint);
    } else if (!TEXTUAL.has(el.dataset.ided!) && (fragments.length > 1 || tallest > col.bottom - col.top + tolerance)) {
      report(el, "overflow", "error", "is taller than a page, so it cannot stay on one.", hint);
    }
  };

  /** A shape with a declared ratio must be laid out at that ratio. */
  const checkRatio = (el: HTMLElement) => {
    const ratio = RATIOS[el.dataset.idedRatio ?? ""];
    if (ratio) {
      const r = rectOf(el);
      const actual = (r.right - r.left) / (r.bottom - r.top);
      if (Number.isFinite(actual) && Math.abs(actual / ratio - 1) > 0.01) {
        report(
          el,
          "ratio",
          "warning",
          `is laid out at ${px(r.right - r.left)}×${px(r.bottom - r.top)}, not its ratio ${el.dataset.idedRatio}.`,
          "Something fixes both its width and its height (a height, a stretching row). Drop one of them, or change the ratio.",
        );
      }
    }
  };

  for (const el of elements) {
    const parent = primitiveParent(el);
    if (!parent) continue;
    const name = el.dataset.ided!;
    const flow = el.closest<HTMLElement>("[data-ided-flow]");
    if (flow && root.contains(flow)) {
      if (parent === root) {
        checkFlowChild(el, flow);
        checkRatio(el);
        continue;
      }
      // Inside a block that is split across pages (already reported), boxes are fragments.
      let block: HTMLElement = el;
      while (block.parentElement && block.parentElement !== flow) block = block.parentElement;
      if (block.getClientRects().length > 1) continue;
    }
    const bleeds = el.hasAttribute("data-ided-bleed");
    const limit = bleeds ? frame : name === "Place" ? inner(parent, false) : inner(parent, true);
    const extent = extentOf(el);
    const over = beyond(extent, limit);
    const crop = cropAround(el);
    const cropBox = crop ? inner(crop, false) : null;
    const reachesCrop = cropBox ? beyond(extent, cropBox) : null;
    const sides = SIDES.filter((s) => over[s] > tolerance && !(reachesCrop && reachesCrop[s] > -tolerance));
    if (crop && reachesCrop && SIDES.some((s) => reachesCrop[s] > tolerance)) cut.set(crop, [...(cut.get(crop) ?? []), el]);
    if (sides.length) {
      const worst = sides.reduce((a, b) => (over[a] >= over[b] ? a : b));
      const amount = px(over[worst]);
      const where = sides.length > 1 ? `at the ${sides.join(" and ")}` : `at the ${worst}`;
      const pastFrame = beyond(extent, frame)[worst] > tolerance;
      const message =
        parent === root || bleeds
          ? pastFrame
            ? `runs ${amount}px past the frame's edge ${where}.`
            : `runs ${amount}px into the frame's margin ${where}.`
          : `overflows its ${tag(parent)} by ${amount}px ${where}.`;
      report(
        el,
        "overflow",
        "error",
        message,
        TEXTUAL.has(name)
          ? "Shorten the copy, use a smaller type style, or give it more room (a wider box, fewer elements, a smaller gap). To cut it off on purpose, put it in a <Box crop>."
          : "Give it more room (fewer or smaller elements, a smaller gap), or make it smaller. To cut it off on purpose, put it in a <Box crop>.",
      );
    }
    checkRatio(el);
  }

  for (const crop of root.querySelectorAll<HTMLElement>("[data-ided-crop]")) {
    const cutting = cut.get(crop) ?? [];
    if (!cutting.length) {
      report(crop, "crop", "warning", "cuts nothing: its content fits.", "Remove `crop`; it is for content that runs past the Box's edge on purpose.");
      continue;
    }
    const small = cutting.find((el) => TEXTUAL.has(el.dataset.ided!) && parseFloat(getComputedStyle(el).fontSize) <= opts.bodySize * 1.5);
    if (small) {
      report(crop, "crop", "warning", "cuts body-size text.", "Cropping is for display type and images. Text at reading size that is cut off is lost copy: give it room instead.");
    }
  }
  return out;
}

/** The brand's body size, or the middle of its type scale when it has no "body" style. */
export function bodySize(type: Record<string, { size: number }>): number {
  if (type.body) return type.body.size;
  const sizes = Object.values(type)
    .map((t) => t.size)
    .sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? 16;
}
