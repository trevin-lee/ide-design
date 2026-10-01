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

/** Comments and replies being typed: a structure reload waits until there are none. */
export const drafts = createStore(0);
let reloadPending = false;
drafts.subscribe(() => {
  if (reloadPending && drafts.get() === 0) window.location.reload();
});

/** Marks a comment or reply with text in it as a draft while `active`. */
export function useDraft(active: boolean) {
  useEffect(() => {
    if (!active) return;
    drafts.set((n) => n + 1);
    return () => drafts.set((n) => n - 1);
  }, [active]);
}

/** On a narrow window the side panel is a drawer, opened from the toolbar. */
export const panelOpen = createStore(false);

/** How many pages each frame (`project/frame`) lays out to: 1, or more for a flowing page. */
export const pageCounts = createStore<Record<string, number>>({});

export function setPageCount(key: string, n: number) {
  if ((pageCounts.get()[key] ?? 1) !== n) pageCounts.set((all) => ({ ...all, [key]: n }));
}

export function pagesOf(counts: Record<string, number>, project: string, frame: string): number {
  return counts[`${project}/${frame}`] ?? 1;
}

/** Measurements (page counts, thread ends, layout) still waiting for fonts, images or layout. */
export let pendingMeasures = 0;
export function measuring(delta: 1 | -1) {
  pendingMeasures += delta;
}

/** How many <Thread> boxes of each story every frame (`project/frame`) holds. */
export const threadCounts = createStore<Record<string, Record<string, number>>>({});

export function setThreadCounts(key: string, counts: Record<string, number>) {
  if (JSON.stringify(threadCounts.get()[key] ?? {}) !== JSON.stringify(counts)) threadCounts.set((all) => ({ ...all, [key]: counts }));
}

/** Where each box of a story (`project/story`) starts, as measured: index k is the k-th box. */
export const threadStarts = createStore<Record<string, string[]>>({});

export function setThreadStart(key: string, index: number, point: string) {
  const list = threadStarts.get()[key] ?? [];
  if (list[index] === point) return;
  const next = [...list];
  next[index] = point;
  threadStarts.set((all) => ({ ...all, [key]: next }));
}

/** Every page of a project in order: one per frame, several for a flowing page. */
export function pageList<F extends { id: string }>(counts: Record<string, number>, project: string, frames: readonly F[]): { frame: F; page: number; pages: number }[] {
  return frames.flatMap((frame) => {
    const pages = pagesOf(counts, project, frame.id);
    return Array.from({ length: pages }, (_, page) => ({ frame, page, pages }));
  });
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

/**
 * The route, read from the URL on every render. A store, not state copied from an event: a child
 * can change the hash (Home picks the first project) before this hook's listener is attached,
 * and the change must still show.
 */
export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (on) => {
      window.addEventListener("hashchange", on);
      return () => window.removeEventListener("hashchange", on);
    },
    () => window.location.hash,
  );
  return parseRoute(hash);
}

/** The projects sidebar: remembered per browser; it starts closed in a narrow window (a VS Code column). */
export const sidebarOpen = createStore<boolean>(
  (() => {
    try {
      const saved = localStorage.getItem("ided.sidebar");
      if (saved !== null) return saved === "open";
    } catch {
      // storage unavailable
    }
    return window.innerWidth >= 760;
  })(),
);
sidebarOpen.subscribe(() => {
  try {
    localStorage.setItem("ided.sidebar", sidebarOpen.get() ? "open" : "closed");
  } catch {
    // storage unavailable
  }
});

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
    if (window.location.hash.startsWith("#/render/")) return;
    // Files were added, renamed or deleted (often by an agent mid-review): reload, but never
    // under someone typing a comment or a reply.
    if (drafts.get() === 0) return window.location.reload();
    reloadPending = true;
    showToast("Files changed. The viewer refreshes when you finish your comment.", "info");
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
