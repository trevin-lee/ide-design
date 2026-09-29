// Artifact export: the viewer's render route (#/render/<project>) draws frames
// at exact size with no UI; headless Chrome prints or screenshots it.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright-core";
import type { Project } from "../core/workspace.ts";
import { withBrowser } from "./browser.ts";

export type ExportFormat = "pdf" | "png" | "jpeg";

export interface ExportOptions {
  baseUrl: string;
  project: Project;
  format: ExportFormat;
  /** Frame ids; defaults to all frames. */
  frames?: string[];
  /** Device pixel ratio for raster output. */
  scale?: number;
  browser?: Browser;
}

export interface ExportedFile {
  name: string;
  data: Buffer;
}

export function renderUrl(baseUrl: string, project: string, frames?: string[], print = false, sheet = false): string {
  const q = new URLSearchParams();
  if (frames?.length) q.set("frames", frames.join(","));
  if (print) q.set("print", "1");
  if (sheet) q.set("sheet", "1");
  const qs = q.toString();
  return `${baseUrl.replace(/\/$/, "")}/#/render/${project}${qs ? `?${qs}` : ""}`;
}

async function openRender(browser: Browser, url: string, scale: number, width: number) {
  const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: Math.max(width, 800), height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => (window as unknown as { __IDED_READY__?: boolean }).__IDED_READY__ === true, null, { timeout: 60_000 });
  } catch {
    throw new Error(`Timed out rendering ${url}${errors.length ? `:\n${errors.join("\n")}` : ""}`);
  }
  const failure = await page.evaluate(() => (window as unknown as { __IDED_ERROR__?: string }).__IDED_ERROR__);
  if (failure) throw new Error(failure);
  return page;
}

export async function exportProject(opts: ExportOptions): Promise<ExportedFile[]> {
  const run = async (browser: Browser): Promise<ExportedFile[]> => {
    const p = opts.project;
    if (!p.geometry || p.kind === "brand") throw new Error(`"${p.id}" has no frames to export; use \`ided export brand\` for the brand kit.`);
    if (p.kind === "web" && opts.format === "pdf") throw new Error("Web screens grow with their content and have no page size, so they export as PNG or JPEG, not PDF.");
    const frames = opts.frames?.length ? p.frames.filter((f) => opts.frames!.includes(f.id)) : p.frames;
    if (opts.frames?.length && frames.length !== opts.frames.length) {
      const missing = opts.frames.filter((f) => !p.frames.some((x) => x.id === f));
      throw new Error(`Unknown frame(s) in ${p.id}: ${missing.join(", ")}`);
    }
    if (frames.length === 0) throw new Error(`"${p.id}" has no frames.`);
    const ids = frames.map((f) => f.id);
    if (opts.format === "pdf") {
      const page = await openRender(browser, renderUrl(opts.baseUrl, p.id, ids, true), 1, p.geometry.width);
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      await page.close();
      return [{ name: `${p.id}.pdf`, data: Buffer.from(pdf) }];
    }
    const page = await openRender(browser, renderUrl(opts.baseUrl, p.id, ids), opts.scale ?? 2, p.geometry.width);
    const out: ExportedFile[] = [];
    for (const id of ids) {
      const el = await page.$(`[data-ided-frame="${id}"]`);
      if (!el) throw new Error(`Frame ${id} did not render.`);
      const data = await el.screenshot({ type: opts.format, ...(opts.format === "jpeg" ? { quality: 92 } : {}) });
      out.push({ name: `${id}.${opts.format === "jpeg" ? "jpg" : "png"}`, data: Buffer.from(data) });
    }
    await page.close();
    return out;
  };
  return opts.browser ? run(opts.browser) : withBrowser(run);
}

/** Every frame of a project, labeled, on one image: for judging rhythm and sameness across frames. */
export async function exportSheet(opts: { baseUrl: string; project: Project; scale?: number; browser?: Browser }): Promise<ExportedFile> {
  const run = async (browser: Browser): Promise<ExportedFile> => {
    const p = opts.project;
    if (!p.geometry || !p.frames.length) throw new Error(`"${p.id}" has no frames.`);
    const page = await openRender(browser, renderUrl(opts.baseUrl, p.id, undefined, false, true), opts.scale ?? 1, 1600);
    const el = await page.$("[data-ided-sheet]");
    if (!el) throw new Error("The contact sheet did not render.");
    const data = await el.screenshot({ type: "png" });
    await page.close();
    return { name: `${p.id}-sheet.png`, data: Buffer.from(data) };
  };
  return opts.browser ? run(opts.browser) : withBrowser(run);
}

export function writeExport(files: ExportedFile[], outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  return files.map((f) => {
    const path = join(outDir, f.name);
    writeFileSync(path, f.data);
    return path;
  });
}
