// Viewer and export, against a real server and headless Chrome. Skips without a browser.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { Browser } from "playwright-core";
import type { RunningServer } from "../src/server/index.ts";
import { findBrowser, run, workspace } from "./helpers.ts";

const hasBrowser = await findBrowser();
const skip = hasBrowser ? false : "no Chrome/Chromium found";
let dir = "";
let server: RunningServer;
let browser: Browser;

before(async () => {
  if (!hasBrowser) return;
  dir = workspace("--name", "Viewer");
  const { startServer } = await import("../src/server/index.ts");
  const { launchBrowser } = await import("../src/export/browser.ts");
  server = await startServer({ root: dir, port: 0 });
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function open(hash: string) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.url}/${hash}`, { waitUntil: "load" });
  await page.waitForSelector(".ided-root", { timeout: 30_000 });
  return { page, errors };
}

test("viewer renders every frame of a project without errors", { skip, timeout: 60_000 }, async () => {
  const { page, errors } = await open("#/p/intro");
  await page.waitForFunction(() => document.querySelectorAll(".ided-root").length === 4);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator(".tabs button").nth(1).innerText().then((t) => t.replace(/\s+/g, " ")), "Issues 0");
  await page.close();
});

test("a comment left on an element records its source line", { skip, timeout: 60_000 }, async () => {
  const { page } = await open("#/p/intro/02-principles");
  await page.keyboard.press("c");
  const box = (await page.locator('[data-ided="Text"]', { hasText: "One way to" }).boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.keyboard.type("Tighter headline");
  await page.keyboard.press("Meta+Enter");
  await page.keyboard.press("Control+Enter");
  await page.waitForSelector(".comment");
  const list = JSON.parse(run(dir, "comments", "--json").stdout) as { body: string; target: { src: string; primitive: string } }[];
  assert.equal(list.length, 1);
  assert.equal(list[0]!.body, "Tighter headline");
  assert.equal(list[0]!.target.primitive, "Text");
  assert.match(list[0]!.target.src, /^design\/intro\/slides\/02-principles\.tsx:\d+:\d+$/);
  await page.close();
});

test("runtime violations appear live in the Issues panel", { skip, timeout: 60_000 }, async () => {
  const file = join(dir, "design/intro/slides/03-numbers.tsx");
  const original = readFileSync(file, "utf8");
  const { page } = await open("#/p/intro/03-numbers");
  try {
    writeFileSync(file, original.replace('surface="paper" pad="2xl"', 'surface="muted" pad="2xl"'));
    await page.waitForFunction(() => /Issues\s*[1-9]/.test(document.querySelectorAll(".tabs button")[1]?.textContent ?? ""), null, { timeout: 15_000 });
    writeFileSync(file, original);
    await page.waitForFunction(() => /Issues\s*0/.test(document.querySelectorAll(".tabs button")[1]?.textContent ?? ""), null, { timeout: 15_000 });
  } finally {
    writeFileSync(file, original);
    await page.close();
  }
});

test("PDF export has one page per slide; docs print at Letter size", { skip, timeout: 90_000 }, async () => {
  const { exportProject } = await import("../src/export/artifacts.ts");
  const { getProject, scanWorkspace } = await import("../src/core/workspace.ts");
  const deck = await exportProject({ baseUrl: server.url, project: getProject(scanWorkspace(dir), "intro"), format: "pdf", browser });
  const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert.equal(pages(deck[0]!.data), 4);
  assert.equal(run(dir, "new", "doc", "memo").status, 0);
  const doc = await exportProject({ baseUrl: server.url, project: getProject(scanWorkspace(dir), "memo"), format: "pdf", browser });
  assert.match(doc[0]!.data.toString("latin1"), /\/MediaBox\s*\[\s*0 0 612 792\s*\]/);
});

test("PNG export renders at the requested density", { skip, timeout: 60_000 }, async () => {
  const { exportProject } = await import("../src/export/artifacts.ts");
  const { getProject, scanWorkspace } = await import("../src/core/workspace.ts");
  const [png] = await exportProject({ baseUrl: server.url, project: getProject(scanWorkspace(dir), "intro"), format: "png", frames: ["01-title"], scale: 0.5, browser });
  assert.equal(png!.data.readUInt32BE(16), 960);
  assert.equal(png!.data.readUInt32BE(20), 540);
});

test("the server refuses cross-site and rebinding requests", { skip, timeout: 30_000 }, async () => {
  const post = (headers: Record<string, string>) =>
    fetch(`${server.url}/api/comments`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" }).then((r) => r.status);
  assert.equal(await post({ origin: "https://evil.example" }), 403);
  const rebound = await new Promise<number>((resolve) => {
    import("node:http").then(({ request }) => {
      const u = new URL(server.url);
      request({ host: u.hostname, port: u.port, path: "/", headers: { host: "evil.example" } }, (res) => resolve(res.statusCode ?? 0)).end();
    });
  });
  assert.equal(rebound, 403);
});
