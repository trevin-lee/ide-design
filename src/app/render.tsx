import { useEffect, useState } from "react";
import type { WsProject } from "virtual:ided/workspace";
import { FrameRender, loadFrame } from "./frame.tsx";
import { violations } from "./store.ts";

declare global {
  interface Window {
    __IDED_READY__?: boolean;
    __IDED_ERROR__?: string;
    __IDED_VIOLATIONS__?: unknown;
  }
}

/** Export route: frames at exact size, no UI. Headless Chrome prints or screenshots this. */
export function RenderRoute(props: { project: WsProject; frames: string[] | null; print: boolean }) {
  const { project, print } = props;
  const frames = props.frames ? project.frames.filter((f) => props.frames!.includes(f.id)) : project.frames;
  const [loaded, setLoaded] = useState(false);
  const g = project.geometry!;

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
      if (cancelled) return;
      window.__IDED_VIOLATIONS__ = violations.get();
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
  return (
    <div className="render-root">
      {print && <style>{`@page { size: ${pageW} ${pageH}; margin: 0; } html, body { margin: 0; padding: 0; background: none; }`}</style>}
      {loaded &&
        frames.map((f) => (
          <div
            key={f.id}
            data-ided-frame={f.id}
            className="render-frame"
            style={{ width: g.width, ...(g.fixedHeight ? { height: g.height } : {}), zoom, breakAfter: print ? "page" : undefined }}
          >
            <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} />
          </div>
        ))}
    </div>
  );
}
