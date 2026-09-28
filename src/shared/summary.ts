import type { BrandInput } from "./brand-schema.ts";
import { factNames, formatFact } from "./brand-data.ts";
import { colorValue, isSurface, typeMetrics } from "./brand-schema.ts";

/** A compact, agent-readable listing of every token in the brand. */
export function brandSummary(b: BrandInput): string {
  const out: string[] = [];
  out.push(`# ${b.name}  (unit ${b.unit}px)`);
  out.push("");
  out.push("surfaces (Box/root `surface`, sets default text + logo):");
  for (const [k, v] of Object.entries(b.color)) {
    if (isSurface(v)) out.push(`  ${k.padEnd(12)} ${v.value}  text=${v.on}${v.logo ? ` logo=${v.logo}` : ""}`);
  }
  out.push("colors (Text/Em/List `color`, Divider `color`, Box `borderColor`):");
  out.push(`  ${Object.keys(b.color).map((k) => `${k}=${colorValue(b, k)}`).join("  ")}`);
  out.push("");
  out.push(`space (gap, pad, inset; also "none"; inset also "margin"):`);
  out.push(`  ${Object.entries(b.space).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  out.push(`radius (also "full", "concentric"):  ${Object.entries(b.radius).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  out.push(`stroke (Divider weight, Box border):  ${Object.entries(b.stroke).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  if (b.size) out.push(`size (width/height):  ${Object.entries(b.size).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  if (b.shadow) out.push(`shadow (Box shadow):  ${Object.keys(b.shadow).join("  ")}`);
  out.push("");
  out.push("type (Text/List `type`):");
  for (const k of Object.keys(b.type)) {
    const m = typeMetrics(b, k)!;
    out.push(`  ${k.padEnd(10)} ${m.size}/${m.lineHeight} w${m.weight}${m.tracking ? ` ${m.tracking}em` : ""}${m.upper ? " UPPER" : ""}`);
  }
  out.push("");
  out.push(`logo variants:  mark  wordmark  ${Object.keys(b.logo.lockups).join("  ")}`);
  out.push(`logo sizes:     ${Object.entries(b.logo.sizes).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  out.push(`colorways:      ${Object.entries(b.logo.colorways).map(([k, v]) => `${k}(${v.mark}/${v.wordmark})`).join("  ")}`);
  out.push(`frame margins:  ${Object.entries(b.margin).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  out.push("");
  const facts = factNames(b.data);
  if (facts.length) {
    out.push('facts (<Fact name="…" /> inside Text; never type these by hand):');
    for (const f of facts) out.push(`  ${f.padEnd(28)} ${formatFact(b.data, f, "full") ?? ""}`);
  } else {
    out.push("facts: none yet. Add names, links, contact, locations, social and abbreviations to `data` in brand.ts; never invent them.");
  }
  return out.join("\n");
}
