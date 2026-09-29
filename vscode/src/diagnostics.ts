// `ided check` results in the Problems panel. Type errors in files open in an editor are left
// to VS Code's own TypeScript (it reads design/tsconfig.json), which reports them as you type.

import { join } from "node:path";
import * as vscode from "vscode";
import { explain, run } from "./ided.ts";

interface CheckIssue {
  file: string;
  line?: number;
  column?: number;
  rule: string;
  message: string;
  hint?: string;
  severity: "error" | "warning";
  source: string;
}

export class Checker implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("ided");
  private readonly status = vscode.window.createStatusBarItem("ideDesign.check", vscode.StatusBarAlignment.Left, 10);
  private readonly results = new Map<string, CheckIssue[]>();
  private readonly published = new Map<string, vscode.Uri[]>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<string>();
  private readonly again = new Set<string>();
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(private readonly log: vscode.OutputChannel) {
    this.status.name = "ide-design check";
    this.status.command = "workbench.actions.view.problems";
    // Whether a file is open decides who reports its type errors.
    this.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(() => this.republish()),
      vscode.workspace.onDidCloseTextDocument(() => this.republish()),
    );
  }

  schedule(root: string, delay = 400): void {
    clearTimeout(this.timers.get(root));
    this.timers.set(root, setTimeout(() => void this.check(root), delay));
  }

  async check(root: string): Promise<void> {
    if (this.running.has(root)) {
      this.again.add(root);
      return;
    }
    this.running.add(root);
    this.showStatus();
    try {
      const r = await run(root, ["check", "--json"]);
      const start = r.stdout.indexOf("{");
      if (start < 0) throw new Error(r.stderr.trim() || `ided check exited with ${r.code} and no result.`);
      const result = JSON.parse(r.stdout.slice(start)) as { issues: CheckIssue[] };
      this.results.set(root, result.issues);
      this.publish(root);
    } catch (e) {
      this.log.appendLine(`[check] ${root}: ${(e as Error).message}`);
      explain(e);
    } finally {
      this.running.delete(root);
      this.showStatus();
      if (this.again.delete(root)) this.schedule(root, 0);
    }
  }

  private republish(): void {
    for (const root of this.results.keys()) this.publish(root);
  }

  private publish(root: string): void {
    for (const uri of this.published.get(root) ?? []) this.collection.delete(uri);
    const open = new Map(vscode.workspace.textDocuments.map((d) => [d.uri.fsPath, d]));
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const i of this.results.get(root) ?? []) {
      const file = join(root, i.file);
      if (i.source === "types" && open.has(file)) continue;
      const line = Math.max(0, (i.line ?? 1) - 1);
      const column = Math.max(0, (i.column ?? 1) - 1);
      // Underline from the reported column to the end of its line when the text is at hand.
      const doc = open.get(file);
      const end = doc && line < doc.lineCount ? doc.lineAt(line).range.end.character : column + 1;
      const d = new vscode.Diagnostic(
        new vscode.Range(line, column, line, Math.max(column, end)),
        i.hint ? `${i.message}\n→ ${i.hint}` : i.message,
        i.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
      );
      d.source = "ided";
      d.code = i.rule;
      const list = byFile.get(file) ?? [];
      list.push(d);
      byFile.set(file, list);
    }
    const uris: vscode.Uri[] = [];
    for (const [file, list] of byFile) {
      const uri = vscode.Uri.file(file);
      this.collection.set(uri, list);
      uris.push(uri);
    }
    this.published.set(root, uris);
    this.showStatus();
  }

  private showStatus(): void {
    if (this.running.size) {
      this.status.text = "$(sync~spin) ided check";
      this.status.tooltip = "Running ided check";
    } else {
      const all = [...this.results.values()].flat();
      const errors = all.filter((i) => i.severity === "error").length;
      const warnings = all.length - errors;
      this.status.text = errors || warnings ? `$(error) ${errors} $(warning) ${warnings} ided` : "$(check) ided";
      this.status.tooltip = errors || warnings ? "ided check found issues (see Problems)" : "ided check: clean";
    }
    this.status.show();
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    for (const s of this.subscriptions) s.dispose();
    this.collection.dispose();
    this.status.dispose();
  }
}
