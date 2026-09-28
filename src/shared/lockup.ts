// Logo composition as pure string functions, shared by the browser runtime and
// the brand-kit exporter so a lockup is geometrically identical everywhere.
// All lockup geometry is relative to the wordmark height, so it is scale-free.

import type { BrandInput, LockupDef } from "./brand-schema.ts";
import { colorValue } from "./brand-schema.ts";

export interface ParsedSvg {
  /** viewBox origin and size. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Markup between the root <svg> tags. */
  inner: string;
}

export function parseSvg(svg: string): ParsedSvg {
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) throw new Error("Not an SVG document");
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(open[0]);
  const nums = vb ? vb[1]!.trim().split(/[\s,]+/).map(Number) : [];
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) throw new Error("SVG needs a numeric viewBox");
  const end = svg.lastIndexOf("</svg>");
  const inner = svg.slice(open.index + open[0].length, end === -1 ? undefined : end);
  return { x: nums[0]!, y: nums[1]!, width: nums[2]!, height: nums[3]!, inner };
}

/** Prefix ids so two SVGs can be nested in one document without collisions. */
export function scopeIds(inner: string, prefix: string): string {
  return inner
    .replace(/\bid="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`);
}

export interface Placed {
  svg: ParsedSvg;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  id: string;
}

export interface LogoLayout {
  width: number;
  height: number;
  parts: Placed[];
}

export type LogoVariant = "mark" | "wordmark" | (string & {});

/**
 * Lay out a logo variant in a coordinate space where the wordmark is 1 unit
 * tall (or the mark is 1 unit tall for the bare mark).
 */
export function layoutLogo(
  variant: LogoVariant,
  mark: ParsedSvg,
  wordmark: ParsedSvg,
  lockups: Readonly<Record<string, LockupDef>>,
  colors: { mark: string; wordmark: string },
): LogoLayout {
  const aspect = (s: ParsedSvg) => s.width / s.height;
  if (variant === "mark") {
    return { width: aspect(mark), height: 1, parts: [{ svg: mark, x: 0, y: 0, w: aspect(mark), h: 1, color: colors.mark, id: "m" }] };
  }
  if (variant === "wordmark") {
    return {
      width: aspect(wordmark),
      height: 1,
      parts: [{ svg: wordmark, x: 0, y: 0, w: aspect(wordmark), h: 1, color: colors.wordmark, id: "w" }],
    };
  }
  const l = lockups[variant];
  if (!l) throw new Error(`Unknown logo variant "${variant}"`);
  const mh = l.mark;
  const mw = aspect(mark) * mh;
  const wh = 1;
  const ww = aspect(wordmark);
  const align = l.align ?? "center";
  const offset = (outer: number, inner: number) => (align === "start" ? 0 : align === "end" ? outer - inner : (outer - inner) / 2);
  if (l.direction === "row") {
    const height = Math.max(mh, wh);
    return {
      width: mw + l.gap + ww,
      height,
      parts: [
        { svg: mark, x: 0, y: offset(height, mh), w: mw, h: mh, color: colors.mark, id: "m" },
        { svg: wordmark, x: mw + l.gap, y: offset(height, wh), w: ww, h: wh, color: colors.wordmark, id: "w" },
      ],
    };
  }
  const width = Math.max(mw, ww);
  return {
    width,
    height: mh + l.gap + wh,
    parts: [
      { svg: mark, x: offset(width, mw), y: 0, w: mw, h: mh, color: colors.mark, id: "m" },
      { svg: wordmark, x: offset(width, ww), y: mh + l.gap, w: ww, h: wh, color: colors.wordmark, id: "w" },
    ],
  };
}

const r = (n: number) => Math.round(n * 1e4) / 1e4;

/** Serialize a layout at a given pixel height, with colors baked in. */
export function renderLogoSvg(layout: LogoLayout, heightPx?: number, opts: { title?: string } = {}): string {
  const scale = 100; // internal coordinate precision
  const W = r(layout.width * scale);
  const H = r(layout.height * scale);
  const size = heightPx ? ` width="${r((layout.width / layout.height) * heightPx)}" height="${heightPx}"` : "";
  const parts = layout.parts
    .map((p) => {
      const inner = scopeIds(p.svg.inner, p.id).replace(/currentColor/g, p.color);
      return `<svg x="${r(p.x * scale)}" y="${r(p.y * scale)}" width="${r(p.w * scale)}" height="${r(p.h * scale)}" viewBox="${p.svg.x} ${p.svg.y} ${p.svg.width} ${p.svg.height}" color="${p.color}" fill="${p.color}">${inner}</svg>`;
    })
    .join("");
  const title = opts.title ? `<title>${opts.title.replace(/[<&]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}>${title}${parts}</svg>`;
}

export function logoVariants(brand: BrandInput): string[] {
  return ["mark", "wordmark", ...Object.keys(brand.logo.lockups)];
}

/** Resolve a colorway to hex values. */
export function colorwayHex(brand: BrandInput, colorway: string): { mark: string; wordmark: string } {
  const c = brand.logo.colorways[colorway];
  if (!c) throw new Error(`Unknown colorway "${colorway}"`);
  return { mark: colorValue(brand, c.mark) ?? "#000000", wordmark: colorValue(brand, c.wordmark) ?? "#000000" };
}

export function composeLogo(
  brand: BrandInput,
  svgs: Record<string, string>,
  variant: LogoVariant,
  colors: { mark: string; wordmark: string },
  heightPx?: number,
): { svg: string; aspect: number } {
  const markSrc = svgs[brand.logo.mark];
  const wordSrc = svgs[brand.logo.wordmark];
  if (!markSrc || !wordSrc) throw new Error("Logo SVGs are missing from design/brand/assets/");
  const layout = layoutLogo(variant, parseSvg(markSrc), parseSvg(wordSrc), brand.logo.lockups, colors);
  return { svg: renderLogoSvg(layout, heightPx, { title: brand.name }), aspect: layout.width / layout.height };
}
