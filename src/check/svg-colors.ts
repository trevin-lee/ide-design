// SVG assets are drawings, so their colors are design decisions like any other:
// every color an SVG in assets/ uses must be one of the brand's (transparency on
// top of a brand color is fine). Raster images are photographs and are exempt.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { colorValue, logoFiles, type BrandInput } from "../shared/brand-schema.ts";
import { normalizeColor } from "../shared/color.ts";
import { svgColors } from "../shared/svg-color.ts";
import type { Issue, Project } from "../core/workspace.ts";

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
  const logos = new Set(logoFiles(brand));
  const issues: (Issue & { project: string })[] = [];
  for (const p of projects) {
    for (const asset of p.assets) {
      if (!asset.endsWith(".svg") || asset.startsWith("fonts/")) continue;
      if (p.kind === "brand" && logos.has(asset)) continue; // logo parts have their own rules (brand.ts validation)
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
          hint: "Drawings use the brand's colors like everything else. Recolor the SVG with brand values; a color the brand lacks is the user's call, so propose it before adding it to brand.ts.",
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
