import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from "node:fs";
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
