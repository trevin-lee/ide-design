import { useEffect, useRef, useState } from "react";
import type { WsProject } from "virtual:ided/workspace";
import { FrameRender, loadFrame, Scaled, ThreadMeasurer, useFrameHeight, useSize } from "./frame.tsx";
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
  // A responsive web screen presents one viewport at a time; V switches.
  const viewports = project.geometry?.viewports ?? [];
  const [vp, setVp] = useState(0);

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
      else if (e.key === "v" && viewports.length > 1) setVp((i) => (i + 1) % viewports.length);
      else if (e.key === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, index, count, viewports.length]);

  const variant = viewports[vp];
  const g = variant ? { ...project.geometry!, width: variant.width, height: variant.height } : project.geometry!;
  const entry = pages[index];
  // Fixed frames fit the screen; a web screen fits its width and scrolls, since it grows with its content.
  const scale = size.width && size.height ? (g.fixedHeight ? Math.min(size.width / g.width, size.height / g.height) : Math.min(1, size.width / g.width)) : 0;
  const frameHeight = useFrameHeight(ref, g.height);
  return (
    <div
      className={`present${idle ? " idle" : ""}${g.fixedHeight ? "" : " present-scroll"}`}
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
        <Scaled width={g.width} height={g.fixedHeight ? g.height : frameHeight} scale={scale}>
          <FrameRender project={project} frame={entry.frame} index={project.frames.indexOf(entry.frame)} page={entry.page} viewport={variant?.name} publish={false} />
        </Scaled>
      )}
      <ThreadMeasurer project={project} except={entry?.frame.id} />
      <div className="present-hud">
        {index + 1} / {count}
        {variant && viewports.length > 1 ? ` · ${variant.name} (V to switch)` : ""} · ← → to move · Esc to exit
      </div>
    </div>
  );
}
