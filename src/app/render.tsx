import { useEffect, useState } from "react";
import { brand, type WsProject } from "virtual:ided/workspace";
import type { Violation } from "../runtime/context.ts";
import { bodySize, measureLayout } from "../runtime/layout.ts";
import { FrameRender, loadFrame } from "./frame.tsx";
import { pageCounts, pageList, useStore, violations } from "./store.ts";

declare global {
  interface Window {
    __IDED_READY__?: boolean;
    __IDED_ERROR__?: string;
    __IDED_VIOLATIONS__?: unknown;
    /** Measures every rendered frame's layout (used by `ided check`). */
    __IDED_LAYOUT__?: () => { frame: string; violations: Violation[] }[];
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
  const pages = pageList(counts, project.id, frames);

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
      // Flowing pages report how many pages they need after their own fonts settle, and each new
      // page then renders: wait until the page count stops changing.
      for (let last = "", i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 60));
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const now = JSON.stringify(pageCounts.get());
        if (now === last) break;
        last = now;
      }
      if (cancelled) return;
      window.__IDED_VIOLATIONS__ = violations.get();
      window.__IDED_LAYOUT__ = () =>
        [...document.querySelectorAll<HTMLElement>("[data-ided-frame][data-ided-page='0']")].map((el) => {
          const root = el.querySelector<HTMLElement>(".ided-root");
          return { frame: el.dataset.idedFrame!, violations: root && brand ? measureLayout(root, { width: g.width, bodySize: bodySize(brand.type) }) : [] };
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
          pages.map(({ frame: f, page, pages: n }) => (
            <figure key={`${f.id}/${page}`} className="render-sheet-item">
              <div className="render-frame" style={{ width: g.width, ...(g.fixedHeight ? { height: g.height } : {}), zoom: scale }}>
                <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} page={page} />
              </div>
              <figcaption>
                {String(f.number).padStart(2, "0")} {f.title}
                {n > 1 && ` · ${page + 1}/${n}`}
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
        pages.map(({ frame: f, page }) => (
          <div
            key={`${f.id}/${page}`}
            data-ided-frame={f.id}
            data-ided-page={page}
            className="render-frame"
            style={{ width: g.width, ...(g.fixedHeight ? { height: g.height } : {}), zoom, breakAfter: print ? "page" : undefined }}
          >
            <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} page={page} measure={false} />
          </div>
        ))}
    </div>
  );
}
