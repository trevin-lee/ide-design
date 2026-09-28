import { Command, Option } from "commander";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import pc from "picocolors";
import {
  detectAgents,
  gitRoot,
  installGlobalSkills,
  installProjectSkills,
  refreshSkills,
  registerClaudeMcp,
  registerCodexMcp,
  removeGlobal,
  removeProject,
  writeAgentsMd,
  type SetupStep,
} from "../core/agents.ts";
import { formatComment, listComments, updateComment } from "../core/comments.ts";
import { loadBrand } from "../core/load-brand.ts";
import { PKG_VERSION, SKILLS_DIR, WORKSPACE_MARKER } from "../core/paths.ts";
import { addFrame, describeKinds, initWorkspace, newProject, slugify, unuseLibrary, useLibrary, writeGenerated } from "../core/scaffold.ts";
import { findWorkspaceRoot, getProject, requireWorkspaceRoot, scanWorkspace } from "../core/workspace.ts";
import { DOC_PAGES, FRAME_KINDS, GRAPHIC_SIZES, WEB_VIEWPORTS, type FrameKind } from "../shared/formats.ts";
import { brandSummary } from "../shared/summary.ts";

const program = new Command();
program
  .name("ided")
  .description("Parametric graphic design. Design as code.")
  .version(PKG_VERSION, "-v, --version")
  .showHelpAfterError();

function fail(e: unknown): never {
  console.error(pc.red("✖ ") + ((e as Error).message ?? String(e)));
  process.exit(1);
}

function action<A extends unknown[]>(fn: (...args: A) => unknown | Promise<unknown>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (e) {
      fail(e);
    }
  };
}

// ---------------------------------------------------------------------------

program
  .command("init")
  .description("Create an ided workspace (ided.json + design/brand) in the repository root.")
  .option("-n, --name <brand>", "brand name, used for the starter wordmark")
  .option("--bare", "skip the sample deck")
  .option("--here", "use the current directory even inside a git repository")
  .option("--no-agents-md", "do not add an ided section to AGENTS.md")
  .action(
    action((opts: { name?: string; bare?: boolean; here?: boolean; agentsMd: boolean }) => {
      const cwd = process.cwd();
      const existing = findWorkspaceRoot(cwd);
      const root = existing ?? (opts.here ? cwd : gitRoot(cwd) ?? cwd);
      const name = opts.name ?? titleFromDir(basename(root));
      const created = initWorkspace(root, { name, sample: !opts.bare });
      if (opts.agentsMd) {
        const change = writeAgentsMd(root);
        if (change !== "unchanged") created.push(`AGENTS.md (ided section ${change})`);
      }
      console.log(
        existing
          ? `${pc.green("✔")} Workspace already exists at ${root}${created.length ? "; added what was missing:" : "; nothing to add."}`
          : `${pc.green("✔")} Created ided workspace at ${root}`,
      );
      for (const f of created) console.log(pc.dim(`  + ${f}`));
      console.log(`\nNext:\n  ${pc.cyan("ided run")}          open the design viewer\n  ${pc.cyan("ided check")}        verify every artifact\n  ${pc.cyan("ided setup")}        give your coding agents the ided skills`);
    }),
  );

function titleFromDir(dir: string): string {
  return dir.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Brand";
}

program
  .command("run")
  .alias("dev")
  .description("Start the design viewer and open it in the browser.")
  .option("-p, --port <port>", "port (default 4800, next free if busy)")
  .option("--host <host>", "interface to bind", "127.0.0.1")
  .option("--no-open", "do not open a browser")
  .action(
    action(async (opts: { port?: string; host: string; open: boolean }) => {
      const root = requireWorkspaceRoot();
      const { startServer } = await import("../server/index.ts");
      const { isLoopback } = await import("../server/index.ts");
      if (!isLoopback(opts.host)) {
        console.warn(
          pc.yellow(`\n  ! Listening on ${opts.host}: anyone who can reach this machine can read design/, write comments and run exports.`) +
            pc.dim("\n    The viewer has no authentication. Use it only on a network you trust.\n"),
        );
      }
      const server = await startServer({ root, port: opts.port ? Number(opts.port) : undefined, host: opts.host });
      const ws = scanWorkspace(root);
      console.log(`\n  ${pc.bold("ided")} ${pc.dim(PKG_VERSION)}  ${pc.cyan(server.url)}\n`);
      console.log(pc.dim(`  ${ws.projects.length} project${ws.projects.length === 1 ? "" : "s"} in ${relative(process.cwd(), ws.designDir) || "design"} · watching for changes · Ctrl+C to stop\n`));
      if (opts.open) {
        const { default: open } = await import("open");
        await open(server.url);
      }
      const stop = async () => {
        await server.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    }),
  );

program
  .command("new")
  .description(`Create a project. Kinds: ${describeKinds()}.`)
  .argument("<kind>", [...FRAME_KINDS, "library"].join(" | "))
  .argument("<name>", "kebab-case project name (folder under design/)")
  .option("-t, --title <title>", "display title")
  .addOption(new Option("--page <page>", "doc page size").choices(Object.keys(DOC_PAGES)))
  .addOption(new Option("--size <size>", "graphic size").choices(Object.keys(GRAPHIC_SIZES)))
  .addOption(new Option("--viewport <viewport>", "web viewport").choices(Object.keys(WEB_VIEWPORTS)))
  .action(
    action((kind: string, name: string, opts: { title?: string; page?: "letter" | "a4"; size?: string; viewport?: string }) => {
      const kinds = [...FRAME_KINDS, "library"];
      if (!kinds.includes(kind)) throw new Error(`Unknown kind "${kind}". Kinds: ${kinds.join(", ")}. (The brand project is created by \`ided init\`.)`);
      const root = requireWorkspaceRoot();
      const created = newProject(scanWorkspace(root), kind as FrameKind | "library", name, opts);
      console.log(`${pc.green("✔")} Created ${kind} ${pc.bold(name)}`);
      for (const f of created) console.log(pc.dim(`  + ${f}`));
    }),
  );

program
  .command("add")
  .description("Add the next numbered frame to a project, or a component to a library or the brand.")
  .argument("<project>")
  .argument("<name>", "frame or component name, e.g. agenda")
  .action(
    action((project: string, name: string) => {
      const root = requireWorkspaceRoot();
      const { file } = addFrame(scanWorkspace(root), project, name);
      console.log(`${pc.green("✔")} ${file}`);
    }),
  );

program
  .command("use")
  .description("Declare that a project imports from a library (adds it to project.json dependencies), or --remove it.")
  .argument("<project>")
  .argument("<library>")
  .option("--remove", "stop using the library")
  .action(
    action((project: string, library: string, opts: { remove?: boolean }) => {
      const root = requireWorkspaceRoot();
      if (!opts.remove) return console.log(`${pc.green("✔")} ${useLibrary(scanWorkspace(root), project, library)}`);
      const { message, stillImporting } = unuseLibrary(scanWorkspace(root), project, library);
      console.log(`${pc.green("✔")} ${message}`);
      if (stillImporting.length) {
        console.log(pc.yellow(`! These files still import from @${library}; \`ided check\` will flag them until they change:`));
        for (const f of stillImporting) console.log(pc.dim(`  ${f}`));
      }
    }),
  );

program
  .command("list")
  .alias("ls")
  .description("List projects and their frames.")
  .option("--json", "machine-readable output")
  .action(
    action((opts: { json?: boolean }) => {
      const root = requireWorkspaceRoot();
      const ws = scanWorkspace(root);
      const data = ws.projects.map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        size: p.geometry ? `${p.geometry.width}x${p.geometry.fixedHeight ? p.geometry.height : "auto"}` : null,
        frames: p.frames.map((f) => ({ id: f.id, file: relative(root, f.abs) })),
        components: p.components,
        assets: p.assets.filter((a) => !a.startsWith("fonts/")),
        dependencies: p.dependencies,
        issues: p.issues.length,
      }));
      if (opts.json) return console.log(JSON.stringify(data, null, 2));
      for (const p of data) {
        const deps = p.dependencies.length ? pc.cyan(`  uses ${p.dependencies.join(", ")}`) : "";
        const size = p.kind === "brand" || p.kind === "library" ? "" : ` ${p.size}`;
        console.log(`${pc.bold(p.id)} ${pc.dim(`${p.kind}${size}`)}  ${p.title}${deps}${p.issues ? pc.red(`  ${p.issues} issue(s)`) : ""}`);
        for (const f of p.frames) console.log(pc.dim(`  ${f.file}`));
        for (const c of p.components) console.log(pc.dim(`  @${p.id}/${c.replace(/\.tsx$/, "")}`));
        for (const a of p.assets) console.log(pc.dim(`  @${p.id}/assets/${a}`));
      }
    }),
  );

program
  .command("check")
  .description("Verify structure, lint rules, types and rendered output. Exit code 1 on errors.")
  .argument("[project]", "limit to one project")
  .option("--json", "machine-readable output")
  .option("--no-render", "skip the render audit (faster; no contrast/radius checks)")
  .action(
    action(async (project: string | undefined, opts: { json?: boolean; render: boolean }) => {
      const root = requireWorkspaceRoot();
      const { runCheck, formatIssues } = await import("../check/index.ts");
      const result = await runCheck(root, { project, render: opts.render });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatIssues(result));
      process.exitCode = result.issues.some((i) => i.severity === "error") ? 1 : 0;
    }),
  );

program
  .command("brand")
  .description("Print the brand's tokens: the only values an artifact may use.")
  .option("--json", "machine-readable output")
  .action(
    action(async (opts: { json?: boolean }) => {
      const root = requireWorkspaceRoot();
      const { createIdedVite } = await import("../server/vite.ts");
      const vite = await createIdedVite({ root, ssrOnly: true });
      try {
        const loaded = await loadBrand(vite, scanWorkspace(root));
        if (!loaded.brand) throw new Error(loaded.error ?? "Brand did not load.");
        if (opts.json) console.log(JSON.stringify(loaded.brand, null, 2));
        else console.log(brandSummary(loaded.brand));
        for (const i of loaded.issues) console.error(`${i.severity === "error" ? pc.red("error") : pc.yellow("warn")} brand.ts ${i.path}: ${i.message}`);
      } finally {
        await vite.close();
      }
    }),
  );

program
  .command("rules")
  .description("Print the framework rules and primitive reference (what agents read).")
  .action(
    action(() => {
      console.log(readFileSync(join(SKILLS_DIR, "ided", "references", "primitives.md"), "utf8"));
    }),
  );

const exportCmd = program
  .command("export")
  .description('Export a project to PDF/PNG/JPEG, or "brand" to a brand kit.')
  .argument("<project>", 'project id, or "brand" for the brand kit')
  .addOption(new Option("-f, --format <format>", "artifact format").choices(["pdf", "png", "jpeg"]).default("pdf"))
  .option("--frames <ids>", "comma-separated frame ids (e.g. 01-title,03-numbers)")
  .option("-o, --out <dir>", "output directory", "out")
  .option("--scale <n>", "pixel density for raster output", "2")
  .option("--zip", "brand kit: also write a .zip");
exportCmd.action(
  action(async (project: string, opts: { format: "pdf" | "png" | "jpeg"; frames?: string; out: string; scale: string; zip?: boolean }) => {
    const root = requireWorkspaceRoot();
    const ws = scanWorkspace(root);
    const out = resolve(opts.out);
    if (project === "brand") {
      const { createIdedVite } = await import("../server/vite.ts");
      const { buildBrandKit, writeBrandKit, zipBrandKit } = await import("../export/brand-kit.ts");
      const vite = await createIdedVite({ root, ssrOnly: true });
      try {
        const loaded = await loadBrand(vite, ws);
        if (!loaded.brand) throw new Error(loaded.error ?? "Brand did not load.");
        const errors = loaded.issues.filter((i) => i.severity === "error");
        if (errors.length) throw new Error(`Brand has errors; run \`ided check brand\`:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`);
        const files = buildBrandKit({ brand: loaded.brand, svgs: loaded.svgs, brandAssetsDir: join(ws.designDir, "brand", "assets"), version: process.env.GITHUB_SHA?.slice(0, 7) });
        const folder = `${slugify(loaded.brand.name) || "brand"}-brand-kit`;
        const dir = join(out, folder);
        writeBrandKit(files, dir);
        console.log(`${pc.green("✔")} ${files.length} files → ${relative(process.cwd(), dir)}`);
        if (opts.zip) {
          const zipPath = join(out, `${folder}.zip`);
          writeFileSync(zipPath, zipBrandKit(files, folder));
          console.log(`${pc.green("✔")} ${relative(process.cwd(), zipPath)}`);
        }
      } finally {
        await vite.close();
      }
      return;
    }
    const p = getProject(ws, project);
    const { startServer } = await import("../server/index.ts");
    const { exportProject, writeExport } = await import("../export/artifacts.ts");
    const server = await startServer({ root, port: 0 });
    try {
      const files = await exportProject({ baseUrl: server.url, project: p, format: opts.format, frames: opts.frames?.split(","), scale: Number(opts.scale) });
      const paths = writeExport(files, opts.format === "pdf" ? out : join(out, p.id));
      for (const f of paths) console.log(`${pc.green("✔")} ${relative(process.cwd(), f)}`);
    } finally {
      await server.close();
    }
  }),
);

const browserCmd = program.command("browser").description("The pinned Chromium that renders PDF/PNG exports.");
browserCmd
  .command("status", { isDefault: true })
  .description("Show the pinned build, where it lives and whether it is installed.")
  .option("--json", "machine-readable output")
  .action(
    action(async (opts: { json?: boolean }) => {
      const { browserStatus, browsersDir } = await import("../export/browser.ts");
      const s = browserStatus();
      if (opts.json) return console.log(JSON.stringify({ ...s, cache: browsersDir() }, null, 2));
      const mb = s.sizeBytes ? ` (${Math.round(s.sizeBytes / 1048576)} MB)` : "";
      console.log(`Chromium ${s.version} (headless shell, pinned by this ided version)`);
      console.log(`${s.installed ? pc.green("✔ installed") : pc.yellow("not installed")}  ${pc.dim(s.dir + mb)}`);
      if (!s.installed) console.log(pc.dim("  Downloads automatically on first export, or now with `ided browser install`."));
      if (process.env.IDED_CHROME_PATH) console.log(pc.yellow(`! IDED_CHROME_PATH is set; exports use ${process.env.IDED_CHROME_PATH} instead.`));
    }),
  );
browserCmd
  .command("install")
  .description("Download the pinned Chromium now (about 100 MB, shared by every workspace).")
  .action(
    action(async () => {
      const { browserStatus, installBrowser } = await import("../export/browser.ts");
      const before = browserStatus();
      if (before.installed) return console.log(`${pc.green("✔")} Chromium ${before.version} is already installed ${pc.dim(before.dir)}`);
      await installBrowser();
      console.log(`${pc.green("✔")} Chromium ${before.version} ${pc.dim(browserStatus().dir)}`);
    }),
  );

program
  .command("screenshot")
  .description("Render a frame to PNG, or every frame onto one contact sheet (for agents to look at their work).")
  .argument("<project>")
  .argument("[frame]", "frame id, e.g. 01-title, or its number")
  .option("--sheet", "every frame of the project on one labeled image")
  .option("-o, --out <file>", "output file")
  .option("--scale <n>", "pixel density", "1")
  .action(
    action(async (project: string, frame: string | undefined, opts: { out?: string; scale: string; sheet?: boolean }) => {
      const root = requireWorkspaceRoot();
      const p = getProject(scanWorkspace(root), project);
      if (!opts.sheet && !frame) throw new Error("Name a frame, or pass --sheet for all of them on one image.");
      const f = frame ? p.frames.find((x) => x.id === frame || String(x.number) === frame.replace(/^0+/, "") || x.id.endsWith(`-${frame}`)) : undefined;
      if (frame && !f) throw new Error(`No frame "${frame}" in ${project}. Frames: ${p.frames.map((x) => x.id).join(", ")}`);
      const { startServer } = await import("../server/index.ts");
      const { exportProject, exportSheet } = await import("../export/artifacts.ts");
      const server = await startServer({ root, port: 0 });
      try {
        const file = opts.sheet
          ? await exportSheet({ baseUrl: server.url, project: p, scale: Number(opts.scale) })
          : (await exportProject({ baseUrl: server.url, project: p, format: "png", frames: [f!.id], scale: Number(opts.scale) }))[0]!;
        const target = resolve(opts.out ?? join(root, "design", ".ided", "screenshots", opts.sheet ? `${p.id}-sheet.png` : `${p.id}-${f!.id}.png`));
        mkdirSync(resolve(target, ".."), { recursive: true });
        writeFileSync(target, file.data);
        console.log(target);
      } finally {
        await server.close();
      }
    }),
  );

const comments = program.command("comments").description("Review comments left in the viewer.");
comments
  .command("list", { isDefault: true })
  .description("List open comments with the source line each one points at.")
  .argument("[project]")
  .option("-a, --all", "include resolved")
  .option("--json", "machine-readable output")
  .action(
    action((project: string | undefined, opts: { all?: boolean; json?: boolean }) => {
      const ws = scanWorkspace(requireWorkspaceRoot());
      const list = listComments(ws, { project, status: opts.all ? "all" : "open" });
      if (opts.json) return console.log(JSON.stringify(list, null, 2));
      if (!list.length) return console.log(pc.dim("No open comments."));
      console.log(list.map(formatComment).join("\n\n"));
    }),
  );
comments
  .command("resolve")
  .description("Mark a comment resolved, optionally with a note on what changed.")
  .argument("<id>")
  .option("-m, --message <note>", "reply explaining the fix")
  .action(
    action((id: string, opts: { message?: string }) => {
      const ws = scanWorkspace(requireWorkspaceRoot());
      updateComment(ws, id, { status: "resolved", reply: opts.message ? { author: "agent", body: opts.message } : undefined });
      console.log(`${pc.green("✔")} Resolved ${id}`);
    }),
  );
comments
  .command("reply")
  .description("Reply to a comment without resolving it.")
  .argument("<id>")
  .argument("<message...>")
  .action(
    action((id: string, message: string[]) => {
      const ws = scanWorkspace(requireWorkspaceRoot());
      updateComment(ws, id, { reply: { author: "agent", body: message.join(" ") } });
      console.log(`${pc.green("✔")} Replied to ${id}`);
    }),
  );

program
  .command("mcp")
  .description("Run the MCP server on stdio (launched by Claude Code, Codex, etc.).")
  .action(
    action(async () => {
      const { runMcpServer } = await import("../mcp/server.ts");
      await runMcpServer();
    }),
  );

program
  .command("setup")
  .description("Install ided's skills for your coding agents (the Agent Skills standard: Claude Code, Codex, Cursor, Copilot, Gemini CLI and more) and register the MCP server.")
  .option("--project", "install into this repository instead, for everyone who clones it: .agents/skills, .claude/skills, AGENTS.md, .mcp.json")
  .option("--no-mcp", "skills only; do not register the MCP server")
  .option("--claude", "register the MCP server with Claude Code only")
  .option("--codex", "register the MCP server with Codex only")
  .option("--remove", "undo setup: remove the skills and MCP registrations (with --project, from this repository)")
  .action(
    action((opts: { project?: boolean; mcp: boolean; claude?: boolean; codex?: boolean; remove?: boolean }) => {
      if (opts.remove) {
        const steps = opts.project ? removeProject(requireWorkspaceRoot()) : removeGlobal();
        for (const s of steps) console.log(`${s.ok ? pc.green("✔") : pc.yellow("!")} ${s.what}${s.detail ? pc.dim(`  ${s.detail}`) : ""}`);
        return;
      }
      const steps: SetupStep[] = [];
      if (opts.project) {
        steps.push(...installProjectSkills(requireWorkspaceRoot()));
        if (!opts.mcp) steps.pop();
      } else {
        steps.push(installGlobalSkills());
        if (opts.mcp) {
          const agents = opts.claude || opts.codex ? [...(opts.claude ? ["claude"] : []), ...(opts.codex ? ["codex"] : [])] : detectAgents();
          if (agents.includes("claude")) steps.push(registerClaudeMcp());
          if (agents.includes("codex")) steps.push(registerCodexMcp());
        }
      }
      for (const s of steps) console.log(`${s.ok ? pc.green("✔") : pc.yellow("!")} ${s.what}${s.detail ? pc.dim(`  ${s.detail}`) : ""}`);
      console.log(
        pc.dim(
          opts.project
            ? "\nCommit these files; teammates' agents pick them up on clone. Restart your agent session."
            : "\nAny agent that can run a shell can also use the ided CLI directly. Other MCP clients: point them at `ided mcp`.\nRestart your agent session to pick up the skills.",
        ),
      );
    }),
  );

program
  .command("ci")
  .description("Write a GitHub Actions workflow that publishes the brand kit on every change to design/brand.")
  .option("--force", "overwrite an existing workflow")
  .action(
    action((opts: { force?: boolean }) => {
      const root = requireWorkspaceRoot();
      const target = join(root, ".github", "workflows", "brand-kit.yml");
      if (existsSync(target) && !opts.force) throw new Error(`${relative(process.cwd(), target)} exists. Use --force to overwrite.`);
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(target, readFileSync(join(SKILLS_DIR, "..", "templates", "brand-kit.yml"), "utf8"));
      console.log(`${pc.green("✔")} ${relative(process.cwd(), target)}`);
      console.log(pc.dim("  Set the BRAND_KIT_BUCKET variable and AWS credentials secrets in the repository settings."));
    }),
  );

program.hook("preAction", (_cmd, sub) => {
  refreshSkills();
  // Keep generated editor types current for whatever the command touches.
  if (["init", "mcp", "setup", "ci", "browser", "status", "install"].includes(sub.name())) return;
  const root = findWorkspaceRoot();
  if (root && existsSync(join(root, WORKSPACE_MARKER))) {
    try {
      writeGenerated(root);
    } catch {
      // non-fatal
    }
  }
});

program.parseAsync(process.argv).catch(fail);
