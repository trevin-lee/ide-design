import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CLI = join(import.meta.dirname, "..", "dist", "cli.js");

export const run = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

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
