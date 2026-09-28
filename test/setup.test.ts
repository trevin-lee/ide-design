import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { FAKE_HOME, runWith } from "./helpers.ts";

const claude = join(FAKE_HOME, ".claude", "skills");
const codex = join(FAKE_HOME, ".codex", "skills");
// A PATH with node but without the real `claude`, `codex` or `ided`, so nothing outside FAKE_HOME changes.
const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` };
const version = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")).version as string;

test("setup links Claude skills, copies Codex skills and registers the MCP server", { timeout: 30_000 }, () => {
  mkdirSync(join(codex, "ided-compose"), { recursive: true }); // someone else's folder with our name, no SKILL.md
  const r = runWith(env, FAKE_HOME, "setup", "--claude", "--codex");
  assert.equal(r.status, 0, r.stderr);

  assert.ok(lstatSync(join(claude, "ided")).isSymbolicLink());
  assert.match(readlinkSync(join(claude, "ided")), /skills\/ided$/);
  assert.ok(existsSync(join(claude, "ided", "SKILL.md")));
  assert.match(r.stdout, /claude CLI not found/);

  assert.equal(readFileSync(join(codex, "ided", ".ided-version"), "utf8").trim(), version);
  assert.ok(!existsSync(join(codex, "ided-compose", "SKILL.md")), "a folder ided did not create is left alone");
  assert.match(r.stdout, /left your own ided-compose untouched/);

  const toml = readFileSync(join(FAKE_HOME, ".codex", "config.toml"), "utf8");
  const command = /command = "([^"]+)"/.exec(toml)?.[1] ?? "";
  assert.ok(command.startsWith("/"), `MCP command is absolute: ${command}`);
  rmSync(join(codex, "ided-compose"), { recursive: true });
});

test("any ided command refreshes stale skills after an upgrade", { timeout: 30_000 }, () => {
  runWith(env, FAKE_HOME, "setup", "--claude", "--codex");
  // An older copy, a link left dangling by an uninstalled version, and a skill the old version lacked.
  writeFileSync(join(codex, "ided", ".ided-version"), "0.0.1\n");
  writeFileSync(join(codex, "ided", "SKILL.md"), "stale");
  unlinkSync(join(claude, "ided"));
  symlinkSync("/nonexistent/old-version/skills/ided", join(claude, "ided"), "dir");
  rmSync(join(claude, "ided-brand"));
  rmSync(join(codex, "ided-brand"), { recursive: true });

  assert.equal(runWith(env, FAKE_HOME, "browser", "status").status, 0);

  assert.match(readFileSync(join(codex, "ided", "SKILL.md"), "utf8"), /^---\nname: ided\n/);
  assert.equal(readFileSync(join(codex, "ided", ".ided-version"), "utf8").trim(), version);
  assert.ok(existsSync(join(claude, "ided", "SKILL.md")), "dangling link re-pointed");
  assert.ok(lstatSync(join(claude, "ided-brand")).isSymbolicLink(), "missing skill linked");
  assert.ok(existsSync(join(codex, "ided-brand", "SKILL.md")), "missing skill copied");
});
