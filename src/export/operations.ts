// The export operations behind `ided export`, the MCP server's ided_export and the viewer's
// download buttons, so they cannot drift: the same checks, folder names and defaults everywhere.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright-core";
import type { ViteDevServer } from "vite";
import { loadBrand } from "../core/load-brand.ts";
import { slugify } from "../core/scaffold.ts";
import { getProject, scanWorkspace, type Project, type Workspace } from "../core/workspace.ts";
import { exportProject, writeExport, type ExportedFile, type ExportFormat } from "./artifacts.ts";
import { buildBrandKit, writeBrandKit, zipBrandKit, type KitFile } from "./brand-kit.ts";

/** Web screens have no page size, so they export as PNG; everything else as PDF. */
export function defaultFormat(p: Project): ExportFormat {
  return p.kind === "web" ? "png" : "pdf";
}

export interface BrandKit {
  /** Folder name, e.g. `acme-brand-kit`. */
  folder: string;
  files: KitFile[];
}

/** The brand kit's files, refusing a brand that has errors. */
export async function buildKit(vite: ViteDevServer, ws: Workspace, version?: string): Promise<BrandKit> {
  const loaded = await loadBrand(vite, ws);
  if (!loaded.brand) throw new Error(loaded.error ?? "Brand did not load.");
  const errors = loaded.issues.filter((i) => i.severity === "error");
  if (errors.length) throw new Error(`The brand has errors; fix them first (\`ided check brand\`):\n${errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`);
  const files = buildBrandKit({ brand: loaded.brand, svgs: loaded.svgs, brandAssetsDir: join(ws.designDir, "brand", "assets"), version });
  return { folder: `${slugify(loaded.brand.name) || "brand"}-brand-kit`, files };
}

/** Writes the brand kit to `<out>/<name>-brand-kit/` and, with `zip`, `<out>/<name>-brand-kit.zip`. */
export async function exportBrandKit(root: string, opts: { out: string; zip?: boolean; version?: string }): Promise<{ dir: string; count: number; zip?: string }> {
  const { createIdedVite } = await import("../server/vite.ts");
  const vite = await createIdedVite({ root, ssrOnly: true });
  try {
    const kit = await buildKit(vite, scanWorkspace(root), opts.version);
    const dir = join(opts.out, kit.folder);
    writeBrandKit(kit.files, dir);
    let zip: string | undefined;
    if (opts.zip) {
      zip = join(opts.out, `${kit.folder}.zip`);
      writeFileSync(zip, zipBrandKit(kit.files, kit.folder));
    }
    return { dir, count: kit.files.length, zip };
  } finally {
    await vite.close();
  }
}

/**
 * Exports a project's frames: one PDF in `out`, or one image per frame in `out/<project>/`.
 * Pass a running viewer and browser to reuse them; otherwise both are started and stopped here.
 */
export async function exportArtifacts(
  root: string,
  projectId: string,
  opts: { out: string; format?: ExportFormat; frames?: string[]; scale?: number; baseUrl?: string; browser?: Browser },
): Promise<string[]> {
  const project = getProject(scanWorkspace(root), projectId);
  const format = opts.format ?? defaultFormat(project);
  const run = (baseUrl: string) => exportProject({ baseUrl, project, format, frames: opts.frames, scale: opts.scale, browser: opts.browser });
  let files: ExportedFile[];
  if (opts.baseUrl) files = await run(opts.baseUrl);
  else {
    const { startServer } = await import("../server/index.ts");
    const server = await startServer({ root, port: 0 });
    try {
      files = await run(server.url);
    } finally {
      await server.close();
    }
  }
  return writeExport(files, format === "pdf" ? opts.out : join(opts.out, project.id));
}
