import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { FAKE_HOME, run, runWith, workspace } from "./helpers.ts";

const shared = join(FAKE_HOME, ".agents", "skills");
const claude = join(FAKE_HOME, ".claude", "skills");
const codex = join(FAKE_HOME, ".codex", "skills");
// A PATH with node but without the real `claude`, `codex` or `ided`, so nothing outside FAKE_HOME changes.
const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` };
const version = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")).version as string;

test("setup installs skills once in the shared folder and links agents that need it", { timeout: 120_000 }, () => {
  mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
  // A Codex copy left by an older ided: Codex now reads the shared folder, so it must go.
  mkdirSync(join(codex, "ided"), { recursive: true });
  writeFileSync(join(codex, "ided", "SKILL.md"), "---\nname: ided\n---\nold");
  writeFileSync(join(codex, "ided", ".ided-version"), "0.0.1\n");

  const r = runWith(env, FAKE_HOME, "setup");
  assert.equal(r.status, 0, r.stderr);

  assert.match(readFileSync(join(shared, "ided", "SKILL.md"), "utf8"), /^---\nname: ided\n/);
  assert.equal(readFileSync(join(shared, "ided", ".ided-version"), "utf8").trim(), version);
  assert.ok(lstatSync(join(claude, "ided-design")).isSymbolicLink(), "Claude Code gets a link");
  assert.equal(realpathSync(join(claude, "ided-design")), realpathSync(join(shared, "ided-design")));
  assert.ok(!existsSync(join(codex, "ided")), "the old Codex copy is removed");
  assert.match(r.stdout, /claude CLI not found/);
  assert.match(readFileSync(join(FAKE_HOME, ".codex", "config.toml"), "utf8"), /\[mcp_servers\.ided\]/);
});

test("any ided command refreshes the shared skills after an upgrade", { timeout: 120_000 }, () => {
  runWith(env, FAKE_HOME, "setup", "--no-mcp");
  writeFileSync(join(shared, "ided", ".ided-version"), "0.0.1\n");
  writeFileSync(join(shared, "ided", "SKILL.md"), "stale");
  assert.equal(runWith(env, FAKE_HOME, "browser", "status").status, 0);
  assert.match(readFileSync(join(shared, "ided", "SKILL.md"), "utf8"), /^---\nname: ided\n/);
  assert.equal(readFileSync(join(shared, "ided", ".ided-version"), "utf8").trim(), version);
});

test("setup --project commits portable skills, an AGENTS.md section and MCP config", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  const r = run(dir, "setup", "--project");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, ".agents/skills/ided/.ided-version"), "utf8").trim(), version);
  assert.equal(readlinkSync(join(dir, ".claude/skills/ided")), join("..", "..", ".agents", "skills", "ided"), "relative link, portable across checkouts");
  assert.match(readFileSync(join(dir, "AGENTS.md"), "utf8"), /<!-- ided:start -->[\s\S]*ided rules[\s\S]*<!-- ided:end -->/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")).mcpServers.ided, { command: "ided", args: ["mcp"] });
  assert.ok(!existsSync(join(dir, "skills-lock.json")), "nothing machine-specific is written");

  // The project copy refreshes too.
  writeFileSync(join(dir, ".agents/skills/ided-design/.ided-version"), "0.0.1\n");
  writeFileSync(join(dir, ".agents/skills/ided-design/SKILL.md"), "stale");
  run(dir, "list");
  assert.match(readFileSync(join(dir, ".agents/skills/ided-design/SKILL.md"), "utf8"), /^---\nname: ided-design\n/);
});

test("init adds one ided section to AGENTS.md, keeps the rest, and can skip it", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  const file = join(dir, "AGENTS.md");
  writeFileSync(file, readFileSync(file, "utf8") + "\n## Tests\n\nRun npm test.\n");
  run(dir, "init", "--here", "--bare");
  const text = readFileSync(file, "utf8");
  assert.equal(text.split("<!-- ided:start -->").length - 1, 1);
  assert.match(text, /## Tests\n\nRun npm test\./);

  const bare = workspace("--bare", "--no-agents-md");
  assert.ok(!existsSync(join(bare, "AGENTS.md")));
});

test("a skill renamed since 0.1 is cleaned up; other skills are untouched", { timeout: 60_000 }, () => {
  mkdirSync(claude, { recursive: true });
  rmSync(join(claude, "ided-compose"), { force: true });
  rmSync(join(claude, "someone-elses"), { force: true });
  symlinkSync("/opt/homebrew/opt/ided/libexec/lib/node_modules/ided/skills/ided-compose", join(claude, "ided-compose"), "dir");
  symlinkSync("../../.agents/skills/someone-elses", join(claude, "someone-elses"), "dir");
  assert.equal(runWith(env, FAKE_HOME, "browser", "status").status, 0);
  assert.ok(!lstatSync(join(claude, "ided-compose"), { throwIfNoEntry: false }), "retired skill link removed");
  assert.ok(lstatSync(join(claude, "someone-elses"), { throwIfNoEntry: false }), "other skills untouched");
});

test("setup --remove undoes setup and leaves everything else alone", { timeout: 120_000 }, () => {
  runWith(env, FAKE_HOME, "setup");
  const toml = join(FAKE_HOME, ".codex", "config.toml");
  writeFileSync(toml, `[model]\nname = "x"\n\n${readFileSync(toml, "utf8")}`);
  const r = runWith(env, FAKE_HOME, "setup", "--remove");
  assert.equal(r.status, 0, r.stderr);
  for (const n of ["ided", "ided-brand", "ided-design"]) {
    assert.ok(!existsSync(join(shared, n)), `${n} removed from ~/.agents/skills`);
    assert.ok(!lstatSync(join(claude, n), { throwIfNoEntry: false }), `${n} link removed from ~/.claude/skills`);
  }
  const config = readFileSync(toml, "utf8");
  assert.ok(!/mcp_servers\.ided/.test(config));
  assert.match(config, /\[model\]\nname = "x"/);
});

test("setup --project --remove takes out only what ided added", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  const agentsMd = join(dir, "AGENTS.md");
  writeFileSync(agentsMd, readFileSync(agentsMd, "utf8") + "\n## Tests\n\nRun npm test.\n");
  writeFileSync(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
  run(dir, "setup", "--project");
  const r = run(dir, "setup", "--project", "--remove");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(dir, ".agents")) && !existsSync(join(dir, ".claude")));
  const text = readFileSync(agentsMd, "utf8");
  assert.ok(!text.includes("ided:start"));
  assert.match(text, /## Tests/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")), { mcpServers: { other: { command: "x" } } });

  // A repository whose AGENTS.md only ever held ided's section loses the file entirely.
  const plain = workspace("--bare");
  run(plain, "setup", "--project", "--remove");
  assert.ok(!existsSync(join(plain, "AGENTS.md")));
});

test("setup writes only for agents that are there, and --remove leaves the home folder as it was", { timeout: 120_000 }, () => {
  const home = mkdtempSync(join(tmpdir(), "ided-empty-home-"));
  const clean = { ...env, HOME: home, CODEX_HOME: join(home, ".codex") };
  const entries = () => readdirSync(home).sort();

  assert.equal(runWith(clean, home, "setup").status, 0);
  assert.deepEqual(entries(), [".agents"], "no agent installed: only the shared folder");
  assert.ok(existsSync(join(home, ".agents/skills/ided/SKILL.md")));

  const named = runWith(clean, home, "setup", "--agent", "trae");
  assert.equal(named.status, 0, named.stderr);
  assert.deepEqual(entries(), [".agents", ".trae"], "a named agent gets its own folder");
  assert.ok(existsSync(join(home, ".trae/skills/ided-design/SKILL.md")));

  assert.equal(runWith(clean, home, "setup", "--remove").status, 0);
  assert.deepEqual(entries(), [], "everything setup created is gone");
  rmSync(home, { recursive: true, force: true });
});

test("setup --project --no-mcp writes no .mcp.json, and --agent is user-wide only", { timeout: 60_000 }, () => {
  const dir = workspace("--bare");
  assert.equal(run(dir, "setup", "--project", "--no-mcp").status, 0);
  assert.ok(existsSync(join(dir, ".agents/skills/ided/SKILL.md")));
  assert.ok(!existsSync(join(dir, ".mcp.json")));
  const r = run(dir, "setup", "--project", "--agent", "trae");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--agent is for user-wide setup/);
});
