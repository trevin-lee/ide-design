// The bridge to a code editor that embeds the viewer (the VS Code extension loads it in an
// iframe with ?embed=vscode). Outward: open a primitive's source line. Inward: follow the
// editor's cursor by outlining the primitives written on that line. Standalone, it does nothing.

import { go } from "./store.ts";

export const embedded = new URLSearchParams(window.location.search).get("embed") === "vscode";

/** Ask the editor to open `design/x/slides/01-a.tsx:12:7`. */
export function openSource(src: string | null | undefined): boolean {
  if (!embedded || !src) return false;
  window.parent.postMessage({ type: "ided:open", src }, "*");
  return true;
}

function parse(src: string): { file: string; line: number } | null {
  const m = /^(.*?):(\d+)(?::\d+)?$/.exec(src);
  return m ? { file: m[1]!, line: Number(m[2]) } : null;
}

/** Outline the primitives written closest above `line` in `file`, and bring the first into view. */
function reveal(file: string, line: number) {
  for (const el of document.querySelectorAll(".ided-reveal")) el.classList.remove("ided-reveal");
  let best = -1;
  const hits: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(".frame-surface [data-ided-src]")) {
    const at = parse(el.dataset.idedSrc!);
    if (!at || at.file !== file || at.line > line || at.line < best) continue;
    if (at.line > best) hits.length = 0;
    best = at.line;
    hits.push(el);
  }
  for (const el of hits) el.classList.add("ided-reveal");
  hits[0]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

interface Inbound {
  type: string;
  src?: string;
  project?: string;
  frame?: string | null;
}

if (embedded) {
  document.documentElement.classList.add("embedded");
  window.addEventListener("message", (e: MessageEvent<Inbound>) => {
    if (e.source !== window.parent || typeof e.data?.type !== "string") return;
    if (e.data.type === "ided:navigate" && e.data.project) {
      const target = `#/p/${encodeURIComponent(e.data.project)}${e.data.frame ? `/${encodeURIComponent(e.data.frame)}` : ""}`;
      if (!window.location.hash.startsWith(target)) go(target);
    }
    if (e.data.type === "ided:reveal" && e.data.src) {
      const at = parse(e.data.src);
      // After a navigation the frames render on the next frame; reveal once they exist.
      if (at) requestAnimationFrame(() => requestAnimationFrame(() => reveal(at.file, at.line)));
    }
  });
  // ⌥-click (Alt-click) any primitive in a frame to open its line.
  window.addEventListener(
    "click",
    (e) => {
      if (!e.altKey || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(".frame-surface [data-ided-src]");
      if (el && openSource(el.dataset.idedSrc)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
}
