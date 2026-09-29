import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CLI, findBrowser, testEnv, workspace } from "./helpers.ts";

test("MCP server exposes the workflow over stdio", { timeout: 90_000 }, async () => {
  const dir = workspace("--name", "Mcp");
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [CLI, "mcp"], cwd: dir, stderr: "ignore", env: testEnv }));
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text?: string; data?: string }[]; isError?: boolean };
      assert.ok(!r.isError, `${name}: ${r.content[0]?.text}`);
      return r.content;
    };
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const t of ["ided_rules", "ided_check", "ided_get_brand", "ided_screenshot", "ided_use_library", "ided_list_comments"]) assert.ok(names.includes(t), t);
    assert.match((await call("ided_get_brand"))[0]!.text!, /surfaces/);
    assert.match((await call("ided_check"))[0]!.text!, /Clean/);
    assert.match((await call("ided_new_project", { kind: "library", name: "kit" }))[0]!.text!, /design\/kit\/project\.json/);
    assert.match((await call("ided_use_library", { project: "intro", library: "kit" }))[0]!.text!, /now uses kit/);
    if (await findBrowser()) {
      const shot = await call("ided_screenshot", { project: "intro", frames: ["01-statement"], scale: 0.25 });
      const image = shot.find((c) => c.type === "image");
      assert.ok(image?.data && Buffer.from(image.data, "base64").subarray(1, 4).toString() === "PNG");
    }
  } finally {
    await client.close();
  }
});

test("MCP and the CLI export through the same code: same folder, same zip, same refusal", { timeout: 120_000 }, async () => {
  const dir = workspace("--bare", "--name", "Same Kit");
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [CLI, "mcp"], cwd: dir, stderr: "ignore", env: testEnv }));
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      (await client.callTool({ name, arguments: args })) as { content: { text?: string }[]; isError?: boolean };
    const ok = await call("ided_export", { project: "brand" });
    assert.ok(!ok.isError, ok.content[0]?.text);
    assert.ok(existsSync(join(dir, "out/same-kit-brand-kit/README.md")), "the CLI's folder name");
    assert.ok(existsSync(join(dir, "out/same-kit-brand-kit.zip")));

    const brand = join(dir, "design/brand/brand.ts");
    writeFileSync(brand, readFileSync(brand, "utf8").replace(/\bs: 12,/, "s: 13,"));
    const refused = await call("ided_export", { project: "brand", out: "out2" });
    assert.ok(refused.isError, "a brand with errors is not exported");
    assert.match(refused.content[0]!.text!, /brand has errors/);
    assert.ok(!existsSync(join(dir, "out2")));

    await call("ided_new_project", { kind: "library", name: "kit" });
    await call("ided_new_project", { kind: "deck", name: "d" });
    await call("ided_use_library", { project: "d", library: "kit" });
    const removed = await call("ided_use_library", { project: "d", library: "kit", remove: true });
    assert.match(removed.content[0]!.text!, /d no longer uses kit/);
    assert.equal(JSON.parse(readFileSync(join(dir, "design/d/project.json"), "utf8")).dependencies, undefined);
  } finally {
    await client.close();
  }
});
