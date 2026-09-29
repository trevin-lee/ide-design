// Finding and running the `ided` command. The extension holds no design logic of its own:
// everything goes through the same CLI that people and agents use.

import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative, sep } from "node:path";
import * as vscode from "vscode";

export const MARKER = "ided.json";
/** The oldest ided whose viewer and CLI speak this extension's protocol. */
export const MIN_VERSION = "0.3.0";

// VS Code started from the Dock does not see the shell's PATH, so look where installers put it.
const USUAL_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin", join(homedir(), ".npm-global", "bin"), join(homedir(), ".local", "bin")];

export function searchPath(): string {
  return [...new Set([...(process.env.PATH ?? "").split(delimiter), ...USUAL_DIRS])].filter(Boolean).join(delimiter);
}

export function idedPath(): string | undefined {
  const configured = vscode.workspace.getConfiguration("ideDesign").get<string>("path")?.trim();
  if (configured) return existsSync(configured) ? configured : undefined;
  for (const dir of searchPath().split(delimiter)) {
    const file = join(dir, "ided");
    if (existsSync(file)) return file;
  }
  return undefined;
}

export function childEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: searchPath(), NO_COLOR: "1", FORCE_COLOR: "0" };
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class MissingCli extends Error {}

export function run(root: string, args: string[]): Promise<RunResult> {
  const bin = idedPath();
  if (!bin) return Promise.reject(new MissingCli("The ided command was not found."));
  return new Promise((resolve) => {
    execFile(bin, args, { cwd: root, env: childEnv(), maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) || (error && typeof error.code !== "number" ? error.message : "") });
    });
  });
}

/** The ided workspace root (the folder with ided.json) that contains a file, if any. */
export function rootOf(file: string): string | undefined {
  let dir = dirname(file);
  for (;;) {
    if (existsSync(join(dir, MARKER))) return dir;
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

export async function allRoots(): Promise<string[]> {
  const markers = await vscode.workspace.findFiles(`**/${MARKER}`, "**/node_modules/**", 50);
  return [...new Set(markers.map((u) => dirname(u.fsPath)))].sort();
}

/** Path of `file` relative to `root` with forward slashes, the form ided uses in source locations. */
export function relPath(root: string, file: string): string | undefined {
  const rel = relative(root, file);
  if (!rel || rel.startsWith("..") || rel.startsWith(sep)) return undefined;
  return rel.split(sep).join("/");
}

export function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** `design/x/slides/01-a.tsx:12:7` → a file inside `root` and a 0-based position. */
export function parseSrc(root: string, src: string): { uri: vscode.Uri; position: vscode.Position } | undefined {
  const m = /^(.+?)(?::(\d+))?(?::(\d+))?$/.exec(src);
  if (!m) return undefined;
  const file = join(root, m[1]!);
  if (!relPath(root, file)) return undefined; // outside the workspace
  const line = Math.max(0, Number(m[2] ?? 1) - 1);
  const column = Math.max(0, Number(m[3] ?? 1) - 1);
  return { uri: vscode.Uri.file(file), position: new vscode.Position(line, column) };
}

/** A frame file's project and frame id: design/<project>/<slides|pages|artboards|screens>/<NN-name>.tsx. */
export function frameOf(rel: string): { project: string; frame: string } | undefined {
  const m = /^design\/([^/]+)\/(?:slides|pages|artboards|screens)\/(\d{2}-[^/]+)\.tsx$/.exec(rel);
  return m ? { project: m[1]!, frame: m[2]! } : undefined;
}

export function olderThan(version: string, min: string): boolean {
  const a = version.split(/[.-]/).map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

let warned = false;
/** Tell the user once how to get ided, or that theirs is too old. Never waits for the answer. */
export function explain(error: unknown): void {
  if (warned) return;
  warned = true;
  const missing = error instanceof MissingCli;
  const message = missing
    ? "ide-design: the ided command was not found. Install it with `brew install trevin-lee/tap/ide-design` (or npm), or set ideDesign.path."
    : `ide-design: ${(error as Error).message}`;
  void vscode.window.showErrorMessage(message, ...(missing ? ["Install Guide", "Set Path"] : [])).then((choice) => {
    if (choice === "Install Guide") void vscode.env.openExternal(vscode.Uri.parse("https://github.com/trevin-lee/ide-design#install"));
    if (choice === "Set Path") void vscode.commands.executeCommand("workbench.action.openSettings", "ideDesign.path");
  });
}

export async function checkVersion(root: string): Promise<void> {
  const r = await run(root, ["--version"]);
  const version = r.stdout.trim();
  if (r.code === 0 && olderThan(version, MIN_VERSION)) {
    throw new Error(`this extension needs ided ${MIN_VERSION} or newer (found ${version}). Run \`brew upgrade ide-design\` or reinstall.`);
  }
}
