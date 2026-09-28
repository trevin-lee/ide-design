// The brand is the single source of every value an artifact may use. Artifacts
// never contain a color, a length or a font name: they contain token names, and
// this file defines what a token is and validates that a brand is coherent.

import { validateBrandFacts, type BrandFacts } from "./brand-facts.ts";
import { HEX_RE, contrast } from "./color.ts";
import type { FrameKind } from "./formats.ts";

export type Hex = `#${string}`;

/** A color that can be used as a background. It must declare its foreground. */
export interface SurfaceColor {
  readonly value: Hex;
  /** Default text color on this surface (a color token). */
  readonly on: string;
  /** Default logo colorway on this surface (a colorway name). */
  readonly logo?: string;
}

export type ColorDef = Hex | SurfaceColor;

export interface FontFile {
  /** Path relative to `design/brand/assets/`. */
  readonly src: string;
  readonly weight: number | string;
  readonly style?: "normal" | "italic";
}

export interface FontDef {
  readonly family: string;
  /** CSS fallback stack used while (or if) the brand font is unavailable. */
  readonly fallback: string;
  readonly files?: readonly FontFile[];
}

export interface TypeStyle {
  /** A font token. */
  readonly font: string;
  /** Font size in px. */
  readonly size: number;
  readonly weight: number;
  /** Line height as a ratio of size. Snapped to the brand unit when rendered. */
  readonly leading: number;
  /** Letter spacing in em. */
  readonly tracking?: number;
  readonly case?: "upper" | "none";
  readonly wrap?: "balance" | "pretty";
  /** Weight used by <Em> inside this style. Defaults to `weight`. */
  readonly emphasisWeight?: number;
}

export interface LockupDef {
  readonly direction: "row" | "column";
  /** Mark height as a multiple of the wordmark height. */
  readonly mark: number;
  /** Gap between mark and wordmark as a multiple of the wordmark height. */
  readonly gap: number;
  /** Cross-axis alignment of mark and wordmark. */
  readonly align?: "start" | "center" | "end";
}

export interface Colorway {
  /** Color token for the mark. */
  readonly mark: string;
  /** Color token for the wordmark. */
  readonly wordmark: string;
}

export interface LogoDef {
  /** SVG file in `design/brand/assets/`, drawn with `currentColor`. */
  readonly mark: string;
  /** SVG file in `design/brand/assets/`, drawn with `currentColor`. */
  readonly wordmark: string;
  readonly lockups: Readonly<Record<string, LockupDef>>;
  readonly colorways: Readonly<Record<string, Colorway>>;
  /** Rendered logo heights in px. */
  readonly sizes: Readonly<Record<string, number>>;
}

export interface BrandInput {
  readonly name: string;
  /** Base grid unit in px. Every space, radius, stroke, size and line height is a multiple of it. */
  readonly unit: number;
  readonly color: Readonly<Record<string, ColorDef>>;
  readonly space: Readonly<Record<string, number>>;
  readonly radius: Readonly<Record<string, number>>;
  readonly stroke: Readonly<Record<string, number>>;
  readonly size?: Readonly<Record<string, number>>;
  readonly shadow?: Readonly<Record<string, string>>;
  readonly font: Readonly<Record<string, FontDef>>;
  readonly type: Readonly<Record<string, TypeStyle>>;
  /** Frame margin per project kind, as a space token. */
  readonly margin: Readonly<Record<FrameKind, string>>;
  readonly logo: LogoDef;
  /** Facts artifacts repeat (names, links, contact, places, handles, abbreviations), used through <Fact>. */
  readonly facts?: BrandFacts;
}

/** Words with framework meaning that a brand may not use as token names. */
export const RESERVED_TOKENS = ["none", "margin", "concentric", "full", "auto", "inherit"] as const;
export const TOKEN_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSurface(def: ColorDef | undefined): def is SurfaceColor {
  return typeof def === "object" && def !== null;
}

export function colorValue(brand: BrandInput, token: string): string | undefined {
  const def = brand.color[token];
  if (def === undefined) return undefined;
  return isSurface(def) ? def.value : def;
}

export function surfaceNames(brand: BrandInput): string[] {
  return Object.keys(brand.color).filter((k) => isSurface(brand.color[k]));
}

export interface TypeMetrics {
  family: string;
  size: number;
  lineHeight: number;
  weight: number;
  emphasisWeight: number;
  tracking: number;
  upper: boolean;
  wrap: "balance" | "pretty";
}

/** Line heights snap to the brand unit so every text block sits on the baseline grid. */
export function snapLineHeight(size: number, leading: number, unit: number): number {
  return Math.max(unit, Math.round((size * leading) / unit) * unit);
}

export function fontStack(brand: BrandInput, token: string): string {
  const f = brand.font[token];
  if (!f) return "system-ui, sans-serif";
  return `"${f.family}", ${f.fallback}`;
}

export function typeMetrics(brand: BrandInput, token: string): TypeMetrics | undefined {
  const t = brand.type[token];
  if (!t) return undefined;
  return {
    family: fontStack(brand, t.font),
    size: t.size,
    lineHeight: snapLineHeight(t.size, t.leading, brand.unit),
    weight: t.weight,
    emphasisWeight: t.emphasisWeight ?? t.weight,
    tracking: t.tracking ?? 0,
    upper: t.case === "upper",
    wrap: t.wrap ?? "pretty",
  };
}

export interface BrandIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validate internal coherence of a brand: every reference resolves, every
 * length sits on the unit grid, every surface's foreground is legible.
 */
export function validateBrand(brand: BrandInput, svgs: Record<string, string> = {}): BrandIssue[] {
  const issues: BrandIssue[] = [];
  const err = (path: string, message: string) => issues.push({ path, message, severity: "error" });
  const warn = (path: string, message: string) => issues.push({ path, message, severity: "warning" });

  if (!brand || typeof brand !== "object") {
    err("", "brand.ts must `export default defineBrand({...})`.");
    return issues;
  }
  if (typeof brand.name !== "string" || !brand.name.trim()) err("name", "Brand needs a name.");
  const unit = brand.unit;
  if (!Number.isInteger(unit) || unit < 2 || unit > 16) err("unit", "unit must be an integer between 2 and 16 (4 or 8 is typical).");

  const checkNames = (group: string, obj: Record<string, unknown> | undefined) => {
    if (!obj || typeof obj !== "object") {
      err(group, `Missing \`${group}\` tokens.`);
      return;
    }
    if (Object.keys(obj).length === 0) err(group, `\`${group}\` needs at least one token.`);
    for (const k of Object.keys(obj)) {
      if (!TOKEN_NAME_RE.test(k)) err(`${group}.${k}`, `Token names are lowercase kebab-case ("${k}" is not).`);
      if ((RESERVED_TOKENS as readonly string[]).includes(k)) err(`${group}.${k}`, `"${k}" is reserved by the framework.`);
    }
  };

  const onGrid = (group: string, obj: Record<string, number> | undefined, opts: { ascending?: boolean } = {}) => {
    checkNames(group, obj);
    if (!obj) return;
    let prev = -Infinity;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        err(`${group}.${k}`, "Must be a non-negative number of px.");
        continue;
      }
      if (Number.isInteger(unit) && unit > 0 && v % unit !== 0 && v !== 1) {
        err(`${group}.${k}`, `${v}px is off the ${unit}px grid. Use a multiple of ${unit}.`);
      }
      if (opts.ascending && v <= prev) err(`${group}.${k}`, "Scale tokens must be declared smallest to largest.");
      prev = v;
    }
  };

  // Colors
  checkNames("color", brand.color as Record<string, unknown>);
  const colors = brand.color ?? {};
  for (const [k, def] of Object.entries(colors)) {
    const hex = isSurface(def) ? def.value : def;
    if (typeof hex !== "string" || !HEX_RE.test(hex)) {
      err(`color.${k}`, `Colors are 6-digit hex like "#1A1A1A" (got ${JSON.stringify(hex)}).`);
      continue;
    }
    if (isSurface(def)) {
      const on = colors[def.on];
      if (on === undefined) {
        err(`color.${k}.on`, `Foreground "${def.on}" is not a color token.`);
      } else {
        const fg = isSurface(on) ? on.value : on;
        if (HEX_RE.test(fg)) {
          const ratio = contrast(hex, fg);
          if (ratio < 4.5) err(`color.${k}.on`, `"${def.on}" on "${k}" has contrast ${ratio.toFixed(2)}:1; body text needs 4.5:1.`);
        }
      }
      if (def.logo !== undefined && !brand.logo?.colorways?.[def.logo]) {
        err(`color.${k}.logo`, `Colorway "${def.logo}" is not defined in logo.colorways.`);
      }
    }
  }
  if (surfaceNames(brand).length === 0) err("color", "Define at least one surface color: { value, on }.");

  onGrid("space", brand.space, { ascending: true });
  onGrid("radius", brand.radius, { ascending: true });
  checkNames("stroke", brand.stroke);
  for (const [k, v] of Object.entries(brand.stroke ?? {})) {
    if (typeof v !== "number" || v <= 0 || v > unit * 4) err(`stroke.${k}`, "Strokes are positive px widths, at most 4 units.");
  }
  if (brand.size) onGrid("size", brand.size, { ascending: true });
  if (brand.shadow) checkNames("shadow", brand.shadow);

  // Fonts & type
  checkNames("font", brand.font as Record<string, unknown>);
  for (const [k, f] of Object.entries(brand.font ?? {})) {
    if (!f?.family) err(`font.${k}.family`, "Font needs a family name.");
    if (!f?.fallback) err(`font.${k}.fallback`, 'Font needs a CSS fallback stack, e.g. "system-ui, sans-serif".');
  }
  checkNames("type", brand.type as Record<string, unknown>);
  let prevSize = Infinity;
  for (const [k, t] of Object.entries(brand.type ?? {})) {
    if (!brand.font?.[t.font]) err(`type.${k}.font`, `Font "${t.font}" is not a font token.`);
    if (!Number.isInteger(t.size) || t.size < 8) err(`type.${k}.size`, "Type sizes are integer px >= 8.");
    if (!Number.isInteger(t.weight) || t.weight % 100 !== 0 || t.weight < 100 || t.weight > 900) err(`type.${k}.weight`, "Weights are 100-900 in steps of 100.");
    if (t.emphasisWeight !== undefined && (t.emphasisWeight % 100 !== 0 || t.emphasisWeight < 100 || t.emphasisWeight > 900)) err(`type.${k}.emphasisWeight`, "Weights are 100-900 in steps of 100.");
    if (!(t.leading >= 0.8 && t.leading <= 2)) err(`type.${k}.leading`, "Leading is a ratio between 0.8 and 2.");
    if (t.tracking !== undefined && Math.abs(t.tracking) > 0.2) err(`type.${k}.tracking`, "Tracking is in em and should be within ±0.2.");
    if (t.size > prevSize) warn(`type.${k}`, "Type styles read best declared largest to smallest.");
    prevSize = t.size;
  }

  // Margins
  const kinds: FrameKind[] = ["deck", "doc", "graphic", "web"];
  for (const kind of kinds) {
    const m = brand.margin?.[kind];
    if (m === undefined) err(`margin.${kind}`, `Missing frame margin for ${kind} (a space token).`);
    else if (brand.space?.[m] === undefined) err(`margin.${kind}`, `"${m}" is not a space token.`);
  }

  // Facts
  for (const i of validateBrandFacts((brand as { facts?: unknown }).facts)) err(i.path, i.message);

  // Logo
  const logo = brand.logo;
  if (!logo) {
    err("logo", "Brand needs a logo: { mark, wordmark, lockups, colorways, sizes }.");
  } else {
    for (const part of ["mark", "wordmark"] as const) {
      const file = logo[part];
      if (typeof file !== "string" || !file.endsWith(".svg")) {
        err(`logo.${part}`, "Logo parts are SVG files in design/brand/assets/.");
        continue;
      }
      const svg = svgs[file];
      if (svg === undefined) {
        err(`logo.${part}`, `design/brand/assets/${file} does not exist.`);
        continue;
      }
      for (const problem of svgProblems(svg)) err(`logo.${part}`, `${file}: ${problem}`);
    }
    checkNames("logo.lockups", logo.lockups as Record<string, unknown>);
    for (const [k, l] of Object.entries(logo.lockups ?? {})) {
      if (k === "mark" || k === "wordmark") err(`logo.lockups.${k}`, `"${k}" is reserved for the logo parts.`);
      if (l.direction !== "row" && l.direction !== "column") err(`logo.lockups.${k}.direction`, 'direction is "row" or "column".');
      if (!(l.mark > 0 && l.mark <= 6)) err(`logo.lockups.${k}.mark`, "mark is the mark height as a multiple of the wordmark height (0-6).");
      if (!(l.gap >= 0 && l.gap <= 4)) err(`logo.lockups.${k}.gap`, "gap is a multiple of the wordmark height (0-4).");
    }
    checkNames("logo.colorways", logo.colorways as Record<string, unknown>);
    for (const [k, c] of Object.entries(logo.colorways ?? {})) {
      if (colors[c.mark] === undefined) err(`logo.colorways.${k}.mark`, `"${c.mark}" is not a color token.`);
      if (colors[c.wordmark] === undefined) err(`logo.colorways.${k}.wordmark`, `"${c.wordmark}" is not a color token.`);
    }
    onGrid("logo.sizes", logo.sizes, { ascending: true });
  }
  return issues;
}

/** Logos must be single-color vector art so colorways can recolor them. */
export function svgProblems(svg: string): string[] {
  const out: string[] = [];
  if (!/<svg[\s>]/.test(svg)) return ["not an SVG document."];
  if (!/viewBox\s*=\s*"[^"]+"/.test(svg)) out.push("needs a viewBox.");
  if (/<text[\s>]/.test(svg)) out.push("contains <text>; convert type to outlines.");
  if (/<image[\s>]/.test(svg)) out.push("embeds a raster <image>; logos must be vector.");
  const colorRe = /(?:fill|stroke|stop-color|color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|(?!none|currentColor|inherit|transparent)[a-z]+)/g;
  const bad = new Set<string>();
  for (const m of svg.matchAll(colorRe)) {
    const v = m[1]!;
    if (/^url$/i.test(v)) continue;
    bad.add(v);
  }
  if (bad.size) out.push(`uses fixed colors (${[...bad].slice(0, 3).join(", ")}); draw with currentColor so colorways can recolor it.`);
  return out;
}

/** Identity function that gives brand.ts literal token types. */
export function defineBrand<const T extends BrandInput>(brand: T): T {
  return brand;
}
