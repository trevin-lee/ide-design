// Open review comments from the viewer, shown as comment threads on the lines they point at.
// Comments are made in the viewer, where you point at the design; here you read, reply and
// resolve them next to the code. Everything goes through `ided comments`.

import { join } from "node:path";
import * as vscode from "vscode";
import { explain, parseSrc, run } from "./ided.ts";

interface Reply {
  author: string;
  body: string;
  createdAt: string;
}

interface ReviewComment {
  id: string;
  project: string;
  frame: string | null;
  target: { src: string | null; primitive: string | null; text: string; page?: number; viewport?: string } | null;
  body: string;
  author: string;
  createdAt: string;
  replies: Reply[];
}

const AUTHOR = "user";

export class Comments implements vscode.Disposable {
  private readonly controller = vscode.comments.createCommentController("ide-design", "Design review");
  private readonly threads = new Map<string, vscode.CommentThread[]>();
  private readonly owners = new WeakMap<vscode.CommentThread, { root: string; id: string }>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly log: vscode.OutputChannel) {}

  schedule(root: string, delay = 200): void {
    clearTimeout(this.timers.get(root));
    this.timers.set(root, setTimeout(() => void this.refresh(root), delay));
  }

  async refresh(root: string): Promise<void> {
    let list: ReviewComment[];
    try {
      const r = await run(root, ["comments", "list", "--json"]);
      if (r.code !== 0) throw new Error(r.stderr.trim() || "ided comments failed.");
      list = JSON.parse(r.stdout.slice(Math.max(0, r.stdout.indexOf("[")))) as ReviewComment[];
    } catch (e) {
      this.log.appendLine(`[comments] ${root}: ${(e as Error).message}`);
      explain(e);
      return;
    }
    for (const t of this.threads.get(root) ?? []) t.dispose();
    const threads: vscode.CommentThread[] = [];
    for (const c of list) {
      const at = await this.locate(root, c);
      const thread = this.controller.createCommentThread(at.uri, new vscode.Range(at.position, at.position), this.render(c));
      // Where in the design: the frame, and a later page of a flowing page or a narrower viewport.
      const place = [c.target?.page ? `page ${c.target.page + 1}` : "", c.target?.viewport ? `on ${c.target.viewport}` : ""].filter(Boolean).join(", ");
      thread.label = [c.frame ?? c.project, place, c.target?.primitive].filter(Boolean).join(" · ");
      thread.canReply = true;
      thread.state = vscode.CommentThreadState.Unresolved;
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      this.owners.set(thread, { root, id: c.id });
      threads.push(thread);
    }
    this.threads.set(root, threads);
  }

  /** The comment's line; for comments on a whole frame or project, the top of its file. */
  private async locate(root: string, c: ReviewComment): Promise<{ uri: vscode.Uri; position: vscode.Position }> {
    const at = c.target?.src ? parseSrc(root, c.target.src) : undefined;
    if (at) return at;
    if (c.frame) {
      const [file] = await vscode.workspace.findFiles(new vscode.RelativePattern(root, `design/${c.project}/*/${c.frame}.tsx`), null, 1);
      if (file) return { uri: file, position: new vscode.Position(0, 0) };
    }
    return { uri: vscode.Uri.file(join(root, "design", c.project, "DESIGN.md")), position: new vscode.Position(0, 0) };
  }

  private render(c: ReviewComment): vscode.Comment[] {
    const first = new vscode.MarkdownString(c.target?.text ? `> ${c.target.text.replace(/\n/g, " ")}\n\n${c.body}` : c.body);
    return [
      { body: first, mode: vscode.CommentMode.Preview, author: { name: c.author }, timestamp: new Date(c.createdAt) },
      ...c.replies.map((r) => ({ body: new vscode.MarkdownString(r.body), mode: vscode.CommentMode.Preview, author: { name: r.author }, timestamp: new Date(r.createdAt) })),
    ];
  }

  /** Open threads of a workspace (for tests). */
  threadsOf(root: string): readonly vscode.CommentThread[] {
    return this.threads.get(root) ?? [];
  }

  async reply(input: vscode.CommentReply): Promise<void> {
    const owner = this.owners.get(input.thread);
    if (!owner || !input.text.trim()) return;
    // "--" ends the options, so a reply that starts with "-" is text, not a flag.
    await this.act(owner.root, ["comments", "reply", owner.id, "--author", AUTHOR, "--", input.text]);
  }

  async resolve(input: vscode.CommentReply | vscode.CommentThread): Promise<void> {
    const thread = "thread" in input ? input.thread : input;
    const owner = this.owners.get(thread);
    if (!owner) return;
    const note = "text" in input ? input.text.trim() : "";
    await this.act(owner.root, ["comments", "resolve", owner.id, "--author", AUTHOR, ...(note ? [`--message=${note}`] : [])]);
  }

  private async act(root: string, args: string[]): Promise<void> {
    const r = await run(root, args).catch((e: unknown) => ({ code: 1, stdout: "", stderr: (e as Error).message }));
    if (r.code !== 0) void vscode.window.showErrorMessage(`ide-design: ${r.stderr.trim() || "the comment could not be updated."}`);
    await this.refresh(root);
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.controller.dispose();
  }
}
