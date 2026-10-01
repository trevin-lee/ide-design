// The layout layer of `ided check`: every frame project's render route, opened in the pinned
// Chromium and measured by src/runtime/layout.ts, the same code the viewer runs live.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Browser } from "playwright-core";
import type { Project } from "../core/workspace.ts";
import { isFrameKind } from "../shared/formats.ts";
import type { Violation } from "../runtime/context.ts";
import type { CheckIssue } from "./index.ts";

/**
 * Open comments left on a page a flowing page no longer has, or on a viewport the screen no
 * longer renders: their pins have nowhere to go.
 */
function strandedComments(root: string, p: Project, pages: Record<string, number>): CheckIssue[] {
  const file = join(p.dir, "comments.json");
  if (!existsSync(file)) return [];
  let comments: { id: string; status: string; frame: string | null; target: { page?: number; viewport?: string } | null }[];
  try {
    comments = (JSON.parse(readFileSync(file, "utf8")) as { comments?: typeof comments }).comments ?? [];
  } catch {
    return [];
  }
  const viewports = p.geometry?.viewports?.map((v) => v.name as string) ?? [];
  const out: CheckIssue[] = [];
  for (const c of comments) {
    if (c.status !== "open" || !c.frame) continue;
    const n = pages[`${p.id}/${c.frame}`] ?? 1;
    const page = c.target?.page ?? 0;
    const lost = page >= n ? `page ${page + 1} of ${c.frame}, which now has ${n} page${n === 1 ? "" : "s"}` : c.target?.viewport && !viewports.includes(c.target.viewport) ? `the ${c.target.viewport} viewport, which ${p.id} no longer renders` : null;
    if (!lost) continue;
    out.push({
      file: relative(root, file),
      rule: "comments",
      severity: "warning",
      message: `Comment ${c.id} was left on ${lost}.`,
      hint: `Address it and resolve it (\`ided comments resolve ${c.id} -m "…"\`), or leave it again in the viewer.`,
      source: "layout",
      project: p.id,
    });
  }
  return out;
}

export async function layoutIssues(
  root: string,
  projects: Project[],
  parseSrc: (src: string | undefined) => { file: string; line?: number; column?: number } | null,
): Promise<{ issues: CheckIssue[]; skipped?: string }> {
  const targets = projects.filter((p) => isFrameKind(p.kind) && p.geometry && p.frames.length);
  if (!targets.length) return { issues: [] };
  const { launchBrowser } = await import("../export/browser.ts");
  const { openRender, renderUrl } = await import("../export/artifacts.ts");
  let browser: Browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    const reason = (e as Error).message.split("\n")[0];
    return {
      skipped: "no browser",
      issues: [
        {
          file: "design",
          rule: "layout",
          severity: "warning",
          message: `Layout was not checked: ${reason}`,
          hint: "Run `ided browser install` (the layout check measures frames in the pinned Chromium), or pass --no-layout.",
          source: "layout",
          project: null,
        },
      ],
    };
  }
  const { startServer } = await import("../server/index.ts");
  const server = await startServer({ root, port: 0 });
  const issues: CheckIssue[] = [];
  try {
    for (const p of targets) {
      let results: { frame: string; viewport?: string; violations: Violation[] }[];
      let pages: Record<string, number>;
      try {
        const page = await openRender(browser, renderUrl(server.url, p.id), 1, p.geometry!.width);
        results = await page.evaluate(() => window.__IDED_LAYOUT__?.() ?? []);
        pages = await page.evaluate(() => window.__IDED_PAGES__ ?? {});
        await page.close();
      } catch {
        continue; // a frame that does not load or render is already reported by the render audit
      }
      issues.push(...strandedComments(root, p, pages));
      // A responsive screen is measured at every viewport; what fails on only some says where.
      const viewports = p.geometry!.viewports?.length ?? 1;
      const found = new Map<string, { v: Violation; frame: string; on: string[] }>();
      for (const { frame, viewport, violations } of results) {
        for (const v of violations) {
          const key = `${frame}|${v.rule}|${v.src}|${v.message}`;
          const entry = found.get(key) ?? { v, frame, on: [] };
          if (viewport) entry.on.push(viewport);
          found.set(key, entry);
        }
      }
      for (const { v, frame, on } of found.values()) {
        const file = relative(root, p.frames.find((f) => f.id === frame)?.abs ?? p.dir);
        const loc = parseSrc(v.src) ?? { file };
        const where = on.length && on.length < viewports ? ` (${on.join(", ")})` : "";
        issues.push({ file: loc.file, line: loc.line, column: loc.column, rule: v.rule, message: v.message + where, hint: v.hint, severity: v.severity, source: "layout", project: p.id });
      }
    }
  } finally {
    await server.close();
    await browser.close();
  }
  return { issues };
}
