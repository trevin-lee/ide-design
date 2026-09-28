// Agent integration: install the bundled skills and register the MCP server
// with Claude Code and Codex, so any repo on the machine can use ided.

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SKILLS_DIR } from "./paths.ts";

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

/** The command agents should launch for the MCP server. */
export function mcpCommand(): { command: string; args: string[] } {
  if (which("ided")) return { command: "ided", args: ["mcp"] };
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

function installSkills(targetRoot: string): string[] {
  mkdirSync(targetRoot, { recursive: true });
  const names = skillNames();
  for (const n of names) cpSync(join(SKILLS_DIR, n), join(targetRoot, n), { recursive: true, force: true });
  return names;
}

export function setupClaude(): SetupStep[] {
  const steps: SetupStep[] = [];
  const skillsDir = join(homedir(), ".claude", "skills");
  const names = installSkills(skillsDir);
  steps.push({ agent: "claude", what: `skills → ${skillsDir}`, ok: true, detail: names.join(", ") });
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
  const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const skillsDir = join(codexHome, "skills");
  const names = installSkills(skillsDir);
  steps.push({ agent: "codex", what: `skills → ${skillsDir}`, ok: true, detail: names.join(", ") });
  const config = join(codexHome, "config.toml");
  const { command, args } = mcpCommand();
  const block = `[mcp_servers.ided]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(", ")}]\n`;
  let text = existsSync(config) ? readFileSync(config, "utf8") : "";
  if (/^\[mcp_servers\.ided\]/m.test(text)) {
    text = text.replace(/^\[mcp_servers\.ided\][\s\S]*?(?=^\[|(?![\s\S]))/m, block + "\n");
  } else {
    text = `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}${block}`;
  }
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(config, text);
  steps.push({ agent: "codex", what: `MCP server → ${config}`, ok: true, detail: `${command} ${args.join(" ")}` });
  return steps;
}

export function detectAgents(): Agent[] {
  const found: Agent[] = [];
  if (which("claude") || existsSync(join(homedir(), ".claude"))) found.push("claude");
  if (which("codex") || existsSync(process.env.CODEX_HOME ?? join(homedir(), ".codex"))) found.push("codex");
  return found;
}

export function gitRoot(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
