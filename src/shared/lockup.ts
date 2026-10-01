// Logo composition as pure string functions, shared by the browser runtime and
// the brand-kit exporter so a lockup is geometrically identical everywhere.
// All lockup geometry is relative to the wordmark height, so it is scale-free.

import type { BrandInput, LockupDef } from "./brand-schema.ts";
import { colorValue, colorwayInks, iconSettings, normalizeHex, partFile, partInks } from "./brand-schema.ts";
import { readColor, toHex } from "./color.ts";
import { mapSvgColors } from "./svg-color.ts";

/**
 * How a part is recolored: each of its colors as drawn (`currentColor`, or brand values for a
 * part drawn in several colors) and the color it becomes.
 */
export interface Ink {
  from: readonly string[];
  to: readonly string[];
  /** The drawing to use instead of the part's own file (its one-color `mono` version). */
  file?: string;
}

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
  ink: Ink;
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
  colors: { mark: Ink; wordmark: Ink },
): LogoLayout {
  const aspect = (s: ParsedSvg) => s.width / s.height;
  if (variant === "mark") {
    return { width: aspect(mark), height: 1, parts: [{ svg: mark, x: 0, y: 0, w: aspect(mark), h: 1, ink: colors.mark, id: "m" }] };
  }
  if (variant === "wordmark") {
    return {
      width: aspect(wordmark),
      height: 1,
      parts: [{ svg: wordmark, x: 0, y: 0, w: aspect(wordmark), h: 1, ink: colors.wordmark, id: "w" }],
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
        { svg: mark, x: 0, y: offset(height, mh), w: mw, h: mh, ink: colors.mark, id: "m" },
        { svg: wordmark, x: mw + l.gap, y: offset(height, wh), w: ww, h: wh, ink: colors.wordmark, id: "w" },
      ],
    };
  }
  const width = Math.max(mw, ww);
  return {
    width,
    height: mh + l.gap + wh,
    parts: [
      { svg: mark, x: offset(width, mw), y: 0, w: mw, h: mh, ink: colors.mark, id: "m" },
      { svg: wordmark, x: offset(width, ww), y: mh + l.gap, w: ww, h: wh, ink: colors.wordmark, id: "w" },
    ],
  };
}

const r = (n: number) => Math.round(n * 1e4) / 1e4;

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Serialize a layout at a given pixel height, with colors baked in. */
export function renderLogoSvg(layout: LogoLayout, heightPx?: number, opts: { title?: string } = {}): string {
  const scale = 100; // internal coordinate precision
  const W = r(layout.width * scale);
  const H = r(layout.height * scale);
  const size = heightPx ? ` width="${r((layout.width / layout.height) * heightPx)}" height="${heightPx}"` : "";
  const parts = layout.parts
    .map((p) => {
      const inner = recolor(scopeIds(p.svg.inner, p.id), p.ink);
      const base = p.ink.to[0]!;
      return `<svg x="${r(p.x * scale)}" y="${r(p.y * scale)}" width="${r(p.w * scale)}" height="${r(p.h * scale)}" viewBox="${p.svg.x} ${p.svg.y} ${p.svg.width} ${p.svg.height}" color="${base}" fill="${base}">${inner}</svg>`;
    })
    .join("");
  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}>${title}${parts}</svg>`;
}

export function logoVariants(brand: BrandInput): string[] {
  return ["mark", "wordmark", ...Object.keys(brand.logo.lockups)];
}

/** Swap each color a part is drawn in for its colorway color. */
function recolor(inner: string, ink: Ink): string {
  if (ink.from.length === 1 && ink.from[0] === "currentColor") return inner.replace(/currentColor/g, ink.to[0]!);
  const map = new Map(ink.from.map((c, i) => [normalizeHex(c), ink.to[i] ?? ink.to[0]!]));
  return mapSvgColors(inner, (raw) => {
    const c = readColor(raw);
    const to = c ? map.get(toHex(c)) : undefined;
    if (!c || !to) return undefined;
    if (c.a >= 1) return to;
    const t = readColor(to)!;
    return `rgba(${t.r}, ${t.g}, ${t.b}, ${Number(c.a.toFixed(3))})`;
  });
}

/** Resolve a colorway to the inks of each logo part. */
export function colorwayHex(brand: BrandInput, colorway: string): { mark: Ink; wordmark: Ink } {
  const c = brand.logo.colorways[colorway];
  if (!c) throw new Error(`Unknown colorway "${colorway}"`);
  const ink = (part: "mark" | "wordmark"): Ink => {
    const def = brand.logo[part];
    // One token for a part drawn in several colors: its one-color drawing, when it has one.
    if (typeof def !== "string" && def.mono && typeof c[part] === "string") return { from: ["currentColor"], to: colorwayInks(brand, def.mono, c[part]), file: def.mono };
    return { from: partInks(brand, def), to: colorwayInks(brand, def, c[part]) };
  };
  return { mark: ink("mark"), wordmark: ink("wordmark") };
}

export function composeLogo(
  brand: BrandInput,
  svgs: Record<string, string>,
  variant: LogoVariant,
  colors: { mark: Ink; wordmark: Ink },
  heightPx?: number,
): { svg: string; aspect: number } {
  const markSrc = svgs[colors.mark.file ?? partFile(brand.logo.mark)];
  const wordSrc = svgs[colors.wordmark.file ?? partFile(brand.logo.wordmark)];
  if (!markSrc || !wordSrc) throw new Error("Logo SVGs are missing from design/brand/assets/");
  const layout = layoutLogo(variant, parseSvg(markSrc), parseSvg(wordSrc), brand.logo.lockups, colors);
  return { svg: renderLogoSvg(layout, heightPx, { title: brand.name }), aspect: layout.width / layout.height };
}

export interface IconFile {
  path: string;
  /** Pixel size; null for the scalable SVG favicon. */
  size: number | null;
  svg: string;
  purpose?: "maskable";
}

/**
 * The mark on the icon's ground, `size` px square, the mark's larger side `share` of it.
 * `fitCircle` keeps the mark inside the centered circle a maskable icon may be cut to (80%).
 */
export function composeIcon(brand: BrandInput, svgs: Record<string, string>, size: number, share: number, fitCircle = false): string {
  const s = iconSettings(brand);
  const ground = colorValue(brand, s.ground) ?? "#000000";
  const { svg, aspect } = composeLogo(brand, svgs, "mark", colorwayHex(brand, s.colorway));
  let w = aspect >= 1 ? size * share : size * share * aspect;
  let h = aspect >= 1 ? (size * share) / aspect : size * share;
  if (fitCircle) {
    const k = Math.min(1, (size * 0.8 * 0.96) / Math.hypot(w, h));
    w *= k;
    h *= k;
  }
  const inner = svg.replace(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /, `<svg x="${r((size - w) / 2)}" y="${r((size - h) / 2)}" width="${r(w)}" height="${r(h)}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${ground}"/>${inner}</svg>`;
}

/** Every icon the brand kit ships: favicons, the Apple touch icon, PWA and app-store icons. */
export function iconFiles(brand: BrandInput, svgs: Record<string, string>): IconFile[] {
  const s = iconSettings(brand);
  const fav = (size: number) => composeIcon(brand, svgs, size, s.faviconScale);
  const app = (size: number) => composeIcon(brand, svgs, size, s.scale);
  return [
    { path: "icons/favicon.svg", size: null, svg: fav(64) },
    { path: "icons/favicon-16.png", size: 16, svg: fav(16) },
    { path: "icons/favicon-32.png", size: 32, svg: fav(32) },
    { path: "icons/favicon-48.png", size: 48, svg: fav(48) },
    { path: "icons/apple-touch-icon.png", size: 180, svg: app(180) },
    { path: "icons/icon-192.png", size: 192, svg: app(192) },
    { path: "icons/icon-512.png", size: 512, svg: app(512) },
    { path: "icons/icon-maskable-512.png", size: 512, svg: composeIcon(brand, svgs, 512, s.scale, true), purpose: "maskable" },
    { path: "icons/app-icon-1024.png", size: 1024, svg: app(1024) },
  ];
}
