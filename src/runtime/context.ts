import { createContext, useContext } from "react";
import type { BrandInput } from "../shared/brand-schema.ts";
import type { FrameKind } from "../shared/formats.ts";

export interface Violation {
  rule: string;
  severity: "error" | "warning";
  message: string;
  /** `path/to/file.tsx:line:col` of the offending JSX, when known. */
  src?: string;
  hint?: string;
}

export interface ViolationSink {
  report(v: Violation): void;
}

export interface BrandEnv {
  brand: BrandInput;
  /** Brand SVG sources keyed by path relative to design/brand/assets/. */
  svgs: Record<string, string>;
  brandAssetUrl(path: string): string;
}

export interface FrameEnv {
  kind: FrameKind;
  project: string;
  width: number;
  height: number;
  fixedHeight: boolean;
  index: number;
  total: number;
  /** Set by the root primitive so the host can detect a missing root. */
  root: { rendered: boolean };
  /** How many <Thread> boxes of each story this frame has rendered so far, in order. */
  threads: Map<string, number>;
  /** The viewport this render of a web screen is for (a web screen renders once per viewport); null elsewhere. */
  viewport: "desktop" | "tablet" | "mobile" | null;
}

/** The frame root's direct flow children, in render order: how bleed knows who touches which edge. */
export interface RootSlots {
  align: "start" | "center" | "end" | "stretch";
  items: { bleed: ReadonlySet<BleedSide>; src?: string }[];
}

export type BleedSide = "top" | "bottom" | "left" | "right";

export interface LayoutEnv {
  axis: "row" | "column";
  /** CSS length of the parent's gap, used to make fractions exact. */
  gap: string;
  inText: boolean;
  /** Present when the direct parent is a Box, for concentric radii. */
  box: { radius: number; pad: number } | null;
  /** Present when the direct parent is the frame's root. */
  root: RootSlots | null;
  /** Set when the direct parent is a flowing page's content, which runs across pages. */
  flow?: true;
}

export const BrandContext = createContext<BrandEnv | null>(null);
export const FrameContext = createContext<FrameEnv | null>(null);
export const SinkContext = createContext<ViolationSink>({ report() {} });
export const SurfaceContext = createContext<string | null>(null);
/** Where a <Thread> box starts in its story: a block, and within a paragraph a child and a character. */
export interface StoryPosition {
  block: number;
  seg: number;
  char: number;
}
/** A position, or "end" once the story has run out. */
export type StoryPoint = StoryPosition | "end";

/**
 * How <Thread> boxes find their place in a story. The viewer and exporter measure where each
 * box's text ends and provide it; without it (server rendering), each frame's first box of a
 * story starts at the beginning and the rest are empty.
 */
export interface ThreadEnv {
  /** The project-wide order of this frame's `local`-th box of `story`. */
  index(story: string, local: number): number;
  /** Where box `index` starts, or null while the boxes before it are still being measured. */
  start(story: string, index: number): StoryPoint | null;
  /** Whether box `index` is the story's last, so whatever does not fit is lost. */
  isLast(story: string, index: number): boolean;
}
export const ThreadContext = createContext<ThreadEnv | null>(null);

/**
 * Which of a flowing page's pages this render shows. Set by the viewer and exporter for each page;
 * absent in server rendering, which renders the first.
 */
export const FlowPageContext = createContext<{ page: number } | null>(null);

export const LayoutContext = createContext<LayoutEnv>({ axis: "column", gap: "0px", inText: false, box: null, root: null });
export interface TextEnv {
  emphasisWeight: number;
  /** Size and weight of the Text's type style, for contrast checks inside it. */
  size: number;
  weight: number;
}
export const TextContext = createContext<TextEnv | null>(null);

export function useBrandEnv(): BrandEnv {
  const env = useContext(BrandContext);
  if (!env) throw new Error("ided primitives must render inside the ided viewer (no brand loaded).");
  return env;
}
