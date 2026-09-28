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
}

export const BrandContext = createContext<BrandEnv | null>(null);
export const FrameContext = createContext<FrameEnv | null>(null);
export const SinkContext = createContext<ViolationSink>({ report() {} });
export const SurfaceContext = createContext<string | null>(null);
export const LayoutContext = createContext<LayoutEnv>({ axis: "column", gap: "0px", inText: false, box: null, root: null });
export const TextContext = createContext<{ emphasisWeight: number } | null>(null);

export function useBrandEnv(): BrandEnv {
  const env = useContext(BrandContext);
  if (!env) throw new Error("ided primitives must render inside the ided viewer (no brand loaded).");
  return env;
}
