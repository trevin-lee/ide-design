import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { validateBrand, type BrandInput, type BrandIssue } from "../shared/brand-schema.ts";
import { listBrandAssets, type Workspace } from "./workspace.ts";

export interface LoadedBrand {
  brand: BrandInput | null;
  svgs: Record<string, string>;
  issues: BrandIssue[];
  error?: string;
}

/** Load design/brand/brand.ts through Vite (so it can import `ided`) and validate it. */
export async function loadBrand(vite: ViteDevServer, ws: Workspace): Promise<LoadedBrand> {
  const dir = join(ws.designDir, "brand");
  const svgs: Record<string, string> = {};
  for (const a of listBrandAssets(ws)) if (a.endsWith(".svg")) svgs[a] = readFileSync(join(dir, "assets", a), "utf8");
  let brand: BrandInput | null = null;
  try {
    const mod = await vite.ssrLoadModule(join(dir, "brand.ts"));
    brand = (mod.default ?? null) as BrandInput | null;
  } catch (e) {
    return { brand: null, svgs, issues: [], error: (e as Error).message };
  }
  if (!brand) return { brand: null, svgs, issues: [{ path: "", message: "brand.ts must `export default defineBrand({...})`.", severity: "error" }] };
  return { brand, svgs, issues: validateBrand(brand, svgs) };
}
