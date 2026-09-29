// The ided viewer in a VS Code tab. It is the same viewer `ided run` serves, loaded in an
// iframe with ?embed=vscode, which turns on the bridge: ⌥-click opens a primitive's line
// here, and the editor's cursor outlines the primitives written on that line there.

import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { canonical, checkVersion, childEnv, idedPath, MissingCli, parseSrc } from "./ided.ts";

interface Server {
  url: string;
  /** Set when this extension started the server, so closing the tab stops it. */
  process?: ChildProcess;
}

export class Viewer implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private root: string | undefined;
  private server: Server | undefined;

  constructor(private readonly log: vscode.OutputChannel) {}

  get openRoot(): string | undefined {
    return this.panel ? this.root : undefined;
  }

  async open(root: string, hash = ""): Promise<void> {
    if (this.panel && this.root === root) {
      this.panel.reveal(undefined, true);
      return;
    }
    this.close();
    await checkVersion(root);
    const server = await this.serverFor(root);
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(server.url));
    const origin = `${external.scheme}://${external.authority}`;
    const panel = vscode.window.createWebviewPanel(
      "ideDesign.viewer",
      "ide-design",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(vscode.Uri.file(__dirname), "..", "icon.png");
    panel.webview.html = page(origin, `${origin}/?embed=vscode${hash}`);
    panel.webview.onDidReceiveMessage((m: { type?: string; src?: unknown }) => {
      if (m?.type === "ided:open" && typeof m.src === "string") void this.openSource(root, m.src);
    });
    panel.onDidDispose(() => {
      if (this.panel === panel) this.close();
    });
    this.panel = panel;
    this.root = root;
    this.server = server;
  }

  /** Show a frame (when its file becomes the active editor). */
  navigate(project: string, frame: string | null): void {
    void this.panel?.webview.postMessage({ type: "ided:navigate", project, frame });
  }

  /** Outline the primitives at a source line. */
  reveal(src: string): void {
    void this.panel?.webview.postMessage({ type: "ided:reveal", src });
  }

  async openSource(root: string, src: string): Promise<void> {
    const at = parseSrc(root, src);
    if (!at) return;
    const column = vscode.window.visibleTextEditors.find((e) => e.viewColumn !== this.panel?.viewColumn)?.viewColumn ?? vscode.ViewColumn.One;
    await vscode.window.showTextDocument(at.uri, { viewColumn: column, selection: new vscode.Range(at.position, at.position) });
  }

  /** A viewer already serving this workspace (say, `ided run` in a terminal), or a new one. */
  private async serverFor(root: string): Promise<Server> {
    const want = canonical(root);
    for (let port = 4800; port < 4820; port++) {
      const url = `http://127.0.0.1:${port}`;
      try {
        const res = await fetch(`${url}/api/info`, { signal: AbortSignal.timeout(400) });
        const info = (await res.json()) as { root?: string };
        if (info.root && canonical(info.root) === want) return { url };
      } catch {
        // nothing there, or not ided
      }
    }
    const bin = idedPath();
    if (!bin) throw new MissingCli("The ided command was not found.");
    this.log.appendLine(`[viewer] starting ided run in ${root}`);
    const child = spawn(bin, ["run", "--no-open"], { cwd: root, env: childEnv() });
    return new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => fail(new Error("ided run did not start within 60 seconds.")), 60_000);
      const fail = (e: Error) => {
        clearTimeout(timer);
        child.kill();
        reject(new Error(`${e.message}\n${output.trim()}`));
      };
      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        this.log.append(text);
        const url = /https?:\/\/[^\s]+/.exec(output)?.[0];
        if (url) {
          clearTimeout(timer);
          resolve({ url: url.replace(/\/$/, ""), process: child });
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.on("error", (e) => fail(e));
      child.on("exit", (code) => fail(new Error(`ided run exited with code ${code}.`)));
    });
  }

  close(): void {
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
    this.server?.process?.kill();
    this.server = undefined;
    this.root = undefined;
  }

  dispose(): void {
    this.close();
  }
}

function page(origin: string, src: string): string {
  const nonce = randomBytes(16).toString("base64");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>html, body, iframe { margin: 0; padding: 0; border: 0; width: 100%; height: 100%; overflow: hidden; background: #f4f4f2; }</style>
</head>
<body>
<iframe id="viewer" src="${src}" allow="fullscreen; clipboard-read; clipboard-write"></iframe>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const viewer = document.getElementById("viewer");
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || typeof data.type !== "string" || !data.type.startsWith("ided:")) return;
    if (e.source === viewer.contentWindow) {
      if (e.origin === ${JSON.stringify(origin)}) vscode.postMessage(data);
    } else {
      viewer.contentWindow.postMessage(data, ${JSON.stringify(origin)});
    }
  });
</script>
</body>
</html>`;
}
