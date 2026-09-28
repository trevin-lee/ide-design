// WCAG 2.x relative luminance and contrast. Pure math, used by the runtime
// contrast audit and by brand validation.

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
