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
import { addFrame, describeKinds, initWorkspace, newProject, unuseLibrary, useLibrary, writeGenerated } from "../core/scaffold.ts";
import { defaultScreenshotScale, findWorkspaceRoot, getProject, requireWorkspaceRoot, resolveFrames, scanWorkspace } from "../core/workspace.ts";
import { describeGeometry, DOC_PAGES, FRAME_KINDS, GRAPHIC_SIZES, isFrameKind, WEB_VIEWPORTS, type FrameKind } from "../shared/formats.ts";
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
  .option("--viewport <viewports>", `web viewport (${Object.keys(WEB_VIEWPORTS).join(", ")}), or several separated by commas for a responsive screen, e.g. desktop,mobile`)
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
        // Only frame projects have a frame size; the brand and libraries hold components and assets.
        size: p.geometry && isFrameKind(p.kind) ? describeGeometry(p.geometry) : null,
        frames: p.frames.map((f) => ({ id: f.id, file: relative(root, f.abs) })),
        components: p.components,
        assets: p.assets.filter((a) => !a.startsWith("fonts/")),
        dependencies: p.dependencies,
        issues: p.issues.length,
      }));
      if (opts.json) return console.log(JSON.stringify(data, null, 2));
      for (const p of data) {
        const deps = p.dependencies.length ? pc.cyan(`  uses ${p.dependencies.join(", ")}`) : "";
        const size = p.size ? ` ${p.size}` : "";
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
  .option("--no-render", "skip the render audit and the layout check (fastest; no contrast, radius or overflow checks)")
  .option("--no-layout", "skip the layout check, which measures frames in the pinned Chromium (overflow, ratios, crops)")
  .action(
    action(async (project: string | undefined, opts: { json?: boolean; render: boolean; layout: boolean }) => {
      const root = requireWorkspaceRoot();
      const { runCheck, formatIssues } = await import("../check/index.ts");
      const result = await runCheck(root, { project, render: opts.render, layout: opts.layout });
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
  .addOption(new Option("-f, --format <format>", "artifact format (default: pdf; png for web projects)").choices(["pdf", "png", "jpeg"]))
  .option("--frames <frames>", "comma-separated frames by id, number or name (e.g. 01-title,3)")
  .option("-o, --out <dir>", "output directory (default: out/ in the workspace)")
  .option("--scale <n>", "pixel density for raster output", "2")
  .option("--zip", "brand kit: also write a .zip");
exportCmd.action(
  action(async (project: string, opts: { format?: "pdf" | "png" | "jpeg"; frames?: string; out?: string; scale: string; zip?: boolean }) => {
    const root = requireWorkspaceRoot();
    const { exportArtifacts, exportBrandKit } = await import("../export/operations.ts");
    // Default: <workspace>/out wherever you run it from; an explicit path is relative to here.
    const out = opts.out ? resolve(opts.out) : join(root, "out");
    if (project === "brand") {
      const kit = await exportBrandKit(root, { out, zip: opts.zip, version: process.env.GITHUB_SHA?.slice(0, 7) });
      console.log(`${pc.green("✔")} ${kit.count} files → ${relative(process.cwd(), kit.dir)}`);
      if (kit.zip) console.log(`${pc.green("✔")} ${relative(process.cwd(), kit.zip)}`);
      return;
    }
    const frames = opts.frames ? resolveFrames(getProject(scanWorkspace(root), project), opts.frames.split(",")) : undefined;
    const paths = await exportArtifacts(root, project, { out, format: opts.format, frames, scale: Number(opts.scale) });
    for (const f of paths) console.log(`${pc.green("✔")} ${relative(process.cwd(), f)}`);
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
browserCmd
  .command("remove")
  .description("Delete the downloaded Chromium (it downloads again on the next export).")
  .action(
    action(async () => {
      const { browsersDir, removeBrowsers } = await import("../export/browser.ts");
      const { removed, bytes } = removeBrowsers();
      if (!removed.length) return console.log(pc.dim(`Nothing to remove in ${browsersDir()}.`));
      console.log(`${pc.green("✔")} Removed ${removed.join(", ")} ${pc.dim(`(${Math.round(bytes / 1048576)} MB)`)}`);
    }),
  );

program
  .command("screenshot")
  .description("Render a frame to PNG, or every frame onto one contact sheet (for agents to look at their work).")
  .argument("<project>")
  .argument("[frame]", "frame id, e.g. 01-title, or its number")
  .option("--sheet", "every frame of the project on one labeled image")
  .option("--zoom <grid>", "cut the frame into full-resolution tiles, columns x rows (e.g. 2x2), to inspect detail")
  .option("--page <n>", "which page of a flowing doc page (default 1)")
  .option("--viewport <name>", "which viewport of a responsive web screen (default: the widest)")
  .option("-o, --out <path>", "output file (a folder with --zoom)")
  .option("--scale <n>", "pixel density (default 1, or 0.5 for frames wider than 1600)")
  .action(
    action(async (project: string, frame: string | undefined, opts: { out?: string; scale?: string; sheet?: boolean; zoom?: string; page?: string; viewport?: string }) => {
      const pageNo = opts.page === undefined ? 1 : Number(opts.page);
      if (!Number.isInteger(pageNo) || pageNo < 1) throw new Error("--page is a page number, 1 or more.");
      const root = requireWorkspaceRoot();
      const p = getProject(scanWorkspace(root), project);
      if (!isFrameKind(p.kind)) throw new Error(`"${p.id}" is ${p.kind === "brand" ? "the brand" : "a library"} and has no frames; screenshot a project that uses it, or open it in the viewer (\`ided run\`).`);
      if (!opts.sheet && !frame) throw new Error("Name a frame, or pass --sheet for all of them on one image.");
      if (opts.sheet && opts.zoom) throw new Error("--zoom cuts one frame into tiles; it does not combine with --sheet.");
      const viewports = p.geometry?.viewports?.map((v) => v.name) ?? [];
      if (opts.viewport && !viewports.includes(opts.viewport as never)) {
        throw new Error(viewports.length > 1 ? `${p.id} renders at ${viewports.join(", ")}.` : `--viewport is for responsive web screens; ${p.id} has ${viewports.length ? "one viewport" : "no viewports"}.`);
      }
      const viewport = viewports.length > 1 ? (opts.viewport ?? viewports[0]) : undefined;
      const shotScale = opts.scale ? Number(opts.scale) : defaultScreenshotScale(p.geometry?.width ?? 0);
      const f = frame ? p.frames.find((x) => x.id === resolveFrames(p, [frame])[0]) : undefined;
      const { startServer } = await import("../server/index.ts");
      const { exportProject, exportSheet, exportTiles, parseZoom } = await import("../export/artifacts.ts");
      const grid = opts.zoom ? parseZoom(opts.zoom) : null;
      const server = await startServer({ root, port: 0 });
      try {
        if (grid) {
          const tiles = await exportTiles({ baseUrl: server.url, project: p, frame: f!.id, page: pageNo, viewport, ...grid, scale: shotScale });
          const dir = resolve(opts.out ?? join(root, "design", ".ided", "screenshots"));
          mkdirSync(dir, { recursive: true });
          for (const t of tiles) {
            const target = join(dir, `${p.id}-${t.name}`);
            writeFileSync(target, t.data);
            console.log(target);
          }
          return;
        }
        let file;
        if (opts.sheet) file = await exportSheet({ baseUrl: server.url, project: p, scale: shotScale });
        else {
          const all = await exportProject({ baseUrl: server.url, project: p, format: "png", frames: [f!.id], scale: shotScale });
          const pages = viewport ? all.filter((x) => x.name === `${f!.id}-${viewport}.png`) : all;
          if (pageNo > pages.length) throw new Error(`${f!.id} has ${pages.length} page${pages.length === 1 ? "" : "s"}.`);
          file = pages[pageNo - 1]!;
          if (pages.length > 1 && opts.page === undefined) console.error(pc.dim(`${f!.id} flows onto ${pages.length} pages; this is page 1 (--page <n> for another, --sheet for all).`));
        }
        const target = resolve(opts.out ?? join(root, "design", ".ided", "screenshots", opts.sheet ? `${p.id}-sheet.png` : `${p.id}-${f!.id}${pageNo > 1 ? `-${pageNo}` : ""}${viewport ? `-${viewport}` : ""}.png`));
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
  .option("--author <name>", "who is replying", "agent")
  .action(
    action((id: string, opts: { message?: string; author: string }) => {
      const ws = scanWorkspace(requireWorkspaceRoot());
      updateComment(ws, id, { status: "resolved", reply: opts.message ? { author: opts.author, body: opts.message } : undefined });
      console.log(`${pc.green("✔")} Resolved ${id}`);
    }),
  );
comments
  .command("reply")
  .description("Reply to a comment without resolving it.")
  .argument("<id>")
  .argument("<message...>")
  .option("--author <name>", "who is replying", "agent")
  .action(
    action((id: string, message: string[], opts: { author: string }) => {
      const ws = scanWorkspace(requireWorkspaceRoot());
      updateComment(ws, id, { reply: { author: opts.author, body: message.join(" ") } });
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
  .option("--agent <names...>", "also install for agents that keep their own skills folder, e.g. trae junie kiro-cli (names as in `npx skills`)")
  .option("--no-mcp", "skills only; do not register the MCP server")
  .option("--claude", "register the MCP server with Claude Code only")
  .option("--codex", "register the MCP server with Codex only")
  .option("--remove", "undo setup: remove the skills and MCP registrations (with --project, from this repository)")
  .action(
    action((opts: { project?: boolean; agent?: string[]; mcp: boolean; claude?: boolean; codex?: boolean; remove?: boolean }) => {
      if (opts.project && opts.agent) throw new Error("--agent is for user-wide setup. In a repository, agents read .agents/skills (and Claude Code .claude/skills).");
      if (opts.remove) {
        const steps = opts.project ? removeProject(requireWorkspaceRoot()) : removeGlobal();
        for (const s of steps) console.log(`${s.ok ? pc.green("✔") : pc.yellow("!")} ${s.what}${s.detail ? pc.dim(`  ${s.detail}`) : ""}`);
        return;
      }
      const steps: SetupStep[] = [];
      if (opts.project) {
        steps.push(...installProjectSkills(requireWorkspaceRoot(), { mcp: opts.mcp }));
      } else {
        steps.push(...installGlobalSkills(opts.agent ?? []));
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
            : `${opts.agent ? "" : "\nAn agent that keeps its own skills folder (Trae, Junie, Kiro, Windsurf…) gets them with `ided setup --agent <name>`."}\nAny agent that can run a shell can also use the ided CLI directly. Other MCP clients: point them at \`ided mcp\`.\nRestart your agent session to pick up the skills.`,
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
