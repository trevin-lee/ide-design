import { useEffect, useRef, useState } from "react";
import type { WsProject } from "virtual:ided/workspace";
import { FrameRender, loadFrame, Scaled, ThreadMeasurer, useSize } from "./frame.tsx";
import { go, pageCounts, pageList, useStore } from "./store.ts";

/** Present from `index`, counted in pages: a flowing doc page contributes one per page. */
export function enterPresentation(project: string, index = 0) {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  go(`#/present/${project}/${index}`);
}

export function Presentation(props: { project: WsProject; index: number }) {
  const { project } = props;
  const pages = pageList(useStore(pageCounts), project.id, project.frames);
  const count = pages.length;
  const index = Math.min(Math.max(0, props.index), Math.max(0, count - 1));
  const [ref, size] = useSize<HTMLDivElement>();
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Warm the neighbors so advancing is instant.
    for (const i of [index + 1, index - 1]) {
      const f = pages[i]?.frame;
      if (f) void loadFrame(project.id, f.id).catch(() => {});
    }
  }, [project, index]);

  useEffect(() => {
    const exit = () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      go(`#/p/${project.id}/${pages[index]?.frame.id ?? ""}`);
    };
    const to = (i: number) => go(`#/present/${project.id}/${Math.min(Math.max(0, i), count - 1)}`, true);
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n"].includes(e.key)) to(index + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p"].includes(e.key)) to(index - 1);
      else if (e.key === "Home") to(0);
      else if (e.key === "End") to(count - 1);
      else if (e.key === "Escape") exit();
      else if (e.key === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, index, count]);

  const g = project.geometry!;
  const entry = pages[index];
  const scale = size.width && size.height ? Math.min(size.width / g.width, size.height / g.height) : 0;
  return (
    <div
      className={`present${idle ? " idle" : ""}`}
      ref={ref}
      onMouseMove={() => {
        setIdle(false);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setIdle(true), 1800);
      }}
      onClick={(e) => {
        const x = e.clientX / window.innerWidth;
        go(`#/present/${project.id}/${Math.min(Math.max(0, x < 0.25 ? index - 1 : index + 1), count - 1)}`, true);
      }}
    >
      {entry && scale > 0 && (
        <Scaled width={g.width} height={g.height} scale={scale}>
          <FrameRender project={project} frame={entry.frame} index={project.frames.indexOf(entry.frame)} page={entry.page} publish={false} />
        </Scaled>
      )}
      <ThreadMeasurer project={project} except={entry?.frame.id} />
      <div className="present-hud">
        {index + 1} / {count} · ← → to move · Esc to exit
      </div>
    </div>
  );
}
