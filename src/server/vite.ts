// One Vite instance serves the viewer app and the user's artifacts from the
// global install. Artifacts resolve `ided` and React from this package, so a
// workspace needs no node_modules of its own.

import react from "@vitejs/plugin-react";
import { existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { frameGeometry } from "../shared/formats.ts";
import { APP_DIR, DESIGN_DIR, GENERATED_DIR, PKG_ROOT, RUNTIME_ENTRY } from "../core/paths.ts";
import { writeGenerated } from "../core/scaffold.ts";
import { canonical, dependentsOf, listBrandAssets, scanWorkspace, type Workspace } from "../core/workspace.ts";
import { injectSourceLocations } from "./source-locations.ts";

export const VIRTUAL_ID = "virtual:ided/workspace";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

const fsUrl = (abs: string) => `/@fs${abs.startsWith("/") ? "" : "/"}${abs.replace(/\\/g, "/")}`;

/** Code for the virtual module listing every project and lazily importing its frames. */
export function workspaceModule(ws: Workspace): string {
  const lines: string[] = [];
  const brandDir = join(ws.designDir, "brand");
  const brandFile = join(brandDir, "brand.ts");
  const hasBrand = existsSync(brandFile);
  lines.push(hasBrand ? `import * as brandModule from ${JSON.stringify(fsUrl(brandFile))};` : "const brandModule = {};");
  const svgs = listBrandAssets(ws).filter((a) => a.endsWith(".svg"));
  svgs.forEach((a, i) => lines.push(`import svg${i} from ${JSON.stringify(fsUrl(join(brandDir, "assets", a)) + "?raw")};`));
  lines.push(`export const brand = brandModule.default ?? null;`);
  lines.push(`export const svgs = {${svgs.map((a, i) => `${JSON.stringify(a)}: svg${i}`).join(", ")}};`);
  lines.push(`export const brandAssetBase = ${JSON.stringify(fsUrl(join(brandDir, "assets")) + "/")};`);
  const projects = ws.projects.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    manifest: p.manifest,
    geometry: p.manifest ? frameGeometry(p.manifest) : null,
    issues: p.issues,
    dependencies: p.dependencies,
    dependents: dependentsOf(ws, p.id),
    components: p.components,
    assets: p.assets.filter((a) => !a.startsWith("fonts/")).map((a) => ({ path: a, url: fsUrl(join(p.dir, "assets", a)) })),
    frames: p.frames.map((f) => ({ id: f.id, file: f.file, title: f.title, number: f.number, abs: f.abs, src: relative(ws.root, f.abs) })),
  }));
  const loaders = ws.projects.flatMap((p) => p.frames.map((f) => `${JSON.stringify(`${p.id}/${f.id}`)}: () => import(${JSON.stringify(fsUrl(f.abs))})`));
  lines.push(`export const workspace = ${JSON.stringify({ name: ws.name, root: ws.root, issues: ws.issues })};`);
  lines.push(`export const projects = ${JSON.stringify(projects)};`);
  lines.push(`export const loaders = {${loaders.join(",\n")}};`);
  return lines.join("\n");
}

function idedPlugin(root: string, onWorkspaceChange: (ws: Workspace, kind: "structure" | "comments") => void): Plugin {
  const designDir = join(root, DESIGN_DIR);
  const generated = join(designDir, GENERATED_DIR);
  let server: ViteDevServer | undefined;
  return {
    name: "ided",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      if (id === "ided") return RUNTIME_ENTRY;
      // Artifacts compile with jsxImportSource "ided" (from design/tsconfig.json);
      // at runtime that is exactly React's JSX runtime, resolved from this package.
      if (id === "ided/jsx-runtime" || id === "ided/jsx-dev-runtime") {
        return this.resolve(id.replace("ided/", "react/"), join(APP_DIR, "main.tsx"), { skipSelf: true });
      }
      // Package paths: @<project>/components/<name> and @<project>/assets/<file>.
      // Which packages a file may import is the lint's job; here we only resolve.
      const pkg = /^@([a-z0-9]+(?:-[a-z0-9]+)*)\/((?:components|assets)\/.+)$/.exec(id);
      if (pkg && (!importer || importer.startsWith(designDir) || importer.startsWith("\0"))) {
        const base = join(designDir, pkg[1]!, pkg[2]!);
        for (const ext of ["", ".tsx", ".ts"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
      }
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) return workspaceModule(scanWorkspace(root));
      return null;
    },
    transform(code, id) {
      const file = id.split("?")[0]!;
      if (!file.startsWith(designDir) || file.startsWith(generated) || !file.endsWith(".tsx")) return null;
      return injectSourceLocations(code, file, relative(root, file));
    },
    configureServer(s) {
      server = s;
      // Every page load gets the workspace as it is now. The file watcher alone
      // lags behind a project created a moment earlier (an agent's `new` then
      // `screenshot`), and the page would report that the project does not exist.
      s.middlewares.use((req, _res, next) => {
        if (req.url?.includes("virtual:ided/workspace")) {
          const mod = s.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
          if (mod) s.moduleGraph.invalidateModule(mod);
        }
        next();
      });
      s.watcher.add(designDir);
      const onFs = (event: string) => (path: string) => {
        if (!path.startsWith(designDir) || path.startsWith(generated)) return;
        const name = path.split(/[\\/]/).pop() ?? "";
        const isComments = name === "comments.json";
        const structural = event !== "change" || name === "project.json";
        if (!isComments && !structural) return;
        if (process.env.IDED_DEBUG) console.error(`[ided] ${event} ${path}`);
        const mod = server?.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) server?.moduleGraph.invalidateModule(mod);
        if (structural) writeGenerated(root); // asset and package declarations for the editor
        onWorkspaceChange(scanWorkspace(root), isComments ? "comments" : "structure");
      };
      for (const ev of ["add", "unlink", "addDir", "unlinkDir", "change"]) s.watcher.on(ev, onFs(ev));
    },
  };
}

export interface IdedViteOptions {
  root: string;
  ssrOnly?: boolean;
  /** HTTP server to attach the HMR websocket to (middleware mode). */
  hmrServer?: import("node:http").Server;
  plugins?: Plugin[];
  onWorkspaceChange?: (ws: Workspace, kind: "structure" | "comments") => void;
}

export async function createIdedVite(input: IdedViteOptions): Promise<ViteDevServer> {
  const opts = { ...input, root: canonical(input.root) };
  const cacheDir = join(opts.root, DESIGN_DIR, GENERATED_DIR, "cache");
  return createServer({
    configFile: false,
    root: APP_DIR,
    cacheDir,
    // The checker reports load errors itself; Vite's stack traces would only be noise.
    logLevel: process.env.IDED_DEBUG ? "info" : opts.ssrOnly ? "silent" : "warn",
    clearScreen: false,
    appType: opts.ssrOnly ? "custom" : "spa",
    plugins: [idedPlugin(opts.root, opts.onWorkspaceChange ?? (() => {})), ...(opts.ssrOnly ? [] : [react()]), ...(opts.plugins ?? [])],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    oxc: opts.ssrOnly ? { jsx: { runtime: "automatic", importSource: "react", development: false } } : undefined,
    server: {
      middlewareMode: true,
      hmr: opts.ssrOnly ? false : { server: opts.hmrServer },
      watch: opts.ssrOnly ? null : undefined,
      // Serve the package and design/ only, never the rest of the repository.
      fs: { strict: true, allow: [PKG_ROOT, join(opts.root, DESIGN_DIR)], deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.git/**"] },
    },
    optimizeDeps: {
      entries: [join(APP_DIR, "main.tsx")],
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  });
}
