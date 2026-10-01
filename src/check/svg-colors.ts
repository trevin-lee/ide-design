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
  // The logo's own path data: an asset that repeats it is a copy of the logo.
  const brandDir = projects.find((p) => p.kind === "brand")?.dir;
  const logoPaths = new Set<string>();
  for (const f of logos) {
    try {
      for (const m of readFileSync(join(brandDir ?? "", "assets", f), "utf8").matchAll(/\sd="([^"]{40,})"/g)) logoPaths.add(m[1]!);
    } catch {
      // brand validation reports a missing logo file
    }
  }
  for (const p of projects) {
    for (const asset of p.assets) {
      if (asset.startsWith("fonts/") || (p.kind === "brand" && logos.has(asset))) continue;
      const abs = join(p.dir, "assets", asset);
      const name = asset.split("/").pop()!.toLowerCase();
      const named = /^(favicon|app-?icon|apple-touch|logo|mark|wordmark|lockup)([-_.]|$)/.test(name) || /[-_](logo|favicon|wordmark|lockup)[-_.]/.test(name);
      const drawn = asset.endsWith(".svg") && logoPaths.size > 0 && [...readFileSync(abs, "utf8").matchAll(/\sd="([^"]{40,})"/g)].some((m) => logoPaths.has(m[1]!));
      if (named || drawn) {
        issues.push({
          file: relative(root, abs),
          project: p.id,
          rule: "logo-copy",
          severity: "warning",
          message: drawn ? "repeats the logo's drawing: a second copy of the logo, which nothing keeps in step with mark.svg." : "is named like the logo or an icon made from it: a second copy, which nothing keeps in step with mark.svg.",
          hint: "Draw the logo with <Logo> in artifacts, and take favicons and app icons from the brand kit (`ided export brand`, icons/), which draws them from the mark. If this is a different drawing on purpose, give it a name that says what it is.",
        });
      }
      if (!asset.endsWith(".svg")) continue;
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
