// Viewer and export, against a real server and headless Chrome. Skips without a browser.
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  assert.equal(await page.locator(".tabs button").nth(2).innerText().then((t) => t.replace(/\s+/g, " ")), "Issues 0");
  await page.close();
});

test("a comment left on an element records its source line", { skip, timeout: 60_000 }, async () => {
  const { page } = await open("#/p/intro/02-one-way");
  await page.keyboard.press("c");
  const box = (await page.locator('[data-ided="Text"]', { hasText: "one way to write" }).boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.keyboard.type("Tighter headline");
  await page.keyboard.press("Meta+Enter");
  await page.keyboard.press("Control+Enter");
  await page.waitForSelector(".comment");
  const list = JSON.parse(run(dir, "comments", "--json").stdout) as { body: string; target: { src: string; primitive: string } }[];
  assert.equal(list.length, 1);
  assert.equal(list[0]!.body, "Tighter headline");
  assert.equal(list[0]!.target.primitive, "Text");
  assert.match(list[0]!.target.src, /^design\/intro\/slides\/02-one-way\.tsx:\d+:\d+$/);
  await page.close();
});

test("inside an editor, the viewer opens source lines and follows the cursor", { skip, timeout: 60_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.setContent(`<iframe id="v" src="${server.url}/?embed=vscode#/p/intro/02-one-way" style="width:1580px;height:980px;border:0"></iframe>
    <script>window.messages = []; addEventListener("message", (e) => messages.push(e.data));</script>`);
  const viewer = page.frameLocator("#v");
  const text = viewer.locator('[data-ided="Text"]', { hasText: "one way to write" });
  await text.waitFor({ timeout: 30_000 });
  const src = (await text.getAttribute("data-ided-src"))!;

  await text.click({ modifiers: ["Alt"] });
  await page.waitForFunction(() => (window as unknown as { messages: unknown[] }).messages.length > 0);
  assert.deepEqual(await page.evaluate(() => (window as unknown as { messages: unknown[] }).messages), [{ type: "ided:open", src }]);

  const line = src.replace(/:\d+$/, "");
  await page.evaluate((s) => (document.getElementById("v") as HTMLIFrameElement).contentWindow!.postMessage({ type: "ided:reveal", src: s }, "*"), line);
  await viewer.locator(".ided-reveal").first().waitFor({ timeout: 5_000 });
  assert.equal(await viewer.locator(".ided-reveal").first().getAttribute("data-ided-src"), src);
  await page.close();
});

test("comment replies and resolutions record who made them", { skip, timeout: 30_000 }, () => {
  const [c] = JSON.parse(run(dir, "comments", "--json").stdout) as { id: string }[];
  assert.equal(run(dir, "comments", "reply", c!.id, "--author", "user", "Which", "part?").status, 0);
  assert.equal(run(dir, "comments", "resolve", c!.id, "-m", "Shortened it.").status, 0);
  const [after] = JSON.parse(run(dir, "comments", "--all", "--json").stdout) as { status: string; replies: { author: string; body: string }[] }[];
  assert.equal(after!.status, "resolved");
  assert.deepEqual(after!.replies.map((r) => [r.author, r.body]), [["user", "Which part?"], ["agent", "Shortened it."]]);
});

test("runtime violations appear live in the Issues panel", { skip, timeout: 60_000 }, async () => {
  const file = join(dir, "design/intro/slides/04-concentric.tsx");
  const original = readFileSync(file, "utf8");
  const { page } = await open("#/p/intro/04-concentric");
  try {
    writeFileSync(file, original.replace('surface="paper" pad="l"', 'surface="muted" pad="l"'));
    await page.waitForFunction(() => /Issues\s*[1-9]/.test(document.querySelectorAll(".tabs button")[2]?.textContent ?? ""), null, { timeout: 15_000 });
    writeFileSync(file, original);
    await page.waitForFunction(() => /Issues\s*0/.test(document.querySelectorAll(".tabs button")[2]?.textContent ?? ""), null, { timeout: 15_000 });
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

test("exports render with the pinned Chromium, not whatever is installed", { skip, timeout: 30_000 }, async () => {
  const { browserStatus } = await import("../src/export/browser.ts");
  const status = browserStatus();
  if (!status.installed || process.env.IDED_CHROME_PATH) return; // fallback mode is covered by the warning path
  assert.equal(browser.version(), status.version);
});

test("a project created a moment ago exports from a running server", { skip, timeout: 120_000 }, async () => {
  // Regression: the server used to learn about new projects only from its file watcher.
  const { exportProject } = await import("../src/export/artifacts.ts");
  const { getProject, scanWorkspace } = await import("../src/core/workspace.ts");
  for (let i = 0; i < 8; i++) {
    assert.equal(run(dir, "new", "graphic", `fresh-${i}`).status, 0);
    const [png] = await exportProject({ baseUrl: server.url, project: getProject(scanWorkspace(dir), `fresh-${i}`), format: "png", scale: 0.25, browser });
    assert.ok(png!.data.length > 0);
  }
});

test("PNG export renders at the requested density", { skip, timeout: 60_000 }, async () => {
  const { exportProject } = await import("../src/export/artifacts.ts");
  const { getProject, scanWorkspace } = await import("../src/core/workspace.ts");
  const [png] = await exportProject({ baseUrl: server.url, project: getProject(scanWorkspace(dir), "intro"), format: "png", frames: ["01-statement"], scale: 0.5, browser });
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

test("the Brand page lists the brand's components and has no Comments tab", { skip, timeout: 60_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${server.url}/#/p/brand`, { waitUntil: "load" });
  await page.waitForSelector(".lib-component", { timeout: 30_000 });
  assert.deepEqual(await page.locator(".tabs button").allInnerTexts().then((t) => t.map((x) => x.split(/\s/)[0])), ["Design", "Issues"]);
  assert.match(await page.locator(".lib-component").first().innerText(), /import \{ CornerMark \} from "@brand\/components\/corner-mark";/);
  await page.close();
});

test("a web project exports PNG by default", { skip, timeout: 120_000 }, () => {
  const ws = workspace("--bare");
  assert.equal(run(ws, "new", "web", "site", "--viewport", "mobile").status, 0);
  const r = run(ws, "export", "site");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(ws, "out/site/01-home.png")));
});

test("the viewer measures layout live and lists overflow in Issues", { skip, timeout: 60_000 }, async () => {
  assert.equal(run(dir, "new", "deck", "lay").status, 0);
  writeFileSync(
    join(dir, "design/lay/slides/01-title.tsx"),
    `import { Box, Slide, Text } from "ided";\n\nexport default function Main() {\n  return (\n    <Slide surface="paper">\n      <Box width="1/4">\n        <Text type="title">Incomprehensibilities</Text>\n      </Box>\n    </Slide>\n  );\n}\n`,
  );
  const { page } = await open("#/p/lay/01-title");
  await page.waitForFunction(() => /Issues\s*[1-9]/.test(document.querySelectorAll(".tabs button")[2]?.textContent ?? ""), null, { timeout: 20_000 });
  await page.locator(".tabs button").nth(2).click();
  const issue = page.locator(".issue", { hasText: "overflows its <Box>" });
  await issue.waitFor({ timeout: 10_000 });
  assert.equal((await issue.locator(".issue-source").textContent())?.trim(), "layout");
  await page.close();
});

test("the viewer shows a flowing page as one card per page", { skip, timeout: 60_000 }, async () => {
  assert.equal(run(dir, "new", "doc", "essay").status, 0);
  const para = "Every value comes from the brand and every page is checked like a program. ".repeat(12);
  writeFileSync(
    join(dir, "design/essay/pages/01-cover.tsx"),
    `import { Page, Text } from "ided";\n\nexport default function Cover() {\n  return (\n    <Page surface="paper" gap="l" flow>\n${Array.from({ length: 12 }, () => `      <Text type="body">${para}</Text>`).join("\n")}\n    </Page>\n  );\n}\n`,
  );
  const { page } = await open("#/p/essay");
  await page.waitForFunction(() => document.querySelectorAll(".frame-card").length > 1, null, { timeout: 20_000 });
  const captions = await page.locator(".frame-page").allInnerTexts();
  assert.ok(captions.length > 1 && captions.every((c, i) => c.trim() === `${i + 1}/${captions.length}`), captions.join());
  await page.close();
});

test("the viewer shows a responsive screen at each viewport, side by side", { skip, timeout: 60_000 }, async () => {
  assert.equal(run(dir, "new", "web", "site", "--viewport", "desktop,mobile").status, 0);
  const { page } = await open("#/p/site");
  await page.waitForFunction(() => document.querySelectorAll(".variant-row .frame-card").length === 2, null, { timeout: 20_000 });
  assert.deepEqual((await page.locator(".variant-row .frame-page").allInnerTexts()).map((t) => t.trim()), ["desktop", "mobile"]);
  const [desktop, mobile] = await page.locator(".variant-row .frame-surface").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  assert.ok(Math.abs(desktop! / mobile! - 1440 / 390) < 0.05, "one scale for every viewport");
  await page.close();
});
