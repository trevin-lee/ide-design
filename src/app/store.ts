import { useEffect, useState, useSyncExternalStore } from "react";
import type { Violation } from "../runtime/host.tsx";
import type { Comment, CommentTarget } from "../core/comments.ts";

export type { Comment, CommentTarget };

// ---------------------------------------------------------------------------
// Tiny external stores
// ---------------------------------------------------------------------------

function createStore<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      subs.forEach((s) => s());
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Runtime violations per frame key (`project/frame`). */
export const violations = createStore<Record<string, Violation[]>>({});

export function publishViolations(key: string, list: Violation[]) {
  const prev = violations.get()[key];
  const same = prev && prev.length === list.length && prev.every((v, i) => v.message === list[i]!.message && v.src === list[i]!.src);
  if (!same) violations.set((all) => ({ ...all, [key]: list }));
}

/**
 * Bumped after every HMR update so frames re-render with fresh collectors.
 * Deferred past React Refresh's own debounce, so the audit sees the new code.
 */
export const revision = createStore(0);
if (import.meta.hot) {
  let t: ReturnType<typeof setTimeout> | undefined;
  import.meta.hot.on("vite:afterUpdate", () => {
    clearTimeout(t);
    t = setTimeout(() => revision.set((n) => n + 1), 120);
  });
}

// ---------------------------------------------------------------------------
// Router (hash based, so the server stays a dumb SPA host)
// ---------------------------------------------------------------------------

export type Route =
  | { name: "home" }
  | { name: "project"; project: string; frame: string | null }
  | { name: "present"; project: string; index: number }
  | { name: "render"; project: string; frames: string[] | null; print: boolean; sheet: boolean };

export function parseRoute(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = (path ?? "").split("/").filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(query);
  if (parts[0] === "p" && parts[1]) return { name: "project", project: parts[1], frame: parts[2] ?? null };
  if (parts[0] === "present" && parts[1]) return { name: "present", project: parts[1], index: Math.max(0, Number(parts[2] ?? 0) || 0) };
  if (parts[0] === "render" && parts[1]) return { name: "render", project: parts[1], frames: q.get("frames")?.split(",") ?? null, print: q.get("print") === "1", sheet: q.get("sheet") === "1" };
  return { name: "home" };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parseRoute(hash);
}

export function go(hash: string, replace = false) {
  if (replace) window.history.replaceState(null, "", hash);
  else window.location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

// ---------------------------------------------------------------------------
// Comments API
// ---------------------------------------------------------------------------

export const comments = createStore<Comment[]>([]);

export async function refreshComments() {
  const res = await fetch("/api/comments?status=all");
  if (res.ok) comments.set(await res.json());
}

if (import.meta.hot) {
  import.meta.hot.on("ided:comments", () => {
    void refreshComments();
    refreshStaticIssues(100);
  });
  // Projects or files were added, removed or renamed. Export pages keep the snapshot they loaded.
  import.meta.hot.on("ided:structure", () => {
    if (!window.location.hash.startsWith("#/render/")) window.location.reload();
  });
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

export async function createComment(input: { project: string; frame: string | null; target: CommentTarget | null; body: string }) {
  const c = await call<Comment>("POST", "/api/comments", input);
  comments.set((all) => [...all, c]);
  return c;
}

export async function patchComment(id: string, change: { status?: "open" | "resolved"; reply?: { body: string; author?: string } }) {
  const c = await call<Comment>("PATCH", `/api/comments/${id}`, change.reply ? { ...change, reply: { author: "user", ...change.reply } } : change);
  comments.set((all) => all.map((x) => (x.id === id ? c : x)));
}

export async function removeComment(id: string) {
  await call("DELETE", `/api/comments/${id}`);
  comments.set((all) => all.filter((x) => x.id !== id));
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export const commentMode = createStore(false);
export const activeComment = createStore<string | null>(null);
export const toast = createStore<{ text: string; tone: "info" | "error" } | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, tone: "info" | "error" = "info", ms = 3200) {
  toast.set({ text, tone });
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => toast.set(null), ms);
}

// ---------------------------------------------------------------------------
// Static analysis (types + lint), recomputed by the server on every change
// ---------------------------------------------------------------------------

export interface StaticIssue {
  project: string;
  severity: "error" | "warning";
  message: string;
  where: string | null;
  hint?: string;
  source: "types" | "lint" | "structure";
}

// ---------------------------------------------------------------------------
// DESIGN.md, refetched whenever the file changes on disk
// ---------------------------------------------------------------------------

export interface DesignDoc {
  file: string;
  markdown: string | null;
}

export const designDocs = createStore<Record<string, DesignDoc>>({});

export async function refreshDesignDoc(project: string) {
  try {
    const res = await fetch(`/api/design-doc?project=${encodeURIComponent(project)}`);
    if (res.ok) {
      const doc = (await res.json()) as DesignDoc;
      designDocs.set((all) => ({ ...all, [project]: doc }));
    }
  } catch {
    // server restarting; the next change event retries
  }
}

if (import.meta.hot) {
  import.meta.hot.on("ided:design-doc", () => {
    for (const project of Object.keys(designDocs.get())) void refreshDesignDoc(project);
    refreshStaticIssues(100);
  });
}

export const staticIssues = createStore<StaticIssue[]>([]);

let checkTimer: ReturnType<typeof setTimeout> | undefined;
export function refreshStaticIssues(delay = 0) {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/check");
      if (res.ok) staticIssues.set(await res.json());
    } catch {
      // server restarting; next update retries
    }
  }, delay);
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => refreshStaticIssues(300));
}
