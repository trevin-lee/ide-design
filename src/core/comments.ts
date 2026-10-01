// Review comments live next to the artifacts in design/<project>/comments.json,
// so they are versioned with the design and readable by any agent.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commentPlace } from "../shared/comment-place.ts";
import { getProject, type Workspace } from "./workspace.ts";

export interface CommentTarget {
  /** Source location of the clicked primitive: `design/x/slides/01-a.tsx:12:7`. */
  src: string | null;
  /** Primitive name, e.g. "Text". */
  primitive: string | null;
  /** Source locations of enclosing primitives, innermost first. */
  ancestors: string[];
  /** Visible text of the element, truncated. */
  text: string;
  /** Element box in frame design px. */
  rect: { x: number; y: number; width: number; height: number } | null;
  /** For a flowing doc page: which of its pages (0-based) the element was on. Absent for the first. */
  page?: number;
  /** For a responsive web screen: which narrower viewport the element was on. Absent for the widest. */
  viewport?: "tablet" | "mobile" | "desktop";
}

export interface Reply {
  author: string;
  body: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  project: string;
  /** Frame id, e.g. `01-title`; null for project-level comments. */
  frame: string | null;
  target: CommentTarget | null;
  body: string;
  author: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  replies: Reply[];
}

interface CommentFile {
  comments: Comment[];
}

const fileFor = (ws: Workspace, project: string) => join(ws.designDir, project, "comments.json");

function load(ws: Workspace, project: string): CommentFile {
  const f = fileFor(ws, project);
  if (!existsSync(f)) return { comments: [] };
  try {
    const data = JSON.parse(readFileSync(f, "utf8")) as CommentFile;
    // A comment belongs to the folder it is stored in, even after the folder was renamed.
    return Array.isArray(data.comments) ? { comments: data.comments.map((c) => ({ ...c, project })) } : { comments: [] };
  } catch {
    return { comments: [] };
  }
}

function save(ws: Workspace, project: string, data: CommentFile) {
  writeFileSync(fileFor(ws, project), JSON.stringify(data, null, 2) + "\n");
}

export function listComments(ws: Workspace, opts: { project?: string; status?: "open" | "resolved" | "all" } = {}): Comment[] {
  const projects = opts.project ? [getProject(ws, opts.project).id] : ws.projects.map((p) => p.id);
  const status = opts.status ?? "open";
  return projects
    .flatMap((p) => load(ws, p).comments)
    .filter((c) => status === "all" || c.status === status)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function addComment(
  ws: Workspace,
  input: { project: string; frame: string | null; target: CommentTarget | null; body: string; author?: string },
): Comment {
  const target = ws.projects.find((p) => p.id === input.project);
  if (!target) throw new Error(`No project "${input.project}".`);
  // Comments are left on frames; the brand and libraries have none (and no comments.json).
  if (!target.geometry || target.kind === "brand" || target.kind === "library") {
    throw new Error(`"${input.project}" is ${target.kind === "brand" ? "the brand" : "a library"}; comments are left on the frames of decks, docs, graphics and web screens.`);
  }
  if (!input.body?.trim()) throw new Error("Comment body is empty.");
  const data = load(ws, input.project);
  const comment: Comment = {
    id: `c${randomBytes(4).toString("hex")}`,
    project: input.project,
    frame: input.frame,
    target: input.target,
    body: input.body.trim(),
    author: input.author ?? "user",
    status: "open",
    createdAt: new Date().toISOString(),
    replies: [],
  };
  data.comments.push(comment);
  save(ws, input.project, data);
  return comment;
}

function findComment(ws: Workspace, id: string): { project: string; data: CommentFile; comment: Comment } {
  for (const p of ws.projects) {
    const data = load(ws, p.id);
    const comment = data.comments.find((c) => c.id === id);
    if (comment) return { project: p.id, data, comment };
  }
  throw new Error(`No comment "${id}".`);
}

export function updateComment(
  ws: Workspace,
  id: string,
  change: { status?: "open" | "resolved"; reply?: { author?: string; body: string }; body?: string },
): Comment {
  const { project, data, comment } = findComment(ws, id);
  if (change.reply?.body?.trim()) {
    comment.replies.push({ author: change.reply.author ?? "agent", body: change.reply.body.trim(), createdAt: new Date().toISOString() });
  }
  if (change.body !== undefined && change.body.trim()) comment.body = change.body.trim();
  if (change.status && change.status !== comment.status) {
    comment.status = change.status;
    if (change.status === "resolved") comment.resolvedAt = new Date().toISOString();
    else delete comment.resolvedAt;
  }
  save(ws, project, data);
  return comment;
}

export function deleteComment(ws: Workspace, id: string) {
  const { project, data } = findComment(ws, id);
  data.comments = data.comments.filter((c) => c.id !== id);
  save(ws, project, data);
}

export function formatComment(c: Comment): string {
  const place = commentPlace(c);
  const where = `${c.target?.src ?? `design/${c.project}${c.frame ? ` (${c.frame})` : ""}`}${place ? ` (${place})` : ""}`;
  const lines = [`[${c.id}] ${c.status === "resolved" ? "(resolved) " : ""}${where}`];
  if (c.target?.primitive) lines.push(`  on <${c.target.primitive}>${c.target.text ? ` "${c.target.text}"` : ""}`);
  if (c.target?.ancestors?.length) lines.push(`  inside ${c.target.ancestors.slice(0, 3).join(" < ")}`);
  lines.push(`  ${c.author}: ${c.body}`);
  for (const r of c.replies) lines.push(`  ${r.author}: ${r.body}`);
  return lines.join("\n");
}
