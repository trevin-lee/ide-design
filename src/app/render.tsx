import { useEffect, useState } from "react";
import { brand, type WsProject } from "virtual:ided/workspace";
import type { Violation } from "../runtime/context.ts";
import { bodySize, measureLayout } from "../runtime/layout.ts";
import { FrameRender, loadFrame } from "./frame.tsx";
import { pageCounts, pageList, pendingMeasures, threadCounts, threadStarts, useStore, violations } from "./store.ts";

declare global {
  interface Window {
    __IDED_READY__?: boolean;
    __IDED_ERROR__?: string;
    __IDED_VIOLATIONS__?: unknown;
    /** Measures every rendered frame's layout (used by `ided check`). */
    __IDED_LAYOUT__?: () => { frame: string; viewport?: string; violations: Violation[] }[];
  }
}

/** Export route: frames at exact size, no UI. Headless Chrome prints or screenshots this. */
/** Contact sheets lay frames out at this width, so a whole deck fits one image. */
const SHEET_FRAME_WIDTH = 480;

export function RenderRoute(props: { project: WsProject; frames: string[] | null; print: boolean; sheet?: boolean }) {
  const { project, print } = props;
  const frames = props.frames ? project.frames.filter((f) => props.frames!.includes(f.id)) : project.frames;
  const [loaded, setLoaded] = useState(false);
  const g = project.geometry!;
  const counts = useStore(pageCounts);
  // Every page of every frame, and for a responsive web screen every viewport.
  const viewports = g.viewports && g.viewports.length > 1 ? g.viewports : [null];
  const pages = pageList(counts, project.id, frames).flatMap((p) => viewports.map((v) => ({ ...p, viewport: v })));

  useEffect(() => {
    document.documentElement.classList.add("render-mode");
    Promise.all(frames.map((f) => loadFrame(project.id, f.id)))
      .then(() => setLoaded(true))
      .catch((e: Error) => {
        window.__IDED_ERROR__ = e.message;
        window.__IDED_READY__ = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const settle = async () => {
      await document.fonts.ready;
      const imgs = [...document.images].filter((i) => !i.complete);
      await Promise.all(
        imgs.map(
          (i) =>
            new Promise((r) => {
              i.addEventListener("load", r, { once: true });
              i.addEventListener("error", r, { once: true });
            }),
        ),
      );
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Flowing pages report how many pages they need, and thread boxes where their text ends,
      // after their own fonts settle; each answer re-renders what follows: wait until they stop changing.
      for (let last = "", i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 60));
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const now = JSON.stringify([pageCounts.get(), threadCounts.get(), threadStarts.get()]);
        if (now === last && pendingMeasures === 0) break;
        last = now;
      }
      if (cancelled) return;
      window.__IDED_VIOLATIONS__ = violations.get();
      window.__IDED_LAYOUT__ = () =>
        [...document.querySelectorAll<HTMLElement>("[data-ided-frame][data-ided-page='0']")].map((el) => {
          const root = el.querySelector<HTMLElement>(".ided-root");
          const width = Number(el.dataset.idedWidth) || g.width;
          return { frame: el.dataset.idedFrame!, viewport: el.dataset.idedViewport, violations: root && brand ? measureLayout(root, { width, bodySize: bodySize(brand.type) }) : [] };
        });
      window.__IDED_READY__ = true;
    };
    void settle();
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  const pageW = print && g.print ? g.print.width : `${g.width}px`;
  const pageH = print && g.print ? g.print.height : `${g.height}px`;
  const zoom = print && g.print ? g.print.scale : 1;
  if (props.sheet) {
    const scale = Math.min(1, SHEET_FRAME_WIDTH / g.width);
    return (
      <div className="render-sheet" data-ided-sheet>
        {loaded &&
          pages.map(({ frame: f, page, pages: n, viewport: v }) => (
            <figure key={`${f.id}/${page}/${v?.name ?? ""}`} className="render-sheet-item">
              <div className="render-frame" style={{ width: v?.width ?? g.width, ...(g.fixedHeight ? { height: g.height } : {}), zoom: scale }}>
                <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} page={page} viewport={v?.name} />
              </div>
              <figcaption>
                {String(f.number).padStart(2, "0")} {f.title}
                {n > 1 && ` · ${page + 1}/${n}`}
                {v && ` · ${v.name}`}
              </figcaption>
            </figure>
          ))}
      </div>
    );
  }

  return (
    <div className="render-root">
      {print && <style>{`@page { size: ${pageW} ${pageH}; margin: 0; } html, body { margin: 0; padding: 0; background: none; }`}</style>}
      {loaded &&
        pages.map(({ frame: f, page, viewport: v }) => (
          <div
            key={`${f.id}/${page}/${v?.name ?? ""}`}
            data-ided-frame={f.id}
            data-ided-page={page}
            data-ided-viewport={v?.name}
            data-ided-width={v?.width ?? g.width}
            className="render-frame"
            style={{ width: v?.width ?? g.width, ...(g.fixedHeight ? { height: g.height } : {}), zoom, breakAfter: print ? "page" : undefined }}
          >
            <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} page={page} viewport={v?.name} measure={false} />
          </div>
        ))}
    </div>
  );
}
