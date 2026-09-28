// MCP server: the same capabilities as the CLI, plus screenshots returned as
// images so an agent can look at what it made.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Browser } from "playwright-core";
import { z } from "zod";
import { formatComment, listComments, updateComment } from "../core/comments.ts";
import { loadBrand } from "../core/load-brand.ts";
import { PKG_VERSION, SKILLS_DIR } from "../core/paths.ts";
import { addFrame, newProject, useLibrary, writeGenerated } from "../core/scaffold.ts";
import { getProject, requireWorkspaceRoot, scanWorkspace } from "../core/workspace.ts";
import { DOC_PAGES, FRAME_KINDS, GRAPHIC_SIZES, WEB_VIEWPORTS, type FrameKind } from "../shared/formats.ts";
import { brandSummary } from "../shared/summary.ts";
import type { RunningServer } from "../server/index.ts";

type Text = { type: "text"; text: string };
const text = (t: string): { content: Text[] } => ({ content: [{ type: "text", text: t }] });
const failure = (e: unknown) => ({ content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true });

export async function runMcpServer() {
  process.env.NO_COLOR = "1";
  const server = new McpServer({ name: "ided", version: PKG_VERSION });
  const rootFor = (root?: string) => requireWorkspaceRoot(root ? resolve(root) : process.cwd());
  const rootArg = { root: z.string().optional().describe("Workspace path. Defaults to the MCP server's working directory.") };

  // Long-lived render server + browser, started on first use.
  let render: { root: string; server: RunningServer; browser: Browser } | null = null;
  const renderer = async (root: string) => {
    if (render && render.root === root) return render;
    if (render) {
      await render.browser.close();
      await render.server.close();
    }
    const { startServer } = await import("../server/index.ts");
    const { launchBrowser } = await import("../export/browser.ts");
    render = { root, server: await startServer({ root, port: 0 }), browser: await launchBrowser() };
    return render;
  };

  server.registerTool(
    "ided_rules",
    { title: "Framework rules", description: "The ided rules and full primitive reference. Read this before writing or editing any artifact.", inputSchema: {} },
    async () => text(readFileSync(join(SKILLS_DIR, "ided", "references", "primitives.md"), "utf8")),
  );

  server.registerTool(
    "ided_list_projects",
    { title: "List projects", description: "Projects in the workspace with their kind, frame size and frame files.", inputSchema: rootArg },
    async ({ root }) => {
      try {
        const r = rootFor(root);
        const ws = scanWorkspace(r);
        const lines = ws.projects.map((p) => {
          const size = p.geometry ? ` ${p.geometry.width}x${p.geometry.fixedHeight ? p.geometry.height : "auto"}` : "";
          return [`${p.id} (${p.kind}${size}) "${p.title}"`, ...p.frames.map((f) => `  ${relative(r, f.abs)}`), ...p.issues.map((i) => `  ! ${i.file}: ${i.message}`)].join("\n");
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
      inputSchema: { ...rootArg, project: z.string().optional(), render: z.boolean().optional().describe("Include the render audit (default true).") },
    },
    async ({ root, project, render: doRender }) => {
      try {
        const r = rootFor(root);
        const { runCheck, formatIssues } = await import("../check/index.ts");
        const result = await runCheck(r, { project, render: doRender ?? true });
        return text(formatIssues(result));
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
        viewport: z.enum(Object.keys(WEB_VIEWPORTS) as [string, ...string[]]).optional(),
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
    { title: "Use library", description: "Declare that a project imports from a library (adds it to project.json dependencies).", inputSchema: { ...rootArg, project: z.string(), library: z.string() } },
    async ({ root, project, library }) => {
      try {
        return text(useLibrary(scanWorkspace(rootFor(root)), project, library));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_screenshot",
    {
      title: "Screenshot",
      description: "Render frames to PNG and return them as images. Use this to look at your work after it checks clean.",
      inputSchema: { ...rootArg, project: z.string(), frames: z.array(z.string()).optional().describe("Frame ids; defaults to all (max 8)."), scale: z.number().min(0.25).max(2).optional() },
    },
    async ({ root, project, frames, scale }) => {
      try {
        const r = rootFor(root);
        writeGenerated(r);
        const p = getProject(scanWorkspace(r), project);
        const ids = (frames?.length ? frames : p.frames.map((f) => f.id)).slice(0, 8);
        const { exportProject } = await import("../export/artifacts.ts");
        const rs = await renderer(r);
        const defaultScale = p.geometry && p.geometry.width > 1600 ? 0.5 : 1;
        const files = await exportProject({ baseUrl: rs.server.url, project: p, format: "png", frames: ids, scale: scale ?? defaultScale, browser: rs.browser });
        return {
          content: files.flatMap((f) => [
            { type: "text" as const, text: f.name },
            { type: "image" as const, data: f.data.toString("base64"), mimeType: "image/png" },
          ]),
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
      description: 'Export a project to PDF, PNG or JPEG files, or project "brand" to a brand kit folder.',
      inputSchema: { ...rootArg, project: z.string(), format: z.enum(["pdf", "png", "jpeg"]).optional(), frames: z.array(z.string()).optional(), out: z.string().optional().describe("Output directory, default <root>/out") },
    },
    async ({ root, project, format, frames, out }) => {
      try {
        const r = rootFor(root);
        const ws = scanWorkspace(r);
        const outDir = resolve(r, out ?? "out");
        if (project === "brand") {
          const { createIdedVite } = await import("../server/vite.ts");
          const { buildBrandKit, writeBrandKit } = await import("../export/brand-kit.ts");
          const vite = await createIdedVite({ root: r, ssrOnly: true });
          try {
            const loaded = await loadBrand(vite, ws);
            if (!loaded.brand) throw new Error(loaded.error ?? "Brand did not load.");
            const files = buildBrandKit({ brand: loaded.brand, svgs: loaded.svgs, brandAssetsDir: join(ws.designDir, "brand", "assets") });
            const dir = join(outDir, "brand-kit");
            writeBrandKit(files, dir);
            return text(`${files.length} files → ${dir}`);
          } finally {
            await vite.close();
          }
        }
        const p = getProject(ws, project);
        const { exportProject, writeExport } = await import("../export/artifacts.ts");
        const rs = await renderer(r);
        const files = await exportProject({ baseUrl: rs.server.url, project: p, format: format ?? "pdf", frames, browser: rs.browser });
        return text(writeExport(files, format === "pdf" || !format ? outDir : join(outDir, p.id)).join("\n"));
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
    { title: "Resolve comment", description: "Mark a comment resolved after addressing it, with a short note on what changed.", inputSchema: { ...rootArg, id: z.string(), message: z.string().optional() } },
    async ({ root, id, message }) => {
      try {
        updateComment(scanWorkspace(rootFor(root)), id, { status: "resolved", reply: message ? { author: "agent", body: message } : undefined });
        return text(`Resolved ${id}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "ided_reply_comment",
    { title: "Reply to comment", description: "Reply without resolving, e.g. to ask a clarifying question.", inputSchema: { ...rootArg, id: z.string(), message: z.string() } },
    async ({ root, id, message }) => {
      try {
        updateComment(scanWorkspace(rootFor(root)), id, { reply: { author: "agent", body: message } });
        return text(`Replied to ${id}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    if (render) {
      await render.browser.close().catch(() => {});
      await render.server.close().catch(() => {});
    }
    process.exit(0);
  };
  process.stdin.on("close", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
