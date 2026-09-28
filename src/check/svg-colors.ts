// SVG assets are drawings, so their colors are design decisions like any other:
// every color an SVG in assets/ uses must be one of the brand's (transparency on
// top of a brand color is fine). Raster images are photographs and are exempt.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { colorValue, type BrandInput } from "../shared/brand-schema.ts";
import type { Issue, Project } from "../core/workspace.ts";

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
const SKIP = new Set(["none", "transparent", "currentcolor", "inherit", "context-fill", "context-stroke"]);
const PROPS = "fill|stroke|stop-color|flood-color|lighting-color|color";

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();

/** A color value as #RRGGBB (alpha dropped), or null if it is not a concrete color. */
export function normalizeColor(raw: string): string | null | undefined {
  const v = raw.trim().replace(/\s*!important$/, "");
  const lower = v.toLowerCase();
  if (SKIP.has(lower) || lower.startsWith("url(") || lower.startsWith("var(")) return null;
  let m = /^#([0-9a-f]{3,4})$/i.exec(v);
  if (m) return "#" + [...m[1]!.slice(0, 3)].map((c) => (c + c).toUpperCase()).join("");
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(v);
  if (m) return "#" + m[1]!.toUpperCase();
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (m) return "#" + hex2(Number(m[1])) + hex2(Number(m[2])) + hex2(Number(m[3]));
  if (NAMED[lower]) return NAMED[lower];
  return undefined; // a color we cannot check (another named color, hsl…)
}

/** Every color declaration in an SVG: attributes, inline styles and <style> blocks. */
export function svgColors(svg: string): string[] {
  const found: string[] = [];
  for (const m of svg.matchAll(new RegExp(`\\s(?:${PROPS})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gi"))) found.push(m[1] ?? m[2]!);
  for (const m of svg.matchAll(new RegExp(`(?:^|[;{\\s"'])(?:${PROPS})\\s*:\\s*([^;"'}]+)`, "gi"))) found.push(m[1]!);
  return found;
}

function distance(a: string, b: string): number {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.hypot(p(a, 0) - p(b, 0), p(a, 1) - p(b, 1), p(a, 2) - p(b, 2));
}

/** SVG assets of these projects that use colors outside the brand palette. */
export function svgColorIssues(root: string, projects: Project[], brand: BrandInput): (Issue & { project: string })[] {
  const palette = new Map<string, string>();
  for (const token of Object.keys(brand.color)) {
    const hex = colorValue(brand, token);
    if (hex) palette.set(hex.toUpperCase(), token);
  }
  const logoFiles = new Set([brand.logo?.mark, brand.logo?.wordmark]);
  const issues: (Issue & { project: string })[] = [];
  for (const p of projects) {
    for (const asset of p.assets) {
      if (!asset.endsWith(".svg") || asset.startsWith("fonts/")) continue;
      if (p.kind === "brand" && logoFiles.has(asset)) continue; // logo parts are checked as currentColor art
      const abs = join(p.dir, "assets", asset);
      const off = new Map<string, string>();
      const unknown = new Set<string>();
      for (const raw of svgColors(readFileSync(abs, "utf8"))) {
        const hex = normalizeColor(raw);
        if (hex === null) continue;
        if (hex === undefined) unknown.add(raw.trim());
        else if (!palette.has(hex)) off.set(hex, raw.trim());
      }
      const file = relative(root, abs);
      if (off.size) {
        const detail = [...off.keys()]
          .slice(0, 4)
          .map((hex) => {
            const [nearHex, nearToken] = [...palette].sort((a, b) => distance(hex, a[0]) - distance(hex, b[0]))[0]!;
            return `${off.get(hex)} (nearest brand color: ${nearToken} ${nearHex})`;
          })
          .join("; ");
        issues.push({
          file,
          project: p.id,
          rule: "svg-colors",
          severity: "error",
          message: `uses ${off.size} color${off.size === 1 ? "" : "s"} that ${off.size === 1 ? "is" : "are"} not in the brand: ${detail}.`,
          hint: "Drawings use the brand's colors like everything else. Recolor the SVG with brand values, or add the color to brand.ts if the brand truly needs it.",
        });
      }
      if (unknown.size) {
        issues.push({
          file,
          project: p.id,
          rule: "svg-colors",
          severity: "warning",
          message: `uses colors ided cannot check: ${[...unknown].slice(0, 4).join(", ")}.`,
          hint: "Write SVG colors as hex values from the brand so they can be checked.",
        });
      }
    }
  }
  return issues;
}
