// Agent integration, agent-agnostic by default.
//
// Skills follow the Agent Skills standard (SKILL.md folders). User-wide, they are
// installed with the ecosystem's installer (vercel-labs/skills, pinned), which
// keeps the canonical copy in ~/.agents/skills (read directly by Codex, Cursor,
// Copilot, Gemini CLI and most others) and links it into agents that use their
// own folder, such as Claude Code. ided does not keep its own list of agents.
// Per project, ided writes .agents/skills (the shared project location) and
// .claude/skills links itself, so nothing machine-specific is committed.
//
// The ided CLI is the universal interface: any agent that can run a shell can
// use it. MCP is an optional extra, registered for the clients we can configure.

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
import { dependencyDir, LATEST_TARBALL_URL, PKG_VERSION, SKILLS_DIR, STABLE_PKG_ROOT } from "./paths.ts";
import { findWorkspaceRoot } from "./workspace.ts";

export type Agent = "claude" | "codex";

export interface SetupStep {
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
  return { command: "npx", args: ["-y", `--package=${LATEST_TARBALL_URL}`, "ided", "mcp"] };
}

export function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Skills earlier versions shipped under names that no longer exist. Wherever ided finds its own
 * copy or link under one of these names, it removes it: a renamed skill must not linger, and a
 * link into an upgraded package would point at nothing.
 */
const RETIRED_SKILLS = ["ided-compose"];

/** Written into every copy ided places: which ided version it came from. */
const MARKER = ".ided-version";

const agentsSkillsDir = () => join(homedir(), ".agents", "skills");
const claudeSkillsDir = () => join(homedir(), ".claude", "skills");
const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), ".codex");
const codexSkillsDir = () => join(codexHome(), "skills");

/** Is this directory entry one ided created (or the installer created for ided)? Anything else is left alone. */
function ownedBy(entry: string, name: string): "link" | "copy" | null {
  const st = lstatSync(entry, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isSymbolicLink()) return readlinkSync(entry).replace(/[\\/]+$/, "").endsWith(join("skills", name)) ? "link" : null;
  if (st.isDirectory() && existsSync(join(entry, MARKER))) return "copy";
  // Copies without a marker: ours if the folder is named like ours and its SKILL.md says so.
  if (st.isDirectory() && name.startsWith("ided")) {
    try {
      return new RegExp(`^name:\\s*${name}\\s*$`, "m").test(readFileSync(join(entry, "SKILL.md"), "utf8")) ? "copy" : null;
    } catch {
      return null;
    }
  }
  return null;
}

function removeOwned(entry: string, name: string): boolean {
  const owner = ownedBy(entry, name);
  if (owner === "link") unlinkSync(entry);
  else if (owner === "copy") rmSync(entry, { recursive: true, force: true });
  return owner !== null;
}

function markerVersion(dir: string): string {
  try {
    return readFileSync(join(dir, MARKER), "utf8").trim();
  } catch {
    return "0.0.0";
  }
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

/** A copy of one of this version's skills, with the version marker. */
function copySkill(root: string, name: string): "copied" | "kept" {
  const dest = join(root, name);
  if (lstatSync(dest, { throwIfNoEntry: false }) && !removeOwned(dest, name)) return "kept";
  mkdirSync(root, { recursive: true });
  cpSync(join(SKILLS_DIR, name), dest, { recursive: true });
  writeFileSync(join(dest, MARKER), `${PKG_VERSION}\n`);
  return "copied";
}

// ---------------------------------------------------------------------------
// User-wide: the standard installer
// ---------------------------------------------------------------------------

/**
 * Runs the pinned Agent Skills installer. Tracking is always off: ided never
 * sends anything about the user's machine or skills to a third party.
 */
function runInstaller(args: string[], cwd: string): { ok: boolean; output: string } {
  const cli = join(dependencyDir("skills"), "bin", "cli.mjs");
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, DO_NOT_TRACK: "1", DISABLE_TELEMETRY: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
  return { ok: r.status === 0, output };
}

/** Which agents the installer reached, from its summary ("universal: …", "symlinked: …"). */
function installerAgents(output: string): string {
  const pick = (label: string) => new RegExp(`${label}:\\s*([^│\\n]+)`).exec(output)?.[1]?.trim();
  return [pick("universal") && `reads ~/.agents/skills: ${pick("universal")}`, pick("symlinked") && `linked: ${pick("symlinked")}`]
    .filter(Boolean)
    .join("; ");
}

function sweepRetired(roots: string[]): void {
  for (const root of roots) for (const n of RETIRED_SKILLS) removeOwned(join(root, n), n);
}

const globalRoots = () => [agentsSkillsDir(), claudeSkillsDir(), codexSkillsDir()];

export function installGlobalSkills(): SetupStep {
  const names = skillNames();
  // Setups from ided 0.1 put copies in ~/.codex/skills and links in ~/.claude/skills. Codex now reads
  // the shared folder directly (a second copy would appear twice), and the installer replaces the links.
  for (const root of [codexSkillsDir(), claudeSkillsDir()]) for (const n of names) removeOwned(join(root, n), n);
  sweepRetired(globalRoots());
  const r = runInstaller(["add", STABLE_PKG_ROOT, "--global", "--yes", "--skill", "*"], homedir());
  const canonical = agentsSkillsDir();
  const placed = names.filter((n) => existsSync(join(canonical, n, "SKILL.md")));
  for (const n of placed) writeFileSync(join(canonical, n, MARKER), `${PKG_VERSION}\n`);
  if (!r.ok || placed.length !== names.length) {
    return { what: "skills", ok: false, detail: r.output.trim().split("\n").slice(-6).join("\n") || "the skills installer failed" };
  }
  return { what: `skills → ${canonical.replace(homedir(), "~")}`, ok: true, detail: `${names.join(", ")}${installerAgents(r.output) ? ` (${installerAgents(r.output)})` : ""}` };
}

// ---------------------------------------------------------------------------
// Per project: files committed with the repository
// ---------------------------------------------------------------------------

const AGENTS_MD_START = "<!-- ided:start -->";
const AGENTS_MD_END = "<!-- ided:end -->";

function agentsMdBlock(): string {
  return `${AGENTS_MD_START}
## Design (ided)

Decks, documents, graphics, web mocks and the brand in \`design/\` are built with
[ide-design](https://github.com/trevin-lee/ide-design) (\`ided\`): token-only React checked like code. Before changing
anything there, run \`ided rules\` (the primitives and rules) and \`ided brand\` (every allowed value
and fact), and follow the ided skills in \`.agents/skills/\` if your agent reads them. Every value
and fact comes from \`design/brand/brand.ts\`, every project explains itself in its \`DESIGN.md\`,
and \`ided check\` must pass.
${AGENTS_MD_END}
`;
}

/** Adds or refreshes ided's block in AGENTS.md, the cross-agent instructions file. Returns the change made. */
export function writeAgentsMd(root: string): "created" | "updated" | "unchanged" {
  const file = join(root, "AGENTS.md");
  const block = agentsMdBlock();
  if (!existsSync(file)) {
    writeFileSync(file, `# Agent instructions\n\n${block}`);
    return "created";
  }
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(AGENTS_MD_START);
  const end = text.indexOf(AGENTS_MD_END);
  const next = start !== -1 && end > start ? text.slice(0, start) + block.trimEnd() + text.slice(end + AGENTS_MD_END.length) : `${text.replace(/\s*$/, "")}\n\n${block}`;
  if (next === text) return "unchanged";
  writeFileSync(file, next);
  return "updated";
}

function writeProjectMcp(root: string): string {
  // Claude Code's project MCP file. The bare command keeps it portable across teammates' machines.
  const file = join(root, ".mcp.json");
  let config: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return `${file} is not valid JSON; left unchanged`;
    }
  }
  config.mcpServers = { ...(config.mcpServers ?? {}), ided: { command: "ided", args: ["mcp"] } };
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  return ".mcp.json";
}

const projectRoots = (root: string) => [join(root, ".agents", "skills"), join(root, ".claude", "skills")];

export function installProjectSkills(root: string): SetupStep[] {
  const names = skillNames();
  const [shared, claude] = projectRoots(root) as [string, string];
  sweepRetired([claude, shared]);
  const kept: string[] = [];
  for (const n of names) {
    if (copySkill(shared, n) === "kept") kept.push(n);
    // Claude Code reads its own folder: a relative link, so the checkout can live anywhere.
    const link = join(claude, n);
    if (lstatSync(link, { throwIfNoEntry: false }) && !removeOwned(link, n)) continue;
    mkdirSync(claude, { recursive: true });
    symlinkSync(join("..", "..", ".agents", "skills", n), link, "dir");
  }
  return [
    {
      what: "skills → .agents/skills (Codex, Cursor, Copilot, Gemini CLI and most others) and .claude/skills (links)",
      ok: kept.length === 0,
      detail: kept.length ? `left your own ${kept.join(", ")} untouched` : names.join(", "),
    },
    { what: `AGENTS.md: ided section ${writeAgentsMd(root)}`, ok: true },
    { what: `MCP server → ${writeProjectMcp(root)}`, ok: true, detail: "ided mcp" },
  ];
}

// ---------------------------------------------------------------------------
// Keeping everything current after an upgrade
// ---------------------------------------------------------------------------

/** Ours, but from an older version or missing a skill this version ships. */
function stale(root: string): boolean {
  if (!existsSync(root)) return false;
  const names = skillNames();
  const ours = names.filter((n) => ownedBy(join(root, n), n) === "copy");
  if (ours.length === 0) return false;
  return ours.length < names.length || ours.some((n) => newer(PKG_VERSION, markerVersion(join(root, n))));
}

/**
 * Runs before every command (including when an agent starts the MCP server) and
 * only touches places where ided's skills already are: the shared user folder,
 * the current project, and folders written by older ided versions.
 */
export function refreshSkills(cwd = process.cwd()): void {
  if (process.env.IDED_NO_SKILL_REFRESH === "1") return;
  try {
    if (stale(agentsSkillsDir())) installGlobalSkills();
    const project = findWorkspaceRoot(cwd);
    if (project && stale(join(project, ".agents", "skills"))) installProjectSkills(project);
    refreshLegacy();
  } catch {
    // Never let housekeeping break the command the user actually ran.
  }
}

/** ided 0.1 setups: links into the package (self-updating) and Codex copies (refreshed here). */
function refreshLegacy(): void {
  sweepRetired(globalRoots());
  const project = findWorkspaceRoot(process.cwd());
  if (project) sweepRetired(projectRoots(project));
  const names = skillNames();
  for (const root of [claudeSkillsDir(), codexSkillsDir()]) {
    if (!existsSync(root)) continue;
    for (const n of names) {
      const dest = join(root, n);
      const owner = ownedBy(dest, n);
      if (owner === "copy" && newer(PKG_VERSION, markerVersion(dest))) copySkill(root, n);
      if (owner === "link" && !existsSync(resolve(dirname(dest), readlinkSync(dest)))) unlinkSync(dest);
    }
  }
}

// ---------------------------------------------------------------------------
// Removing everything setup added
// ---------------------------------------------------------------------------

/** Undoes `ided setup`: the skills in every agent, and the MCP registrations. */
export function removeGlobal(): SetupStep[] {
  const names = skillNames();
  const r = runInstaller(["remove", ...names, "--global", "--yes"], homedir());
  // Whatever the installer did not place (older setups, retired names) is removed here, ours only.
  for (const root of globalRoots()) for (const n of [...names, ...RETIRED_SKILLS]) removeOwned(join(root, n), n);
  const left = names.filter((n) => existsSync(join(agentsSkillsDir(), n)));
  const steps: SetupStep[] = [{ what: "skills removed from every agent", ok: r.ok && left.length === 0, detail: left.length ? `still present: ${left.join(", ")}` : names.join(", ") }];
  const claude = which("claude");
  if (claude) {
    const c = spawnSync(claude, ["mcp", "remove", "--scope", "user", "ided"], { encoding: "utf8" });
    steps.push({ what: "Claude Code MCP removed", ok: true, detail: c.status === 0 ? undefined : "was not registered" });
  }
  const config = join(codexHome(), "config.toml");
  if (existsSync(config)) {
    const text = readFileSync(config, "utf8");
    const next = text.replace(/\n*^\[mcp_servers\.ided\][\s\S]*?(?=^\[|(?![\s\S]))/m, "\n");
    if (next !== text) {
      writeFileSync(config, next.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, ""));
      steps.push({ what: `Codex MCP removed from ${config.replace(homedir(), "~")}`, ok: true });
    }
  }
  return steps;
}

/** Undoes `ided setup --project`. */
export function removeProject(root: string): SetupStep[] {
  for (const dir of projectRoots(root)) for (const n of [...skillNames(), ...RETIRED_SKILLS]) removeOwned(join(dir, n), n);
  for (const dir of [...projectRoots(root), join(root, ".agents"), join(root, ".claude")]) {
    try {
      if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
    } catch {
      // not empty or not ours
    }
  }
  const steps: SetupStep[] = [{ what: "skills removed from .agents/skills and .claude/skills", ok: true }];
  const agentsMd = join(root, "AGENTS.md");
  if (existsSync(agentsMd)) {
    const text = readFileSync(agentsMd, "utf8");
    const start = text.indexOf(AGENTS_MD_START);
    const end = text.indexOf(AGENTS_MD_END);
    if (start !== -1 && end > start) {
      const rest = (text.slice(0, start) + text.slice(end + AGENTS_MD_END.length)).replace(/\n{3,}/g, "\n\n").trim();
      // A file that only ever held ided's section (with the heading ided wrote) goes entirely.
      if (!rest || rest === "# Agent instructions") rmSync(agentsMd);
      else writeFileSync(agentsMd, rest + "\n");
      steps.push({ what: "AGENTS.md: ided section removed", ok: true });
    }
  }
  const mcp = join(root, ".mcp.json");
  if (existsSync(mcp)) {
    try {
      const config = JSON.parse(readFileSync(mcp, "utf8")) as { mcpServers?: Record<string, unknown> };
      if (config.mcpServers?.ided) {
        delete config.mcpServers.ided;
        if (Object.keys(config.mcpServers).length === 0 && Object.keys(config).length === 1) rmSync(mcp);
        else writeFileSync(mcp, JSON.stringify(config, null, 2) + "\n");
        steps.push({ what: ".mcp.json: ided removed", ok: true });
      }
    } catch {
      steps.push({ what: ".mcp.json is not valid JSON; left unchanged", ok: false });
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// MCP registration for clients ided knows how to configure
// ---------------------------------------------------------------------------

export function registerClaudeMcp(): SetupStep {
  const claude = which("claude");
  const { command, args } = mcpCommand();
  if (!claude) return { what: "Claude Code MCP", ok: false, detail: `claude CLI not found. Run: claude mcp add --scope user ided -- ${command} ${args.join(" ")}` };
  spawnSync(claude, ["mcp", "remove", "--scope", "user", "ided"], { encoding: "utf8" });
  const r = spawnSync(claude, ["mcp", "add", "--scope", "user", "ided", "--", command, ...args], { encoding: "utf8" });
  return { what: "Claude Code MCP (user scope)", ok: r.status === 0, detail: r.status === 0 ? `${command} ${args.join(" ")}` : (r.stderr || r.stdout).trim() };
}

export function registerCodexMcp(): SetupStep {
  const home = codexHome();
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
  return { what: `Codex MCP → ${config.replace(homedir(), "~")}`, ok: true, detail: `${command} ${args.join(" ")}` };
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
