// Agent integration: install the bundled skills and register the MCP server
// with Claude Code and Codex, so any repo on the machine can use ided.

import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { EPHEMERAL_INSTALL, PKG_VERSION, SKILLS_DIR, STABLE_PKG_ROOT } from "./paths.ts";

export type Agent = "claude" | "codex";

export interface SetupStep {
  agent: Agent;
  what: string;
  ok: boolean;
  detail?: string;
}

function which(bin: string): string | null {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim().split("\n")[0]! : null;
}

/**
 * The command agents should launch for the MCP server, as an absolute path:
 * agents started from a GUI often do not have Homebrew or a version manager
 * on their PATH.
 */
export function mcpCommand(): { command: string; args: string[] } {
  const onPath = which("ided");
  if (onPath) {
    // fnm and Volta expose binaries through per-shell temporary directories; resolve past them.
    let command = onPath;
    if (/fnm_multishells|[\\/]\.volta[\\/]tmp/.test(onPath)) {
      try {
        command = join(realpathSync(dirname(onPath)), basename(onPath));
      } catch {
        // keep the PATH entry
      }
    }
    return { command, args: ["mcp"] };
  }
  // Not on PATH: point at this exact CLI, unless it lives in a throwaway npx cache.
  const self = process.argv[1];
  if (self && !/[\\/]_npx[\\/]/.test(self)) return { command: process.execPath, args: [self, "mcp"] };
  return { command: "npx", args: ["-y", "ided@latest", "mcp"] };
}

export function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Written into copied skills: which ided version they came from. */
const MARKER = ".ided-version";

type SkillMode = "link" | "copy";
type Placed = "linked" | "copied" | "kept";

const claudeSkillsDir = () => join(homedir(), ".claude", "skills");
const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), ".codex");
const codexSkillsDir = () => join(codexHome(), "skills");

/** Is this directory entry one ided created? Anything else is left alone. */
function ownedBy(entry: string, name: string): "link" | "copy" | null {
  const st = lstatSync(entry, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isSymbolicLink()) return readlinkSync(entry).replace(/[\\/]+$/, "").endsWith(join("skills", name)) ? "link" : null;
  if (st.isDirectory() && existsSync(join(entry, MARKER))) return "copy";
  // Copies made before version markers existed.
  if (st.isDirectory() && name.startsWith("ided")) {
    try {
      return new RegExp(`^name:\\s*${name}\\s*$`, "m").test(readFileSync(join(entry, "SKILL.md"), "utf8")) ? "copy" : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Put one skill in place. Links point at the stable install path, so they follow
 * upgrades; copies carry a version marker so the next ided run can refresh them.
 */
function placeSkill(root: string, name: string, mode: SkillMode): Placed {
  const dest = join(root, name);
  if (lstatSync(dest, { throwIfNoEntry: false })) {
    const owner = ownedBy(dest, name);
    if (!owner) return "kept";
    if (owner === "link") unlinkSync(dest);
    else rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(root, { recursive: true });
  const source = join(STABLE_PKG_ROOT, "skills", name);
  if (mode === "link" && !EPHEMERAL_INSTALL) {
    symlinkSync(source, dest, "dir");
    return "linked";
  }
  cpSync(join(SKILLS_DIR, name), dest, { recursive: true });
  writeFileSync(join(dest, MARKER), `${PKG_VERSION}\n`);
  return "copied";
}

function installSkills(root: string, mode: SkillMode): string {
  const results = skillNames().map((n) => ({ n, r: placeSkill(root, n, mode) }));
  const kept = results.filter((x) => x.r === "kept").map((x) => x.n);
  const how = results.some((x) => x.r === "linked") ? "linked" : "copied";
  return `${how}: ${results.filter((x) => x.r !== "kept").map((x) => x.n).join(", ")}${kept.length ? `; left your own ${kept.join(", ")} untouched` : ""}`;
}

function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return a !== b;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Keep skills from `ided setup` current after an upgrade. Runs on every command
 * and when the MCP server starts, and only touches roots where ided already
 * placed skills: copies older than this version are replaced, dangling links are
 * re-pointed, and skills added in a newer version are installed alongside.
 */
export function refreshSkills(): void {
  if (process.env.IDED_NO_SKILL_REFRESH === "1") return;
  const names = skillNames();
  for (const root of [claudeSkillsDir(), codexSkillsDir()]) {
    try {
      if (!existsSync(root)) continue;
      const ours = readdirSync(root)
        .map((entry) => ({ entry, owner: ownedBy(join(root, entry), entry) }))
        .filter((x) => x.owner && x.entry.startsWith("ided"));
      if (ours.length === 0) continue;
      const mode: SkillMode = ours.some((x) => x.owner === "link") ? "link" : "copy";
      for (const name of names) {
        const dest = join(root, name);
        const owner = ownedBy(dest, name);
        const exists = lstatSync(dest, { throwIfNoEntry: false });
        if (!exists) placeSkill(root, name, mode);
        else if (owner === "link" && !existsSync(resolve(dirname(dest), readlinkSync(dest)))) placeSkill(root, name, mode);
        else if (owner === "copy") {
          const from = existsSync(join(dest, MARKER)) ? readFileSync(join(dest, MARKER), "utf8").trim() : "0.0.0";
          if (newer(PKG_VERSION, from)) placeSkill(root, name, "copy");
        }
      }
      // A skill that a newer version removed or renamed.
      for (const { entry, owner } of ours) {
        if (!names.includes(entry) && owner === "copy") rmSync(join(root, entry), { recursive: true, force: true });
        if (!names.includes(entry) && owner === "link") unlinkSync(join(root, entry));
      }
    } catch {
      // Never let housekeeping break the command the user actually ran.
    }
  }
}

export function setupClaude(): SetupStep[] {
  const steps: SetupStep[] = [];
  const skillsDir = claudeSkillsDir();
  steps.push({ agent: "claude", what: `skills → ${skillsDir}`, ok: true, detail: installSkills(skillsDir, "link") });
  const claude = which("claude");
  const { command, args } = mcpCommand();
  if (!claude) {
    steps.push({ agent: "claude", what: "MCP server", ok: false, detail: `claude CLI not found. Run: claude mcp add --scope user ided -- ${command} ${args.join(" ")}` });
    return steps;
  }
  spawnSync(claude, ["mcp", "remove", "--scope", "user", "ided"], { encoding: "utf8" });
  const r = spawnSync(claude, ["mcp", "add", "--scope", "user", "ided", "--", command, ...args], { encoding: "utf8" });
  steps.push({
    agent: "claude",
    what: "MCP server (user scope)",
    ok: r.status === 0,
    detail: r.status === 0 ? `${command} ${args.join(" ")}` : (r.stderr || r.stdout).trim(),
  });
  return steps;
}

export function setupCodex(): SetupStep[] {
  const steps: SetupStep[] = [];
  const home = codexHome();
  const skillsDir = codexSkillsDir();
  // Copies, not links: Codex's handling of symlinked skill folders is unverified.
  steps.push({ agent: "codex", what: `skills → ${skillsDir}`, ok: true, detail: installSkills(skillsDir, "copy") });
  const config = join(home, "config.toml");
  const { command, args } = mcpCommand();
  const block = `[mcp_servers.ided]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(", ")}]\n`;
  let text = existsSync(config) ? readFileSync(config, "utf8") : "";
  if (/^\[mcp_servers\.ided\]/m.test(text)) {
    text = text.replace(/^\[mcp_servers\.ided\][\s\S]*?(?=^\[|(?![\s\S]))/m, block + "\n");
  } else {
    text = `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}${block}`;
  }
  mkdirSync(home, { recursive: true });
  writeFileSync(config, text);
  steps.push({ agent: "codex", what: `MCP server → ${config}`, ok: true, detail: `${command} ${args.join(" ")}` });
  return steps;
}

export function detectAgents(): Agent[] {
  const found: Agent[] = [];
  if (which("claude") || existsSync(join(homedir(), ".claude"))) found.push("claude");
  if (which("codex") || existsSync(codexHome())) found.push("codex");
  return found;
}

export function gitRoot(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
