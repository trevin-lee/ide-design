import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export const CLI = join(import.meta.dirname, "..", "dist", "cli.js");

/**
 * Tests never see the real home directory: `ided setup` and the skill refresh
 * write to ~/.claude and ~/.codex. The pinned browser cache is shared, so it is
 * downloaded once rather than per test.
 */
export const FAKE_HOME = mkdtempSync(join(tmpdir(), "ided-home-"));
export const testEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  HOME: FAKE_HOME,
  CODEX_HOME: join(FAKE_HOME, ".codex"),
  IDED_BROWSERS_PATH: process.env.IDED_BROWSERS_PATH ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ided", "browsers"),
  NO_COLOR: "1",
};

export const run = (cwd: string, ...args: string[]) => runWith({}, cwd, ...args);

export const runWith = (env: Record<string, string>, cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...testEnv, ...env } });

export function workspace(...initArgs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "ided-test-"));
  const r = run(dir, "init", "--here", ...initArgs);
  if (r.status !== 0) throw new Error(r.stderr);
  return dir;
}

/** Tests that need a browser skip themselves when none is installed. */
export async function findBrowser(): Promise<boolean> {
  try {
    const { launchBrowser } = await import("../src/export/browser.ts");
    const b = await launchBrowser();
    await b.close();
    return true;
  } catch {
    return false;
  }
}
