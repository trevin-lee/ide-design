import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addComment, deleteComment, listComments, updateComment } from "../core/comments.ts";
import { DESIGN_DOC } from "../core/design-doc.ts";
import { loadBrand } from "../core/load-brand.ts";
import { PKG_VERSION } from "../core/paths.ts";
import { slugify, writeGenerated } from "../core/scaffold.ts";
import { canonical, getProject, scanWorkspace } from "../core/workspace.ts";
import { exportProject, type ExportFormat } from "../export/artifacts.ts";
import { buildBrandKit, zipBrandKit } from "../export/brand-kit.ts";
import { staticCheck } from "../check/index.ts";
import { createIdedVite } from "./vite.ts";

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function download(res: ServerResponse, name: string, type: string, data: Uint8Array) {
  res.writeHead(200, {
    "content-type": type,
    "content-disposition": `attachment; filename="${name}"`,
    "content-length": data.byteLength,
    "cache-control": "no-store",
  });
  res.end(data);
}

export interface StartOptions {
  root: string;
  port?: number;
  host?: string;
}

export async function startServer(input: StartOptions): Promise<RunningServer> {
  const opts = { ...input, root: canonical(input.root) };
  writeGenerated(opts.root);
  let baseUrl = "";
  let handler: (req: IncomingMessage, res: ServerResponse) => void = (_req, res) => {
    res.writeHead(503);
    res.end();
  };
  const http = createHttpServer((req, res) => handler(req, res));
  const vite = await createIdedVite({
    root: opts.root,
    hmrServer: http,
    onWorkspaceChange: (_ws, kind) => {
      if (kind === "comments") vite.ws.send({ type: "custom", event: "ided:comments", data: {} });
      else if (kind === "design-doc") vite.ws.send({ type: "custom", event: "ided:design-doc", data: {} });
      // Not Vite's "full-reload": that would also reload export pages mid-render. The viewer reloads itself.
      else vite.ws.send({ type: "custom", event: "ided:structure", data: {} });
    },
  });

  async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const ws = scanWorkspace(opts.root);
    const parts = url.pathname.split("/").filter(Boolean).slice(1);
    try {
      if (parts[0] === "info" && req.method === "GET") {
        return json(res, 200, { version: PKG_VERSION, root: opts.root });
      }
      if (parts[0] === "design-doc" && req.method === "GET") {
        const project = getProject(ws, url.searchParams.get("project") ?? "");
        const file = join(project.dir, DESIGN_DOC);
        return json(res, 200, { file: `design/${project.id}/${DESIGN_DOC}`, markdown: existsSync(file) ? readFileSync(file, "utf8") : null });
      }
      if (parts[0] === "check" && req.method === "GET") {
        // Structure comes with the page; design-doc warnings change as the document is written, so they come from here.
        const list = staticCheck(opts.root).filter((i) => i.source !== "structure" || i.rule === "design-doc");
        return json(
          res,
          200,
          list.map((i) => ({
            project: i.project,
            severity: i.severity,
            message: i.message,
            hint: i.hint,
            source: i.source,
            where: i.line ? `${i.file}:${i.line}:${i.column ?? 1}` : i.file,
          })),
        );
      }
      if (parts[0] === "comments") {
        if (req.method === "GET") {
          const status = (url.searchParams.get("status") ?? "all") as "open" | "resolved" | "all";
          return json(res, 200, listComments(ws, { project: url.searchParams.get("project") ?? undefined, status }));
        }
        if (req.method === "POST") {
          const body = (await readBody(req)) as Parameters<typeof addComment>[1];
          return json(res, 201, addComment(ws, { ...body, author: body.author ?? "user" }));
        }
        if (req.method === "PATCH" && parts[1]) {
          return json(res, 200, updateComment(ws, parts[1], (await readBody(req)) as Parameters<typeof updateComment>[2]));
        }
        if (req.method === "DELETE" && parts[1]) {
          deleteComment(ws, parts[1]);
          return json(res, 200, { ok: true });
        }
      }
      if (parts[0] === "export" && req.method === "GET") {
        const project = getProject(ws, url.searchParams.get("project") ?? "");
        const format = (url.searchParams.get("format") ?? "pdf") as ExportFormat;
        const frames = url.searchParams.get("frames")?.split(",").filter(Boolean);
        const files = await exportProject({ baseUrl, project, format, frames, scale: Number(url.searchParams.get("scale") ?? 2) });
        if (files.length === 1) {
          const f = files[0]!;
          return download(res, f.name, f.name.endsWith(".pdf") ? "application/pdf" : f.name.endsWith(".png") ? "image/png" : "image/jpeg", f.data);
        }
        const { zipSync } = await import("fflate");
        const zip = zipSync(Object.fromEntries(files.map((f) => [`${project.id}/${f.name}`, new Uint8Array(f.data)])));
        return download(res, `${project.id}-${format}.zip`, "application/zip", zip);
      }
      if (parts[0] === "brand-kit" && req.method === "GET") {
        const loaded = await loadBrand(vite, ws);
        if (!loaded.brand) throw new Error(loaded.error ?? "Brand could not be loaded.");
        const errors = loaded.issues.filter((i) => i.severity === "error");
        if (errors.length) throw new Error(`Fix the brand first:\n${errors.map((e) => `${e.path}: ${e.message}`).join("\n")}`);
        const files = buildBrandKit({ brand: loaded.brand, svgs: loaded.svgs, brandAssetsDir: join(ws.designDir, "brand", "assets") });
        const folder = `${slugify(loaded.brand.name) || "brand"}-brand-kit`;
        return download(res, `${folder}.zip`, "application/zip", zipBrandKit(files, folder));
      }
      json(res, 404, { error: `No route ${req.method} ${url.pathname}` });
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  }

  const host = opts.host ?? "127.0.0.1";
  const loopback = isLoopback(host);
  handler = (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // DNS rebinding: a page on evil.example that resolves to 127.0.0.1 would send its own Host.
    if (loopback && !isLoopback(hostname(req.headers.host))) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("ided only answers requests addressed to localhost.");
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      // Writes must come from the viewer itself, not from another site in the same browser.
      if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "Cross-origin request refused." });
      if ((req.method === "POST" || req.method === "PATCH") && !/^application\/json\b/.test(req.headers["content-type"] ?? "")) {
        return json(res, 415, { error: "Expected application/json." });
      }
      void api(req, res, url);
      return;
    }
    vite.middlewares(req, res);
  };

  const port = await listen(http, opts.port ?? 4800, host, opts.port !== undefined && opts.port !== 0);
  baseUrl = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
  return {
    url: baseUrl,
    port,
    async close() {
      await vite.close();
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
}

function hostname(hostHeader: string | undefined): string {
  if (!hostHeader) return "";
  if (hostHeader.startsWith("[")) return hostHeader.slice(0, hostHeader.indexOf("]") + 1);
  return hostHeader.split(":")[0]!;
}

export function isLoopback(host: string): boolean {
  return host === "localhost" || host === "::1" || host === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(host);
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return req.headers["sec-fetch-site"] === undefined || req.headers["sec-fetch-site"] === "same-origin";
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function listen(server: ReturnType<typeof createHttpServer>, port: number, host: string, strict: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (p: number, left: number) => {
      server.once("error", (e: NodeJS.ErrnoException) => {
        if (e.code === "EADDRINUSE" && !strict && left > 0) attempt(p + 1, left - 1);
        else reject(e);
      });
      server.listen(p, host, () => resolve((server.address() as AddressInfo).port));
    };
    attempt(port, 20);
  });
}
