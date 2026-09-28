// A tiny geometric monoline typeface, so `ided init --name "Your Co"` can
// produce a real vector wordmark (not <text>) with zero dependencies. Glyphs
// are skeleton paths on a 0..8 cap-height grid, stroked at a fixed weight.

const GLYPHS: Record<string, { w: number; d: string }> = {
  A: { w: 5, d: "M0 8V2.5A2.5 2.5 0 0 1 5 2.5V8M0 5H5" },
  B: { w: 5, d: "M0 0V8H3A2 2 0 0 0 3 4H0M0 0H3A2 2 0 0 1 3 4" },
  C: { w: 5, d: "M5 0H2.5A2.5 2.5 0 0 0 0 2.5V5.5A2.5 2.5 0 0 0 2.5 8H5" },
  D: { w: 5, d: "M0 0V8H2.5A2.5 2.5 0 0 0 5 5.5V2.5A2.5 2.5 0 0 0 2.5 0Z" },
  E: { w: 4.5, d: "M4.5 0H0V8H4.5M0 4H4" },
  F: { w: 4.5, d: "M4.5 0H0V8M0 4H4" },
  G: { w: 5, d: "M5 0H2.5A2.5 2.5 0 0 0 0 2.5V5.5A2.5 2.5 0 0 0 2.5 8H5V4.5H3" },
  H: { w: 5, d: "M0 0V8M5 0V8M0 4H5" },
  I: { w: 0, d: "M0 0V8" },
  J: { w: 4.5, d: "M4.5 0V5.75A2.25 2.25 0 0 1 0 5.75" },
  K: { w: 5, d: "M0 0V8M5 0L0 5M1.9 3.1L5 8" },
  L: { w: 4.5, d: "M0 0V8H4.5" },
  M: { w: 6, d: "M0 8V0L3 5L6 0V8" },
  N: { w: 5, d: "M0 8V0L5 8V0" },
  O: { w: 5, d: "M2.5 0A2.5 2.5 0 0 1 5 2.5V5.5A2.5 2.5 0 0 1 0 5.5V2.5A2.5 2.5 0 0 1 2.5 0Z" },
  P: { w: 5, d: "M0 8V0H2.75A2.25 2.25 0 0 1 2.75 4.5H0" },
  Q: { w: 5, d: "M2.5 0A2.5 2.5 0 0 1 5 2.5V5.5A2.5 2.5 0 0 1 0 5.5V2.5A2.5 2.5 0 0 1 2.5 0ZM3.2 5.6L5 8" },
  R: { w: 5, d: "M0 8V0H2.75A2.25 2.25 0 0 1 2.75 4.5H0M2.75 4.5L5 8" },
  S: { w: 5, d: "M5 0H2.25A2 2 0 0 0 2.25 4H2.75A2 2 0 0 1 2.75 8H0" },
  T: { w: 5, d: "M0 0H5M2.5 0V8" },
  U: { w: 5, d: "M0 0V5.5A2.5 2.5 0 0 0 5 5.5V0" },
  V: { w: 5, d: "M0 0L2.5 8L5 0" },
  W: { w: 6.4, d: "M0 0L1.6 8L3.2 1.5L4.8 8L6.4 0" },
  X: { w: 5, d: "M0 0L5 8M5 0L0 8" },
  Y: { w: 5, d: "M0 0L2.5 4L5 0M2.5 4V8" },
  Z: { w: 5, d: "M0 0H5L0 8H5" },
  "0": { w: 5, d: "M2.5 0A2.5 2.5 0 0 1 5 2.5V5.5A2.5 2.5 0 0 1 0 5.5V2.5A2.5 2.5 0 0 1 2.5 0Z" },
  "1": { w: 1.5, d: "M0 1L1.5 0V8" },
  "2": { w: 5, d: "M0 2.5A2.5 2.5 0 0 1 5 2.5L0 8H5" },
  "3": { w: 5, d: "M0 0H5L2 3.5H2.75A2.25 2.25 0 0 1 2.75 8H0" },
  "4": { w: 5, d: "M3.5 8V0L0 5.5H5" },
  "5": { w: 5, d: "M5 0H0V3.5H2.75A2.25 2.25 0 0 1 2.75 8H0" },
  "6": { w: 5, d: "M3.8 0L0.4 4.5M0 5.5A2.5 2.5 0 1 0 5 5.5A2.5 2.5 0 1 0 0 5.5" },
  "7": { w: 5, d: "M0 0H5L1.5 8" },
  "8": { w: 5, d: "M2.5 3.7A1.85 1.85 0 1 1 2.5 0A1.85 1.85 0 1 1 2.5 3.7ZM2.5 8A2.15 2.15 0 1 1 2.5 3.7A2.15 2.15 0 1 1 2.5 8Z" },
  "9": { w: 5, d: "M1.2 8L4.6 3.5M5 2.5A2.5 2.5 0 1 0 0 2.5A2.5 2.5 0 1 0 5 2.5" },
  "-": { w: 3, d: "M0 4.5H3" },
  ".": { w: 0, d: "M0 7.3V8" },
  " ": { w: 2.5, d: "" },
};

const STROKE = 1.7;
const TRACK = 3.4;

function shift(d: string, dx: number): string {
  // Translate absolute path commands horizontally. Arc radii and flags stay.
  return d.replace(/([MLHVAZ])([^MLHVAZ]*)/g, (_, cmd: string, args: string) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
    switch (cmd) {
      case "M":
      case "L":
        return cmd + n.map((v, i) => fmt(i % 2 === 0 ? v + dx : v)).join(" ");
      case "H":
        return cmd + n.map((v) => fmt(v + dx)).join(" ");
      case "A": {
        const out: number[] = [];
        for (let i = 0; i < n.length; i += 7) out.push(n[i]!, n[i + 1]!, n[i + 2]!, n[i + 3]!, n[i + 4]!, n[i + 5]! + dx, n[i + 6]!);
        return cmd + out.map(fmt).join(" ");
      }
      default:
        return cmd + args;
    }
  });
}

export function wordmarkSvg(name: string): string {
  const text = name.toUpperCase().replace(/[^A-Z0-9 .-]/g, "").trim() || "BRAND";
  let x = 0;
  const parts: string[] = [];
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch]!;
    if (g.d) parts.push(shift(g.d, x));
    x += g.w + (i < text.length - 1 ? TRACK : 0);
  });
  const pad = STROKE / 2;
  const vb = `${-pad} ${-pad} ${Math.round((x + STROKE) * 1000) / 1000} ${8 + STROKE}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><path d="${parts.join("")}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="2"/></svg>\n`;
}

/**
 * The starter mark: a rounded square with a dot cut out of its top-right
 * corner. The dot shares its center with the corner arc, so dot and corner are
 * concentric: the whole idea of the framework, in one glyph.
 */
export function markSvg(): string {
  const size = 100;
  const r = 30; // corner radius
  const inset = 14; // dot distance from the edges
  const cx = size - r;
  const cy = r;
  const dot = r - inset;
  const rect = `M${r} 0H${size - r}A${r} ${r} 0 0 1 ${size} ${r}V${size - r}A${r} ${r} 0 0 1 ${size - r} ${size}H${r}A${r} ${r} 0 0 1 0 ${size - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  const circle = `M${cx - dot} ${cy}A${dot} ${dot} 0 1 0 ${cx + dot} ${cy}A${dot} ${dot} 0 1 0 ${cx - dot} ${cy}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path fill="currentColor" fill-rule="evenodd" d="${rect}${circle}"/></svg>\n`;
}
