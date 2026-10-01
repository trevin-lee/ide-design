// Finding and rewriting the colors an SVG declares. One reader for every place that needs it: the
// asset check, logo validation and the recoloring of logo parts per colorway.

const PROPS = "fill|stroke|stop-color|flood-color|lighting-color|color";

const ATTR = () => new RegExp(`(\\s(?:${PROPS})\\s*=\\s*)(?:"([^"]*)"|'([^']*)')`, "gi");
const DECL = () => new RegExp(`((?:^|[;{\\s"'])(?:${PROPS})\\s*:\\s*)([^;"'}]+)`, "gi");

/** Every color declaration in an SVG, as written: attributes, inline styles and <style> blocks. */
export function svgColors(svg: string): string[] {
  const found: string[] = [];
  for (const m of svg.matchAll(ATTR())) found.push(m[2] ?? m[3]!);
  for (const m of svg.matchAll(DECL())) found.push(m[2]!);
  return found;
}

/** Rewrites each color declaration `to` returns a value for; the rest stays as written. */
export function mapSvgColors(svg: string, to: (raw: string) => string | undefined): string {
  return svg
    .replace(ATTR(), (all, head: string, dq?: string, sq?: string) => {
      const raw = dq ?? sq!;
      const next = to(raw);
      return next === undefined ? all : `${head}${dq !== undefined ? `"${next}"` : `'${next}'`}`;
    })
    .replace(DECL(), (all, head: string, raw: string) => {
      const next = to(raw);
      return next === undefined ? all : `${head}${next}${/\s$/.test(raw) ? " " : ""}`;
    });
}
