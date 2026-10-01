import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import pc from "picocolors";
import type { ViteDevServer } from "vite";
import { loadBrand } from "../core/load-brand.ts";
import { RUNTIME_DIR } from "../core/paths.ts";
import { writeGenerated } from "../core/scaffold.ts";
import { allIssues, canonical, scanWorkspace, sourceFiles, withDependents, type Issue, type Project, type Workspace } from "../core/workspace.ts";
import type { FrameKind } from "../shared/formats.ts";
import { createIdedVite } from "../server/vite.ts";
import { lintFile, type FileRole } from "./lint.ts";
import { svgColorIssues } from "./svg-colors.ts";
import { typecheck } from "./typecheck.ts";

export type IssueSource = "structure" | "lint" | "types" | "render" | "layout" | "brand" | "assets";
export interface CheckIssue extends Issue {
  source: IssueSource;
  project: string | null;
}

export interface CheckResult {
  issues: CheckIssue[];
  projects: { id: string; kind: string; frames: number }[];
  /** Layers that did not run, and why: a clean result says nothing about them. */
  skipped: string[];
}

export interface CheckOptions {
  project?: string;
  /** Server-render every frame to run the runtime rules (contrast, concentric radii, root). */
  render?: boolean;
  /** Also lay every frame out in the pinned Chromium and measure it (overflow, ratios, crops). Needs `render`. */
  layout?: boolean;
  /** Reuse a running Vite server instead of starting one. */
  vite?: ViteDevServer;
}

function roleOf(p: Project, abs: string): FileRole {
  if (p.kind === "brand" && abs.endsWith("brand.ts")) return "brand";
  return p.frames.some((f) => f.abs === abs) ? "frame" : "component";
}

function projectOf(ws: Workspace, file: string): string | null {
  const abs = join(ws.root, file);
  return ws.projects.find((p) => abs === p.dir || abs.startsWith(p.dir + "/"))?.id ?? null;
}

/** Lint results depend only on the file and its package context, so they are reused until either changes. */
const lintCache = new Map<string, { key: string; issues: Issue[] }>();
function cachedLint(abs: string, role: FileRole, p: Project, root: string, packages: Map<string, string>): Issue[] {
  const key = `${statSync(abs).mtimeMs}|${role}|${p.dependencies.join(",")}|${[...packages].map(([k, v]) => `${k}:${v}`).join(",")}`;
  const hit = lintCache.get(abs);
  if (hit?.key === key) return hit.issues;
  const issues = lintFile(abs, readFileSync(abs, "utf8"), role, p, root, packages);
  lintCache.set(abs, { key, issues });
  return issues;
}

/** Structure + lint + types. Fast: no Vite, no rendering. */
export function staticCheck(rootPath: string, projectId?: string): CheckIssue[] {
  const root = canonical(rootPath);
  writeGenerated(root);
  const ws = scanWorkspace(root);
  if (projectId && !ws.projects.some((p) => p.id === projectId)) throw new Error(`No project "${projectId}". Projects: ${ws.projects.map((p) => p.id).join(", ")}`);
  // A project's check covers what depends on it: a library change can break its users, a brand change everything.
  const scope = projectId ? withDependents(ws, projectId) : null;
  const projects = scope ? ws.projects.filter((p) => scope.includes(p.id)) : ws.projects;
  const out: CheckIssue[] = [];
  const structural = projectId ? projects.flatMap((p) => p.issues) : allIssues(ws);
  for (const i of structural) out.push({ ...i, source: "structure", project: projectOf(ws, i.file) });
  const files = new Set<string>();
  const packages = new Map(ws.projects.map((p) => [p.id, p.kind]));
  for (const p of projects) {
    for (const abs of sourceFiles(p)) {
      files.add(abs);
      for (const i of cachedLint(abs, roleOf(p, abs), p, root, packages)) out.push({ ...i, source: "lint", project: p.id });
    }
  }
  const brandProject = ws.projects.find((p) => p.id === "brand");
  if (brandProject?.manifest) {
    for (const i of typecheck(root, projectId ? files : undefined)) out.push({ ...i, source: "types", project: projectOf(ws, i.file) });
  }
  return dedupe(out);
}

/** TypeScript codes that restate a lint or render finding on the same line. */
const ECHO_CODES = new Set(["ts2339", "ts2786", "ts2307", "ts2322", "ts2820", "ts2741"]);

/**
 * One mistake is often caught by several layers (lint, types, render). Keep
 * the most actionable report per line so the output reads like a to-do list.
 */
function dedupe(list: CheckIssue[]): CheckIssue[] {
  const seen = new Set<string>();
  const lineKey = (i: CheckIssue) => `${i.file}:${i.line}`;
  const explained = new Set(list.filter((i) => i.source === "lint" || i.source === "render").map(lineKey));
  const tokenLines = new Set(list.filter((i) => i.rule === "invalid-token").map(lineKey));
  const htmlLines = new Set(list.filter((i) => i.rule === "no-html").map(lineKey));
  const unresolved = new Set(list.filter((i) => i.rule === "ts2307").map((i) => i.file));
  return list.filter((i) => {
    if (i.line && i.source === "types" && ECHO_CODES.has(i.rule) && explained.has(lineKey(i))) return false;
    if (i.line && i.rule === "no-raw-values" && tokenLines.has(lineKey(i))) return false;
    if (i.line && i.rule === "no-escape-hatch" && htmlLines.has(lineKey(i))) return false;
    if (i.rule === "load-error" && unresolved.has(i.file)) return false;
    const k = `${i.file}:${i.line}:${i.column}:${i.rule}:${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseSrc(src: string | undefined): { file: string; line?: number; column?: number } | null {
  if (!src) return null;
  const m = /^(.*?):(\d+):(\d+)$/.exec(src);
  return m ? { file: m[1]!, line: Number(m[2]), column: Number(m[3]) } : { file: src };
}

export async function runCheck(rootPath: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const root = canonical(rootPath);
  const issues = staticCheck(root, opts.project);
  const ws = scanWorkspace(root);
  const scope = opts.project ? withDependents(ws, opts.project) : null;
  const projects = scope ? ws.projects.filter((p) => scope.includes(p.id)) : ws.projects;
  const skipped: string[] = [];
  if (opts.render === false) skipped.push("render audit and layout (--no-render)");
  else if (opts.layout === false) skipped.push("layout (--no-layout)");

  const vite = opts.vite ?? (await createIdedVite({ root, ssrOnly: true }));
  try {
    // The brand is validated on every check: every project depends on it.
    const loaded = await loadBrand(vite, ws);
    if (loaded.error) {
      issues.push({ file: relative(root, join(ws.designDir, "brand", "brand.ts")), rule: "brand-load", message: loaded.error, severity: "error", source: "brand", project: "brand" });
    }
    for (const i of loaded.issues) {
      issues.push({ file: "design/brand/brand.ts", rule: "brand", message: `${i.path ? `${i.path}: ` : ""}${i.message}`, severity: i.severity, source: "brand", project: "brand" });
    }
    if (!loaded.brand) {
      if (opts.render !== false) skipped.push("render audit, layout and SVG colors (brand.ts does not load)");
    } else if (opts.render !== false) {
      for (const i of svgColorIssues(root, projects, loaded.brand)) issues.push({ ...i, source: "assets" });
      const ssr = (await vite.ssrLoadModule(join(RUNTIME_DIR, "ssr.tsx"))) as typeof import("../runtime/ssr.tsx");
      for (const p of projects) {
        if (p.kind === "brand" || !p.geometry) continue;
        for (const [index, f] of p.frames.entries()) {
          const rel = relative(root, f.abs);
          // Skip frames that already fail to type-check; their render errors would just repeat.
          let mod: { default?: unknown };
          try {
            mod = await vite.ssrLoadModule(f.abs);
          } catch (e) {
            issues.push({ file: rel, rule: "load-error", message: (e as Error).message.split("\n")[0]!, severity: "error", source: "render", project: p.id });
            continue;
          }
          if (typeof mod.default !== "function") continue; // reported by lint
          // A responsive web screen renders once per viewport; what fails on only some says where.
          const variants = p.geometry.viewports ?? [null];
          const variantViolations = variants.flatMap((vp) =>
            ssr
              .renderFrame({
                brand: loaded.brand!,
                svgs: loaded.svgs,
                kind: p.kind as FrameKind,
                project: p.id,
                file: rel,
                geometry: vp ? { ...p.geometry!, width: vp.width, height: vp.height } : p.geometry!,
                index,
                total: p.frames.length,
                Component: mod.default as never,
                viewport: vp?.name,
              })
              .violations.map((v) => ({ ...v, viewport: vp?.name })),
          );
          const found = new Map<string, { v: (typeof variantViolations)[number]; on: string[] }>();
          for (const v of variantViolations) {
            const key = `${v.rule}|${v.src}|${v.message}`;
            const entry = found.get(key) ?? { v, on: [] };
            if (v.viewport) entry.on.push(v.viewport);
            found.set(key, entry);
          }
          for (const { v, on } of found.values()) {
            const loc = parseSrc(v.src) ?? { file: rel };
            const where = on.length && on.length < variants.length ? ` (${on.join(", ")})` : "";
            issues.push({ file: loc.file, line: loc.line, column: loc.column, rule: v.rule, message: v.message + where, hint: v.hint, severity: v.severity, source: "render", project: p.id });
          }
        }
      }
      if (opts.layout !== false) {
        const { layoutIssues } = await import("./layout.ts");
        const layout = await layoutIssues(root, projects, parseSrc);
        issues.push(...layout.issues);
        if (layout.skipped) skipped.push(`layout (${layout.skipped})`);
      }
    }
  } finally {
    if (!opts.vite) await vite.close();
  }
  return { issues: dedupe(issues), projects: projects.map((p) => ({ id: p.id, kind: p.kind, frames: p.frames.length })), skipped };
}

export function formatIssues(result: CheckResult): string {
  const lines: string[] = [];
  const byFile = new Map<string, CheckIssue[]>();
  for (const i of result.issues) {
    const list = byFile.get(i.file) ?? [];
    list.push(i);
    byFile.set(i.file, list);
  }
  const files = [...byFile.keys()].sort();
  for (const f of files) {
    lines.push(pc.underline(f));
    const list = byFile.get(f)!.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
    for (const i of list) {
      const loc = i.line ? `${i.line}:${i.column ?? 1}` : "";
      const sev = i.severity === "error" ? pc.red("error") : pc.yellow("warn ");
      lines.push(`  ${pc.dim(loc.padEnd(7))} ${sev}  ${i.message}  ${pc.dim(i.rule)}`);
      if (i.hint) lines.push(`  ${" ".repeat(7)}        ${pc.cyan("→")} ${i.hint}`);
    }
    lines.push("");
  }
  const errors = result.issues.filter((i) => i.severity === "error").length;
  const warnings = result.issues.length - errors;
  const scope = result.projects.map((p) => `${p.id}${p.kind === "brand" || p.kind === "library" ? "" : ` (${p.frames})`}`).join(", ");
  if (errors === 0 && warnings === 0) lines.push(`${pc.green("✔")} Clean: ${scope}`);
  else lines.push(`${errors ? pc.red("✖") : pc.yellow("!")} ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"} · ${scope}`);
  // Say what was not looked at, so a clean result is never mistaken for a full one.
  if (result.skipped.length) lines.push(pc.yellow(`  Not checked: ${result.skipped.join("; ")}.`));
  return lines.join("\n");
}
