// A workspace is a repository with `ided.json` at its root and projects under
// `design/`. This module finds it and validates its shape. The shape is part
// of the contract: anything unexpected is an error, not a surprise.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  ASSET_FILE_RE,
  ASSET_SEGMENT_RE,
  COMPONENT_FILE_RE,
  DOC_PAGES,
  FONT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  isFrameKind,
  FRAME_DIR,
  FRAME_FILE_RE,
  GRAPHIC_SIZES,
  PROJECT_DIR_RE,
  PROJECT_KINDS,
  WEB_VIEWPORTS,
  frameGeometry,
  frameTitleFromFile,
  type FrameGeometry,
  type ProjectKind,
  type ProjectManifest,
} from "../shared/formats.ts";
import { checkDesignDoc, DESIGN_DOC, designSections } from "./design-doc.ts";
import { DESIGN_DIR, GENERATED_DIR, WORKSPACE_MARKER } from "./paths.ts";

export interface Issue {
  /** Path relative to the workspace root. */
  file: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
  hint?: string;
}

export interface FrameFile {
  /** Stable id: the file name without extension, e.g. `01-title`. */
  id: string;
  /** Path relative to the project dir, e.g. `slides/01-title.tsx`. */
  file: string;
  abs: string;
  number: number;
  title: string;
}

export interface Project {
  id: string;
  dir: string;
  kind: ProjectKind;
  title: string;
  manifest: ProjectManifest | null;
  geometry: FrameGeometry | null;
  frames: FrameFile[];
  components: string[];
  /** Asset paths relative to the project's assets/ folder. */
  assets: string[];
  /** Declared library dependencies (the brand is implicit). */
  dependencies: string[];
  issues: Issue[];
}

export interface Workspace {
  root: string;
  designDir: string;
  name: string;
  projects: Project[];
  issues: Issue[];
}

export class WorkspaceNotFoundError extends Error {
  constructor(from: string) {
    super(`No ided workspace found at or above ${from}.\nRun \`ided init\` in your repository root to create one.`);
  }
}

export function findWorkspaceRoot(from = process.cwd()): string | null {
  let dir = canonical(resolve(from));
  for (;;) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireWorkspaceRoot(from = process.cwd()): string {
  const root = findWorkspaceRoot(from);
  if (!root) throw new WorkspaceNotFoundError(from);
  return root;
}

/**
 * Real path of a directory. Vite and the file watcher report real paths, so a
 * workspace reached through a symlink (macOS /tmp, a linked home) must be
 * compared by its real path too.
 */
export function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

const isHidden = (name: string) => name.startsWith(".");

function listDir(dir: string): { name: string; dir: boolean }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => !isHidden(e.name))
    .map((e) => ({ name: e.name, dir: e.isDirectory() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const MANIFEST_KEYS: Record<ProjectKind, string[]> = {
  brand: ["kind", "title"],
  library: ["kind", "title", "dependencies"],
  deck: ["kind", "title", "dependencies"],
  doc: ["kind", "title", "page", "dependencies"],
  graphic: ["kind", "title", "size", "dependencies"],
  web: ["kind", "title", "viewport", "dependencies"],
};

function readManifest(file: string, rel: string, issues: Issue[]): ProjectManifest | null {
  const err = (message: string, hint?: string) => issues.push({ file: rel, rule: "manifest", message, severity: "error", hint });
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    err(`project.json is not valid JSON: ${(e as Error).message}`);
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    err("project.json must be an object.");
    return null;
  }
  const m = raw as Record<string, unknown>;
  const kind = m.kind as ProjectKind;
  if (!PROJECT_KINDS.includes(kind)) {
    err(`"kind" must be one of ${PROJECT_KINDS.map((k) => `"${k}"`).join(", ")}.`);
    return null;
  }
  if (typeof m.title !== "string" || !m.title.trim()) err('"title" must be a non-empty string.');
  for (const k of Object.keys(m)) {
    if (k === "$schema") continue;
    if (!MANIFEST_KEYS[kind].includes(k)) err(`Unknown key "${k}" for a ${kind} project.`, `Allowed keys: ${MANIFEST_KEYS[kind].join(", ")}.`);
  }
  const need = (key: string, options: readonly string[]) => {
    if (!options.includes(m[key] as string)) err(`A ${kind} project needs "${key}": one of ${options.map((o) => `"${o}"`).join(", ")}.`);
  };
  if (kind === "doc") need("page", Object.keys(DOC_PAGES));
  if (kind === "graphic") need("size", Object.keys(GRAPHIC_SIZES));
  if (kind === "web") need("viewport", Object.keys(WEB_VIEWPORTS));
  if (m.dependencies !== undefined && (!Array.isArray(m.dependencies) || m.dependencies.some((d) => typeof d !== "string"))) {
    err('"dependencies" is an array of library names, e.g. ["kit"].');
  }
  if (issues.some((i) => i.file === rel && i.severity === "error")) return null;
  return m as unknown as ProjectManifest;
}

function scanProject(root: string, designDir: string, id: string): Project {
  const dir = join(designDir, id);
  const rel = (p: string) => relative(root, p);
  const issues: Issue[] = [];
  const err = (file: string, rule: string, message: string, hint?: string) => issues.push({ file: rel(file), rule, message, severity: "error", hint });
  const project: Project = { id, dir, kind: "deck", title: id, manifest: null, geometry: null, frames: [], components: [], assets: [], dependencies: [], issues };

  if (!PROJECT_DIR_RE.test(id)) err(dir, "project-name", `Project folder "${id}" must be lowercase kebab-case.`);
  const manifestPath = join(dir, "project.json");
  if (!existsSync(manifestPath)) {
    err(dir, "manifest", "Missing project.json.", 'Every project folder has a project.json like { "kind": "deck", "title": "Q3 Review" }. Create one with `ided new`.');
    return project;
  }
  const manifest = readManifest(manifestPath, rel(manifestPath), issues);
  if (!manifest) return project;
  project.manifest = manifest;
  project.kind = manifest.kind;
  project.title = manifest.title;
  project.geometry = frameGeometry(manifest);
  project.dependencies = "dependencies" in manifest ? [...new Set(manifest.dependencies ?? [])] : [];

  if (manifest.kind === "brand" && id !== "brand") err(dir, "brand", 'The brand project must live in design/brand.');
  if (manifest.kind !== "brand" && id === "brand") err(dir, "brand", 'design/brand is reserved for the brand project ("kind": "brand").');

  const frameDir = isFrameKind(manifest.kind) ? FRAME_DIR[manifest.kind] : null;
  const allowed = new Set(["project.json", DESIGN_DOC, "README.md", "components", "assets"]);
  if (frameDir) allowed.add(frameDir);
  if (frameDir) allowed.add("comments.json");
  if (manifest.kind === "brand") allowed.add("brand.ts");

  for (const entry of listDir(dir)) {
    if (!allowed.has(entry.name)) {
      err(join(dir, entry.name), "structure", `Unexpected ${entry.dir ? "folder" : "file"} "${entry.name}" in a ${manifest.kind} project.`, `A ${manifest.kind} project contains only: ${[...allowed].join(", ")}.`);
    }
  }

  const docPath = join(dir, DESIGN_DOC);
  if (!existsSync(docPath)) {
    err(docPath, "design-doc", `Missing ${DESIGN_DOC}.`, `Every project explains its design: who it is for, the message, the concept and the reasoning. Run \`ided init\` to add the template to every project that lacks one (workspaces from ided 0.1), then write it.`);
  } else {
    const status = checkDesignDoc(manifest.kind, readFileSync(docPath, "utf8"));
    if (status.missing.length) {
      err(docPath, "design-doc", `${DESIGN_DOC} is missing ${status.missing.map((t) => `"## ${t}"`).join(", ")}.`, `A ${manifest.kind} design document has these sections: ${designSections(manifest.kind).map((x) => x.title).join(", ")}.`);
    }
    if (status.empty.length) {
      issues.push({
        file: rel(docPath),
        rule: "design-doc",
        message: `${DESIGN_DOC}: ${status.empty.join(", ")} ${status.empty.length === 1 ? "is" : "are"} not written yet.`,
        severity: "warning",
        hint: "Each section's prompt says what it must answer. Write the brief, message and concept before designing the frames.",
      });
    }
  }

  if (manifest.kind === "brand" && !existsSync(join(dir, "brand.ts"))) {
    err(dir, "brand", "Missing brand.ts.", "brand.ts exports default defineBrand({...}).");
  }

  if (frameDir) {
    const fdir = join(dir, frameDir);
    const seen = new Map<number, string>();
    for (const entry of listDir(fdir)) {
      const abs = join(fdir, entry.name);
      if (entry.dir) {
        err(abs, "structure", `Folders are not allowed inside ${frameDir}/.`, `Shared pieces go in components/.`);
        continue;
      }
      const m = FRAME_FILE_RE.exec(entry.name);
      if (!m) {
        err(abs, "frame-name", `"${entry.name}" is not a valid frame file name.`, `Frame files are NN-kebab-name.tsx, e.g. 01-title.tsx. Use \`ided add ${id} <name>\`.`);
        continue;
      }
      const number = Number(m[1]);
      if (seen.has(number)) err(abs, "frame-name", `Frame number ${m[1]} is used by both ${seen.get(number)} and ${entry.name}.`);
      seen.set(number, entry.name);
      project.frames.push({ id: entry.name.replace(/\.tsx$/, ""), file: `${frameDir}/${entry.name}`, abs, number, title: frameTitleFromFile(entry.name) });
    }
    project.frames.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
    if (project.frames.length === 0) {
      issues.push({ file: rel(dir), rule: "empty", message: `No ${frameDir} yet.`, severity: "warning", hint: `Add one with \`ided add ${id} <name>\`.` });
    }
  }

  if (manifest.kind === "library" && !existsSync(join(dir, "components")) && !existsSync(join(dir, "assets"))) {
    issues.push({ file: rel(dir), rule: "empty", message: "Library has no components/ or assets/ yet.", severity: "warning", hint: `Add a component with \`ided add ${id} <name>\`.` });
  }

  scanAssets(project, rel, err);

  for (const entry of listDir(join(dir, "components"))) {
    const abs = join(dir, "components", entry.name);
    if (entry.dir || !COMPONENT_FILE_RE.test(entry.name)) {
      err(abs, "component-name", `"${entry.name}" is not a valid component file.`, "Component files are kebab-case .tsx files directly inside components/.");
      continue;
    }
    project.components.push(`components/${entry.name}`);
  }
  return project;
}

const IMAGES = new Set<string>(IMAGE_EXTENSIONS);
const FONTS = new Set<string>(FONT_EXTENSIONS);

/**
 * assets/ holds images in kebab-case folders. Only the brand may have fonts/,
 * which holds font files and their license texts.
 */
function scanAssets(project: Project, rel: (p: string) => string, err: (file: string, rule: string, message: string, hint?: string) => void) {
  const walk = (d: string, prefix: string, inFonts: boolean) => {
    for (const e of listDir(d)) {
      const abs = join(d, e.name);
      if (e.dir) {
        const fonts = prefix === "" && e.name === "fonts";
        if (fonts && project.kind !== "brand") {
          err(abs, "asset-name", "Only the brand ships fonts.", "Fonts are brand decisions; add them to design/brand/assets/fonts/.");
          continue;
        }
        if (!ASSET_SEGMENT_RE.test(e.name)) {
          err(abs, "asset-name", `Asset folder "${e.name}" must be lowercase kebab-case.`);
          continue;
        }
        walk(abs, `${prefix}${e.name}/`, fonts);
        continue;
      }
      const m = ASSET_FILE_RE.exec(e.name);
      const ext = m?.[2];
      if (!m) {
        err(abs, "asset-name", `"${e.name}" is not a valid asset name.`, "Asset files are lowercase kebab-case with an extension, e.g. team-offsite.jpg.");
        continue;
      }
      const ok = inFonts ? FONTS.has(ext!) || ext === "txt" : IMAGES.has(ext!);
      if (!ok) {
        err(abs, "asset-type", `".${ext}" is not an allowed ${inFonts ? "font" : "image"} format.`, inFonts ? `Fonts: ${FONT_EXTENSIONS.join(", ")} (plus .txt licenses).` : `Images: ${IMAGE_EXTENSIONS.join(", ")}.`);
        continue;
      }
      project.assets.push(`${prefix}${e.name}`);
    }
  };
  walk(join(project.dir, "assets"), "", false);
}

/** Dependencies must name existing libraries and must not form a cycle. */
function checkDependencies(ws: Workspace, root: string) {
  const byId = new Map(ws.projects.map((p) => [p.id, p]));
  for (const p of ws.projects) {
    const file = relative(root, join(p.dir, "project.json"));
    for (const d of p.dependencies) {
      const target = byId.get(d);
      const issue = (message: string, hint?: string) => p.issues.push({ file, rule: "dependencies", message, severity: "error", hint });
      if (d === "brand") issue('"brand" is always available; do not list it in dependencies.');
      else if (d === p.id) issue("A project cannot depend on itself.");
      else if (!target) issue(`Dependency "${d}" is not a project in design/.`, `Create it with \`ided new library ${d}\`.`);
      else if (target.kind !== "library") issue(`"${d}" is a ${target.kind}; only libraries can be dependencies.`, "Move the shared pieces into a library (`ided new library <name>`).");
    }
  }
  // Cycle detection over library → library edges.
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      const cycle = [...path.slice(path.indexOf(id)), id];
      const p = byId.get(id)!;
      p.issues.push({ file: relative(root, join(p.dir, "project.json")), rule: "dependencies", message: `Dependency cycle: ${cycle.join(" → ")}.`, severity: "error" });
      return;
    }
    state.set(id, "visiting");
    for (const d of byId.get(id)?.dependencies ?? []) if (byId.get(d)?.kind === "library") visit(d, [...path, id]);
    state.set(id, "done");
  };
  for (const p of ws.projects) visit(p.id, []);
}

/** Projects that depend on `id`, directly. */
export function dependentsOf(ws: Workspace, id: string): string[] {
  return ws.projects.filter((p) => p.dependencies.includes(id)).map((p) => p.id);
}

export function scanWorkspace(rootPath: string): Workspace {
  const root = canonical(rootPath);
  const designDir = join(root, DESIGN_DIR);
  const issues: Issue[] = [];
  const ws: Workspace = { root, designDir, name: root.split(/[\\/]/).pop() ?? "workspace", projects: [], issues };
  if (!existsSync(designDir) || !statSync(designDir).isDirectory()) {
    issues.push({ file: DESIGN_DIR, rule: "structure", message: "Missing design/ folder.", severity: "error", hint: "Run `ided init`." });
    return ws;
  }
  for (const entry of listDir(designDir)) {
    if (!entry.dir) {
      if (entry.name === "tsconfig.json") continue;
      issues.push({ file: `${DESIGN_DIR}/${entry.name}`, rule: "structure", message: `Unexpected file "${entry.name}" in design/.`, severity: "error", hint: "design/ contains only project folders and tsconfig.json." });
      continue;
    }
    if (entry.name === GENERATED_DIR) continue;
    ws.projects.push(scanProject(root, designDir, entry.name));
  }
  const brand = ws.projects.find((p) => p.id === "brand");
  if (!brand) {
    issues.push({ file: `${DESIGN_DIR}/brand`, rule: "brand", message: "Missing the brand project (design/brand).", severity: "error", hint: "Every workspace has exactly one brand. Run `ided init` to create a starter." });
  }
  checkDependencies(ws, root);
  // Brand first, then alphabetical.
  ws.projects.sort((a, b) => (a.id === "brand" ? -1 : b.id === "brand" ? 1 : a.id.localeCompare(b.id)));
  return ws;
}

export function allIssues(ws: Workspace): Issue[] {
  return [...ws.issues, ...ws.projects.flatMap((p) => p.issues)];
}

export function getProject(ws: Workspace, id: string): Project {
  const p = ws.projects.find((x) => x.id === id);
  if (!p) {
    const names = ws.projects.map((x) => x.id).join(", ") || "(none)";
    throw new Error(`No project "${id}" in ${ws.designDir}. Projects: ${names}`);
  }
  return p;
}

/** Files an artifact author writes: frames, components and brand.ts. */
export function sourceFiles(p: Project): string[] {
  const files = [...p.frames.map((f) => f.abs), ...p.components.map((c) => join(p.dir, c))];
  if (p.kind === "brand" && existsSync(join(p.dir, "brand.ts"))) files.push(join(p.dir, "brand.ts"));
  return files;
}

export function listBrandAssets(ws: Workspace): string[] {
  const dir = join(ws.designDir, "brand", "assets");
  const out: string[] = [];
  const walk = (d: string, prefix: string) => {
    for (const e of listDir(d)) {
      if (e.dir) walk(join(d, e.name), `${prefix}${e.name}/`);
      else out.push(`${prefix}${e.name}`);
    }
  };
  walk(dir, "");
  return out;
}
