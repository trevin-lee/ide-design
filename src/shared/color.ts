// CSS colors read into channels, and WCAG 2.x relative luminance and contrast. Pure, used by the
// runtime contrast audit, brand validation, the SVG checks and the token exports.

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text (>= 24px, or >= 18.66px bold). */
export function requiredContrast(sizePx: number, weight: number): number {
  const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  return large ? 3 : 4.5;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0-1. */
  a: number;
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#FF0000",
  green: "#008000",
  blue: "#0000FF",
  gray: "#808080",
  grey: "#808080",
  yellow: "#FFFF00",
  orange: "#FFA500",
};
const NOT_A_COLOR = new Set(["none", "transparent", "currentcolor", "inherit", "context-fill", "context-stroke"]);

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number) => clamp(n).toString(16).padStart(2, "0").toUpperCase();

/**
 * A CSS color's channels. Null for a value that is not a concrete color (`none`, `currentColor`,
 * `url(…)`, `var(…)`), undefined for one ided cannot read (hsl, most named colors).
 */
export function readColor(raw: string): Rgba | null | undefined {
  const v = raw.trim().replace(/\s*!important$/, "");
  const lower = v.toLowerCase();
  if (NOT_A_COLOR.has(lower) || lower.startsWith("url(") || lower.startsWith("var(")) return null;
  let m = /^#([0-9a-f]{3,4})$/i.exec(v);
  if (m) {
    const [r, g, b, a] = [...m[1]!].map((c) => parseInt(c + c, 16));
    return { r: r!, g: g!, b: b!, a: a === undefined ? 1 : a / 255 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
  if (m) {
    const n = parseInt(m[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(v);
  if (m) {
    const ch = (s: string) => (s.endsWith("%") ? (parseFloat(s) / 100) * 255 : parseFloat(s));
    const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: clamp(ch(m[1]!)), g: clamp(ch(m[2]!)), b: clamp(ch(m[3]!)), a: Math.max(0, Math.min(1, alpha)) };
  }
  if (NAMED[lower]) return readColor(NAMED[lower]);
  return undefined;
}

/** #RRGGBB, alpha dropped. */
export function toHex(c: Rgba): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

/** A color as #RRGGBB (alpha dropped); null and undefined as in `readColor`. */
export function normalizeColor(raw: string): string | null | undefined {
  const c = readColor(raw);
  return c ? toHex(c) : c;
}

/** A CSS box-shadow's layers; null when it is not one ided can read. */
export function parseShadow(css: string): { color: string; offsetX: number; offsetY: number; blur: number; spread: number; inset: boolean }[] | null {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") depth--;
    else if (css[i] === "," && depth === 0) {
      layers.push(css.slice(start, i));
      start = i + 1;
    }
  }
  layers.push(css.slice(start));
  const out = [];
  for (const layer of layers) {
    const parts = layer.trim().match(/[a-z-]+\([^)]*\)|\S+/gi) ?? [];
    let inset = false;
    let color: string | null = null;
    const lengths: number[] = [];
    for (const p of parts) {
      if (p === "inset") inset = true;
      else if (/^-?[\d.]+(px)?$/.test(p) && (p.endsWith("px") || Number(p) === 0)) lengths.push(parseFloat(p));
      else if (readColor(p)) color = p;
      else return null;
    }
    if (color === null || lengths.length < 2 || lengths.length > 4) return null;
    out.push({ color, offsetX: lengths[0]!, offsetY: lengths[1]!, blur: lengths[2] ?? 0, spread: lengths[3] ?? 0, inset });
  }
  return out;
}
