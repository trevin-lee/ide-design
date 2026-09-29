// Runs inside the test VS Code (see run.mjs).
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vscode = require("vscode");

async function waitFor(what, fn, ms = 120_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

exports.run = function run() {
  // Fail rather than hang if something waits on a person.
  return Promise.race([suite(), new Promise((_, reject) => setTimeout(() => reject(new Error("The suite took over 5 minutes.")), 300_000))]);
};

async function suite() {
  const root = process.env.IDED_FIXTURE;
  const api = await vscode.extensions.getExtension("trevin-lee.ide-design").activate();
  const slide = vscode.Uri.file(join(root, "design/d/slides/01-title.tsx"));
  const commentsFile = join(root, "design/d/comments.json");
  const stored = () => JSON.parse(readFileSync(commentsFile, "utf8")).comments[0];

  // ided check in Problems
  const diagnostics = await waitFor("ided diagnostics", () => {
    const list = vscode.languages.getDiagnostics(slide).filter((d) => d.source === "ided");
    return list.length ? list : null;
  });
  const raw = diagnostics.find((d) => d.range.start.line === 5 && /16px/.test(d.message));
  assert.ok(raw, JSON.stringify(diagnostics.map((d) => [d.code, d.range.start.line, d.message])));
  assert.match(raw.message, /→ /, "the fix travels with the message");

  // Review comments as threads, with reply and resolve
  const [thread] = await waitFor("comment threads", () => (api.comments.threadsOf(root).length ? api.comments.threadsOf(root) : null));
  assert.equal(thread.uri.fsPath, slide.fsPath);
  assert.equal(thread.range.start.line, 6);
  assert.equal(thread.comments[0].author.name, "user");
  await vscode.commands.executeCommand("ideDesign.reply", { thread, text: "On it." });
  assert.deepEqual(stored().replies.map((r) => [r.author, r.body]), [["user", "On it."]]);
  assert.equal(api.comments.threadsOf(root)[0].comments.length, 2);
  await vscode.commands.executeCommand("ideDesign.resolve", { thread: api.comments.threadsOf(root)[0], text: "Now it names the offer." });
  assert.equal(stored().status, "resolved");
  assert.equal(api.comments.threadsOf(root).length, 0, "resolved comments leave the editor");

  // The viewer, and a jump from the viewer to a source line
  await vscode.window.showTextDocument(slide);
  await vscode.commands.executeCommand("ideDesign.openViewer");
  assert.equal(api.viewer.openRoot, root);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await api.viewer.openSource(root, "design/d/slides/01-title.tsx:7:9");
  const editor = vscode.window.activeTextEditor;
  assert.equal(editor.document.uri.fsPath, slide.fsPath);
  assert.deepEqual([editor.selection.active.line, editor.selection.active.character], [6, 8]);
  await api.viewer.openSource(root, "../outside.tsx:1");
  assert.equal(vscode.window.activeTextEditor.document.uri.fsPath, slide.fsPath, "paths outside the workspace are ignored");
  api.viewer.close();
}
