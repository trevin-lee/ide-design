// The export renderer. ided pins one Chromium build (the headless shell that
// its Playwright version targets) and keeps it in a shared cache, so a PDF
// renders the same after a Chrome update, on another laptop, and in CI.
// Installed Chrome is only a fallback, with a warning.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Browser } from "playwright-core";
import { dependencyDir } from "../core/paths.ts";

interface PinnedBuild {
  revision: string;
  version: string;
}

/** Where the managed browser lives. Shared by every workspace and every ided install. */
export function browsersDir(): string {
  if (process.env.IDED_BROWSERS_PATH) return process.env.IDED_BROWSERS_PATH;
  const cache = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(cache, "ided", "browsers");
}

export function pinnedBuild(): PinnedBuild {
  // browsers.json ships with playwright-core and names the build its driver speaks to.
  const manifest = JSON.parse(readFileSync(join(dependencyDir("playwright-core"), "browsers.json"), "utf8")) as {
    browsers: { name: string; revision: string; browserVersion: string }[];
  };
  const shell = manifest.browsers.find((b) => b.name === "chromium-headless-shell");
  if (!shell) throw new Error("playwright-core does not list a chromium-headless-shell build.");
  return { revision: shell.revision, version: shell.browserVersion };
}

export interface BrowserStatus {
  version: string;
  dir: string;
  installed: boolean;
  sizeBytes: number | null;
}

function dirSize(dir: string): number {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else if (e.isFile()) total += statSync(p).size;
  }
  return total;
}

export function browserStatus(): BrowserStatus {
  const { revision, version } = pinnedBuild();
  const dir = join(browsersDir(), `chromium_headless_shell-${revision}`);
  const installed = existsSync(join(dir, "INSTALLATION_COMPLETE"));
  return { version, dir, installed, sizeBytes: installed ? dirSize(dir) : null };
}

/**
 * Deletes the browser builds ided downloaded (every revision, from any ided version) and the
 * cache folder if that leaves it empty. Only Playwright's build folders are touched, so an
 * IDED_BROWSERS_PATH shared with other tools keeps everything else.
 */
export function removeBrowsers(): { removed: string[]; bytes: number } {
  const dir = browsersDir();
  const removed: string[] = [];
  let bytes = 0;
  if (!existsSync(dir)) return { removed, bytes };
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || !/^(chromium_headless_shell|ffmpeg)-\d+$|^\.links$/.test(e.name)) continue;
    const p = join(dir, e.name);
    bytes += dirSize(p);
    rmSync(p, { recursive: true, force: true });
    removed.push(e.name);
  }
  for (const d of [dir, ...(process.env.IDED_BROWSERS_PATH ? [] : [dirname(dir)])]) {
    try {
      if (readdirSync(d).length === 0) rmSync(d, { recursive: true });
    } catch {
      // not there
    }
  }
  return { removed, bytes };
}

/** Download the pinned build into the cache. Progress goes to stderr. */
export function installBrowser(opts: { quiet?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(dependencyDir("playwright-core"), "cli.js"), "install", "chromium-headless-shell"], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersDir() },
      stdio: ["ignore", opts.quiet ? "ignore" : process.stderr, opts.quiet ? "pipe" : process.stderr],
    });
    let err = "";
    child.stderr?.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 && browserStatus().installed) resolve();
      else reject(new Error(`Chromium download failed${err ? `:\n${err.trim().split("\n").slice(-3).join("\n")}` : "."}`));
    });
  });
}

let warned = false;
function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.error(`! ${message}`);
}

/**
 * Launch the renderer: an explicit IDED_CHROME_PATH, else the managed build
 * (downloaded on first use), else installed Chrome with a warning.
 */
export async function launchBrowser(): Promise<Browser> {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir();
  const { chromium } = await import("playwright-core");
  if (process.env.IDED_CHROME_PATH) {
    return chromium.launch({ headless: true, executablePath: process.env.IDED_CHROME_PATH });
  }

  let status = browserStatus();
  let downloadError: Error | null = null;
  if (!status.installed && process.env.IDED_NO_BROWSER_DOWNLOAD !== "1") {
    console.error(`Downloading Chromium ${status.version} for export (one time, about 100 MB) to ${browsersDir()}`);
    try {
      await installBrowser();
      status = browserStatus();
    } catch (e) {
      downloadError = e as Error;
    }
  }
  if (status.installed) {
    try {
      return await chromium.launch({ headless: true });
    } catch (e) {
      const hint = process.platform === "linux" ? "\nOn Linux the browser may need system libraries: `sudo npx playwright install-deps chromium`." : "";
      throw new Error(`The managed Chromium did not start: ${(e as Error).message.split("\n")[0]}${hint}`);
    }
  }

  // Fallback: whatever Chromium the machine has. Works, but output follows that browser's version.
  for (const channel of ["chrome", "msedge", "chromium"] as const) {
    try {
      const b = await chromium.launch({ headless: true, channel });
      warnOnce(
        `Rendering with installed ${channel === "msedge" ? "Edge" : channel === "chrome" ? "Chrome" : "Chromium"} because the pinned Chromium ${status.version} is not available` +
          `${downloadError ? ` (${downloadError.message.split("\n")[0]})` : ""}. Results can change when that browser updates; run \`ided browser install\` to pin it.`,
      );
      return b;
    } catch {
      // try the next one
    }
  }
  throw new Error(
    `Export needs Chromium and none is available.\n` +
      `Run \`ided browser install\` (downloads the pinned build), or set IDED_CHROME_PATH=/path/to/chrome.` +
      `${downloadError ? `\n(${downloadError.message.split("\n")[0]})` : ""}`,
  );
}

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const b = await launchBrowser();
  try {
    return await fn(b);
  } finally {
    await b.close();
  }
}
