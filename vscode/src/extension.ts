// ide-design for VS Code: the viewer in a tab linked to the code, `ided check` in Problems,
// and review comments on the lines they point at.

import * as vscode from "vscode";
import { Comments } from "./comments.ts";
import { Checker } from "./diagnostics.ts";
import { allRoots, checkVersion, explain, forgetExplained, frameOf, relPath, rootOf } from "./ided.ts";
import { Viewer } from "./viewer.ts";

/** Returned from activate for the integration tests; not a public API. */
export interface Internals {
  checker: Checker;
  comments: Comments;
  viewer: Viewer;
}

export async function activate(context: vscode.ExtensionContext): Promise<Internals> {
  const log = vscode.window.createOutputChannel("ide-design");
  const checker = new Checker(log);
  const comments = new Comments(log);
  const viewer = new Viewer(log);
  context.subscriptions.push(log, checker, comments, viewer);

  const config = () => vscode.workspace.getConfiguration("ideDesign");
  const activeRoot = async (): Promise<string | undefined> => {
    const file = vscode.window.activeTextEditor?.document.uri;
    const fromEditor = file?.scheme === "file" ? rootOf(file.fsPath) : undefined;
    if (fromEditor) return fromEditor;
    const roots = await allRoots();
    if (roots.length <= 1) return roots[0];
    return vscode.window.showQuickPick(roots, { placeHolder: "Which ided workspace?" });
  };
  const hashFor = (root: string, editor: vscode.TextEditor | undefined): string => {
    const rel = editor ? relPath(root, editor.document.uri.fsPath) : undefined;
    const frame = rel ? frameOf(rel) : undefined;
    return frame ? `#/p/${frame.project}/${frame.frame}` : "";
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("ideDesign.openViewer", async () => {
      const root = await activeRoot();
      if (!root) return void vscode.window.showInformationMessage("ide-design: no ided workspace here. Run `ided init` to make one.");
      try {
        await viewer.open(root, hashFor(root, vscode.window.activeTextEditor));
      } catch (e) {
        log.appendLine(`[viewer] ${(e as Error).message}`);
        explain(e);
      }
    }),
    vscode.commands.registerCommand("ideDesign.check", async () => {
      const root = await activeRoot();
      if (root) await checker.check(root);
    }),
    vscode.commands.registerCommand("ideDesign.reply", (reply: vscode.CommentReply) => comments.reply(reply)),
    vscode.commands.registerCommand("ideDesign.resolve", (input: vscode.CommentReply | vscode.CommentThread) => comments.resolve(input)),
  );

  // Check on save, refresh comments when their files change.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const root = rootOf(doc.uri.fsPath);
      const rel = root ? relPath(root, doc.uri.fsPath) : undefined;
      if (root && rel?.startsWith("design/") && config().get<boolean>("checkOnSave", true)) checker.schedule(root);
    }),
  );
  const watcher = vscode.workspace.createFileSystemWatcher("**/design/*/comments.json");
  const onComments = (uri: vscode.Uri) => {
    const root = rootOf(uri.fsPath);
    if (root) comments.schedule(root);
  };
  watcher.onDidChange(onComments);
  watcher.onDidCreate(onComments);
  watcher.onDidDelete(onComments);
  context.subscriptions.push(watcher);

  // The viewer follows the editor: the active frame file's frame, and the primitives at the cursor.
  let cursorTimer: NodeJS.Timeout | undefined;
  const follow = (editor: vscode.TextEditor | undefined, navigate: boolean) => {
    const root = viewer.openRoot;
    if (!root || !editor || !config().get<boolean>("followCursor", true)) return;
    const rel = relPath(root, editor.document.uri.fsPath);
    if (!rel?.startsWith("design/") || !rel.endsWith(".tsx")) return;
    const frame = frameOf(rel);
    if (navigate && frame) viewer.navigate(frame.project, frame.frame);
    viewer.reveal(`${rel}:${editor.selection.active.line + 1}`);
  };
  const setContext = (editor: vscode.TextEditor | undefined) => {
    const file = editor?.document.uri;
    const root = file?.scheme === "file" ? rootOf(file.fsPath) : undefined;
    void vscode.commands.executeCommand("setContext", "ideDesign.designFile", !!(root && relPath(root, file!.fsPath)?.startsWith("design/")));
  };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      setContext(editor);
      follow(editor, true);
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(() => follow(e.textEditor, false), 150);
    }),
  );
  setContext(vscode.window.activeTextEditor);

  // Edits from outside VS Code (an agent in a terminal, git) refresh Problems too. ided's own
  // generated files, exports and comments are not edits.
  const designWatcher = vscode.workspace.createFileSystemWatcher("**/design/**");
  const onDesignChange = (uri: vscode.Uri) => {
    if (/[\\/]design[\\/]\.ided[\\/]|comments\.json$/.test(uri.fsPath)) return;
    const root = rootOf(uri.fsPath);
    if (root && config().get<boolean>("checkOnSave", true)) checker.schedule(root, 1500);
  };
  designWatcher.onDidChange(onDesignChange);
  designWatcher.onDidCreate(onDesignChange);
  designWatcher.onDidDelete(onDesignChange);
  context.subscriptions.push(designWatcher);

  // Start (or restart) on every workspace: at activation, when `ided init` creates one in an
  // open folder, and when the ided path setting changes.
  const started = new Set<string>();
  const start = async () => {
    const roots = await allRoots();
    if (roots[0]) await checkVersion(roots[0]).catch(explain);
    for (const root of roots) {
      started.add(root);
      void comments.refresh(root);
      if (config().get<boolean>("checkOnSave", true)) checker.schedule(root, 0);
    }
  };
  const markers = vscode.workspace.createFileSystemWatcher("**/ided.json", false, true, true);
  markers.onDidCreate((uri) => {
    const root = rootOf(uri.fsPath);
    if (root && !started.has(root)) void start();
  });
  context.subscriptions.push(
    markers,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("ideDesign.path")) return;
      forgetExplained();
      void start();
    }),
  );
  await start();
  return { checker, comments, viewer };
}

export function deactivate(): void {}
