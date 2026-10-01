// MCP server: the CLI's capabilities through the same code paths (src/core, src/check,
// src/export/operations.ts), plus screenshots returned as images so an agent can look at
// what it made.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Browser } from "playwright-core";
import { z } from "zod";
import { formatComment, listComments, updateComment } from "../core/comments.ts";
import { loadBrand } from "../core/load-brand.ts";
import { PKG_VERSION, SKILLS_DIR } from "../core/paths.ts";
import { addFrame, newProject, unuseLibrary, useLibrary, writeGenerated } from "../core/scaffold.ts";
import { defaultScreenshotScale, getProject, requireWorkspaceRoot, resolveFrames, scanWorkspace } from "../core/workspace.ts";
import { describeGeometry, DOC_PAGES, FRAME_KINDS, GRAPHIC_SIZES, isFrameKind, WEB_VIEWPORTS, type FrameKind } from "../shared/formats.ts";
import { brandSummary } from "../shared/summary.ts";
import type { RunningServer } from "../server/index.ts";

type Text = { type: "text"; text: string };
const text = (t: string): { content: Text[] } => ({ content: [{ type: "text", text: t }] });
const failure = (e: unknown) => ({ content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true });

export async function runMcpServer() {
  process.env.NO_COLOR = "1";
  const server = new McpServer({ name: "ided", version: PKG_VERSION });
  // A user-wide registration starts the server wherever the agent starts, so every tool takes `root`.
  const rootFor = (root?: string) => {
    if (root) return requireWorkspaceRoot(resolve(root));
    try {
      return requireWorkspaceRoot(process.cwd());
    } catch {
      throw new Error(`No ided workspace at or above ${process.cwd()}, where the MCP server started. Pass \`root\`: the path of the folder that holds ided.json.`);
    }
  };
  const rootArg = {
    root: z.string().optional().describe("Path of the ided workspace (the folder with ided.json, or any folder inside it). Defaults to where the MCP server started; pass it when the agent runs elsewhere."),
  };

  // One render server and browser per workspace, started on first use and shared by parallel calls.
  const renderers = new Map<string, Promise<{ server: RunningServer; browser: Browser }>>();
  const renderer = (root: string) => {
    let r = renderers.get(root);
    if (!r) {
      r = (async () => {
        const { startServer } = await import("../server/index.ts");
        const { launchBrowser } = await import("../export/browser.ts");
        return { server: await startServer({ root, port: 0 }), browser: await launchBrowser() };
      })();
      renderers.set(root, r);
      r.catch(() => renderers.delete(root));
    }
    return r;
  };

  server.registerTool(
    "ided_rules",
    { title: "Framework rules", description: "The ided rules and full primitive reference. Read this before writing or editing any artifact.", inputSchema: {} },
    async () => text(readFileSync(join(SKILLS_DIR, "ided", "references", "primitives.md"), "utf8")),
  );

  server.registerTool(
    "ided_list_projects",
    { title: "List projects", description: "Projects in the workspace: kind, frame size, frame files, dependencies, and the import path of every component and asset.", inputSchema: rootArg },
    async ({ root }) => {
      try {
        const r = rootFor(root);
        const ws = scanWorkspace(r);
        // The same facts as `ided list`: frames, and the import path of every component and asset.
        const lines = ws.projects.map((p) => {
          const size = p.geometry && isFrameKind(p.kind) ? ` ${describeGeometry(p.geometry)}` : "";
          const deps = p.dependencies.length ? ` uses ${p.dependencies.join(", ")}` : "";
          return [
            `${p.id} (${p.kind}${size}) "${p.title}"${deps}`,
            ...p.frames.map((f) => `  ${relative(r, f.abs)}`),
            ...p.components.map((c) => `  @${p.id}/${c.replace(/\.tsx$/, "")}`),
            ...p.assets.filter((a) => !a.startsWith("fonts/")).map((a) => `  @${p.id}/assets/${a}`),
            ...p.issues.map((i) => `  ! ${i.file}: ${i.message}`),
          ].join("\n");
        });
        return text(`workspace ${r}\n\n${lines.join("\n\n")}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_get_brand",
    { title: "Brand tokens", description: "Every token in design/brand/brand.ts. Artifacts may use these names and nothing else.", inputSchema: rootArg },
    async ({ root }) => {
      const r = rootFor(root);
      const { createIdedVite } = await import("../server/vite.ts");
      const vite = await createIdedVite({ root: r, ssrOnly: true });
      try {
        const loaded = await loadBrand(vite, scanWorkspace(r));
        if (!loaded.brand) throw new Error(loaded.error ?? "Brand did not load.");
        const issues = loaded.issues.map((i) => `${i.severity}: ${i.path}: ${i.message}`).join("\n");
        return text(brandSummary(loaded.brand) + (issues ? `\n\nbrand issues:\n${issues}` : ""));
      } catch (e) {
        return failure(e);
      } finally {
        await vite.close();
      }
    },
  );

  server.registerTool(
    "ided_check",
    {
      title: "Check",
      description: "Run structure, lint, type and render checks. Run after every edit; the work is not done until this is clean.",
      inputSchema: {
        ...rootArg,
        project: z.string().optional(),
        render: z.boolean().optional().describe("Include the render audit (default true)."),
        layout: z.boolean().optional().describe("Include the layout check: overflow, ratios and crops measured in the browser (default true)."),
      },
    },
    async ({ root, project, render: doRender, layout }) => {
      try {
        const r = rootFor(root);
        const { runCheck, formatIssues } = await import("../check/index.ts");
        const result = await runCheck(r, { project, render: doRender ?? true, layout: layout ?? true });
        return { ...text(formatIssues(result)), isError: result.issues.some((i) => i.severity === "error") };
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_new_project",
    {
      title: "New project",
      description: "Create a project folder with its manifest and first frame.",
      inputSchema: {
        ...rootArg,
        kind: z.enum(["library", ...FRAME_KINDS] as ["library", ...FrameKind[]]),
        name: z.string().describe("kebab-case folder name"),
        title: z.string().optional(),
        page: z.enum(Object.keys(DOC_PAGES) as ["letter", "a4"]).optional(),
        size: z.enum(Object.keys(GRAPHIC_SIZES) as [string, ...string[]]).optional(),
        viewport: z
          .union([z.enum(Object.keys(WEB_VIEWPORTS) as [string, ...string[]]), z.array(z.enum(Object.keys(WEB_VIEWPORTS) as [string, ...string[]])).min(1)])
          .optional()
          .describe("One viewport, or a list for a responsive screen rendered at each."),
      },
    },
    async ({ root, kind, name, ...opts }) => {
      try {
        const files = newProject(scanWorkspace(rootFor(root)), kind, name, opts);
        return text(`Created:\n${files.join("\n")}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_add_frame",
    { title: "Add frame or component", description: "Add the next numbered slide/page/artboard/screen to a project, or a component to a library or the brand. Returns the new file path.", inputSchema: { ...rootArg, project: z.string(), name: z.string() } },
    async ({ root, project, name }) => {
      try {
        return text(addFrame(scanWorkspace(rootFor(root)), project, name).file);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_use_library",
    {
      title: "Use library",
      description: "Declare that a project imports from a library (adds it to project.json dependencies), or stop using it with remove: true.",
      inputSchema: { ...rootArg, project: z.string(), library: z.string(), remove: z.boolean().optional() },
    },
    async ({ root, project, library, remove }) => {
      try {
        const ws = scanWorkspace(rootFor(root));
        if (!remove) return text(useLibrary(ws, project, library));
        const { message, stillImporting } = unuseLibrary(ws, project, library);
        return text(stillImporting.length ? `${message}\nThese files still import from @${library}; ided check flags them until they change:\n${stillImporting.join("\n")}` : message);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_screenshot",
    {
      title: "Screenshot",
      description: "Render frames to PNG and return them as images, every frame on one labeled contact sheet (sheet: true), or one frame as zoomed tiles (zoom: \"2x2\"). Use this to look at your work and critique it against the brief.",
      inputSchema: {
        ...rootArg,
        project: z.string(),
        frames: z.array(z.string()).optional().describe('Frames by id, number or name ("03-numbers", "3"); defaults to all. At most 12 images come back.'),
        sheet: z.boolean().optional().describe("All frames on one image, for judging rhythm and sameness across the piece."),
        zoom: z.string().optional().describe('Cut one frame (pass exactly one in frames) into full-resolution tiles, columns x rows like "2x2", to inspect detail.'),
        page: z.number().int().min(1).optional().describe("Only this page of a flowing doc page (default: every page; with zoom, the first)."),
        viewport: z.enum(["desktop", "tablet", "mobile"]).optional().describe("Only this viewport of a responsive web screen (default: every viewport; with zoom, the widest)."),
        scale: z.number().min(0.25).max(2).optional().describe("Pixel density: default 1, or 0.5 for frames wider than 1600, as in the CLI."),
      },
    },
    async ({ root, project, frames, sheet, zoom, page, viewport, scale }) => {
      try {
        const r = rootFor(root);
        writeGenerated(r);
        const p = getProject(scanWorkspace(r), project);
        if (zoom) {
          if (frames?.length !== 1) throw new Error("zoom cuts one frame into tiles: pass exactly one frame in frames.");
          const { exportTiles, parseZoom } = await import("../export/artifacts.ts");
          const rs = await renderer(r);
          const tiles = await exportTiles({ baseUrl: rs.server.url, project: p, frame: resolveFrames(p, frames)[0]!, page, viewport, ...parseZoom(zoom), scale: scale ?? 1, browser: rs.browser });
          return {
            content: tiles.flatMap((t) => [
              { type: "text" as const, text: t.name },
              { type: "image" as const, data: t.data.toString("base64"), mimeType: "image/png" },
            ]),
          };
        }
        if (sheet) {
          const { exportSheet } = await import("../export/artifacts.ts");
          const rs = await renderer(r);
          const f = await exportSheet({ baseUrl: rs.server.url, project: p, scale: scale ?? 1, browser: rs.browser });
          return { content: [{ type: "text" as const, text: f.name }, { type: "image" as const, data: f.data.toString("base64"), mimeType: "image/png" }] };
        }
        const ids = frames?.length ? resolveFrames(p, frames) : p.frames.map((f) => f.id);
        const { exportProject } = await import("../export/artifacts.ts");
        const rs = await renderer(r);
        let files = await exportProject({ baseUrl: rs.server.url, project: p, format: "png", frames: ids, scale: scale ?? defaultScreenshotScale(p.geometry?.width ?? 0), browser: rs.browser });
        // Image names carry the page (01-report-2.png) or viewport (01-home-mobile.png) to pick by.
        if (page) files = files.filter((f) => new RegExp(`-${page}\\.png$`).test(f.name) || (page === 1 && ids.some((id) => f.name === `${id}.png`)));
        if (viewport) files = files.filter((f) => f.name.endsWith(`-${viewport}.png`) || !p.geometry?.viewports || p.geometry.viewports.length < 2);
        const shown = files.slice(0, 12);
        const note = files.length > shown.length ? [{ type: "text" as const, text: `Showing ${shown.length} of ${files.length} images; pass frames, page or viewport to see the others.` }] : [];
        return {
          content: [
            ...shown.flatMap((f) => [
              { type: "text" as const, text: f.name },
              { type: "image" as const, data: f.data.toString("base64"), mimeType: "image/png" },
            ]),
            ...note,
          ],
        };
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_export",
    {
      title: "Export",
      description: 'Export a project to PDF, PNG or JPEG files (default PDF; PNG for web projects), or project "brand" to the brand kit (a folder and a .zip).',
      inputSchema: {
        ...rootArg,
        project: z.string(),
        format: z.enum(["pdf", "png", "jpeg"]).optional(),
        frames: z.array(z.string()).optional().describe('Frames by id, number or name ("03-numbers", "3"); defaults to all.'),
        out: z.string().optional().describe("Output directory, relative to the workspace (default out/), as `ided export` writes by default."),
      },
    },
    async ({ root, project, format, frames, out }) => {
      try {
        const r = rootFor(root);
        const outDir = resolve(r, out ?? "out");
        const { exportArtifacts, exportBrandKit } = await import("../export/operations.ts");
        if (project === "brand") {
          const kit = await exportBrandKit(r, { out: outDir, zip: true });
          return text(`${kit.count} files → ${kit.dir}\n${kit.zip}`);
        }
        const rs = await renderer(r);
        const ids = frames?.length ? resolveFrames(getProject(scanWorkspace(r), project), frames) : undefined;
        return text((await exportArtifacts(r, project, { out: outDir, format, frames: ids, baseUrl: rs.server.url, browser: rs.browser })).join("\n"));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_list_comments",
    {
      title: "List comments",
      description: "Review comments left in the viewer. Each points at the source line of the element it was left on.",
      inputSchema: { ...rootArg, project: z.string().optional(), all: z.boolean().optional().describe("Include resolved comments.") },
    },
    async ({ root, project, all }) => {
      try {
        const list = listComments(scanWorkspace(rootFor(root)), { project, status: all ? "all" : "open" });
        return text(list.length ? list.map(formatComment).join("\n\n") : "No open comments.");
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_resolve_comment",
    {
      title: "Resolve comment",
      description: "Mark a comment resolved after addressing it, with a short note on what changed.",
      inputSchema: { ...rootArg, id: z.string(), message: z.string().optional(), author: z.string().optional().describe('Who is replying (default "agent").') },
    },
    async ({ root, id, message, author }) => {
      try {
        updateComment(scanWorkspace(rootFor(root)), id, { status: "resolved", reply: message ? { author: author ?? "agent", body: message } : undefined });
        return text(`Resolved ${id}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_reply_comment",
    {
      title: "Reply to comment",
      description: "Reply without resolving, e.g. to ask a clarifying question.",
      inputSchema: { ...rootArg, id: z.string(), message: z.string(), author: z.string().optional().describe('Who is replying (default "agent").') },
    },
    async ({ root, id, message, author }) => {
      try {
        updateComment(scanWorkspace(rootFor(root)), id, { reply: { author: author ?? "agent", body: message } });
        return text(`Replied to ${id}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    for (const r of renderers.values()) {
      const { server: s, browser: b } = await r.catch(() => ({ server: null, browser: null }));
      await b?.close().catch(() => {});
      await s?.close().catch(() => {});
    }
    process.exit(0);
  };
  process.stdin.on("close", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
