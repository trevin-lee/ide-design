import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { brand, loaders, type WsFrame, type WsProject } from "virtual:ided/workspace";
import { FlowPageContext, ThreadContext, type ThreadEnv, type Violation } from "../runtime/context.ts";
import { decodePoint, encodePoint, markThread, measureThread, STORY_START } from "../runtime/story.ts";
import { Collector, FrameHost, missingRootViolation } from "../runtime/host.tsx";
import { bodySize, measureLayout } from "../runtime/layout.ts";
import type { FrameKind } from "../shared/formats.ts";
import { measuring, pageCounts, pagesOf, publishViolations, revision, setPageCount, setThreadCounts, setThreadStart, threadCounts, threadStarts, useStore } from "./store.ts";

type FrameModule = { default?: unknown };
const moduleCache = new Map<string, Promise<FrameModule>>();

export function loadFrame(project: string, frame: string): Promise<FrameModule> {
  const key = `${project}/${frame}`;
  let p = moduleCache.get(key);
  if (!p) {
    const loader = loaders[key];
    p = loader ? loader() : Promise.reject(new Error(`No loader for ${key}`));
    moduleCache.set(key, p);
    p.catch(() => moduleCache.delete(key));
  }
  return p;
}

export function useFrameComponent(project: string, frame: string): { Component: ComponentType | null; error: Error | null } {
  const [state, setState] = useState<{ key: string; Component: ComponentType | null; error: Error | null }>({ key: "", Component: null, error: null });
  const key = `${project}/${frame}`;
  useEffect(() => {
    let alive = true;
    loadFrame(project, frame).then(
      (mod) => {
        if (!alive) return;
        if (typeof mod.default !== "function") setState({ key, Component: null, error: new Error(`${frame}.tsx must \`export default function\` a component.`) });
        else setState({ key, Component: mod.default as ComponentType, error: null });
      },
      (error: Error) => alive && setState({ key, Component: null, error }),
    );
    return () => {
      alive = false;
    };
  }, [project, frame, key]);
  return state.key === key ? state : { Component: null, error: null };
}

/**
 * Renders one page of a frame at native size (`page` > 0 only for a flowing page). The first
 * page publishes the frame's violations after commit, counts the pages a flowing page lays out
 * to, and adds the layout check's findings once fonts and images have settled (unless `measure`
 * is false).
 */
export function FrameRender(props: { project: WsProject; frame: WsFrame; index: number; page?: number; viewport?: string; publish?: boolean; measure?: boolean }) {
  const { project, frame, index } = props;
  const page = props.page ?? 0;
  const rev = useStore(revision);
  const counts = useStore(pageCounts);
  // Page numbers count every page of the document, flowing pages included.
  const before = project.frames.slice(0, index).reduce((n, f) => n + pagesOf(counts, project.id, f.id), 0);
  const total = project.frames.reduce((n, f) => n + pagesOf(counts, project.id, f.id), 0);
  const flow = useMemo(() => ({ page }), [page]);
  const threads = useThreadEnv(project, index);
  const { Component, error } = useFrameComponent(project.id, frame.id);
  // A responsive web screen renders once per viewport; the widest is the primary one.
  const variant = variantOf(project, props.viewport);
  const geometry = variant ? { ...project.geometry!, width: variant.width, height: variant.height } : project.geometry!;
  const primary = !variant || variant.name === project.geometry!.viewports![0]!.name;
  const sink = useMemo(() => new Collector(), [rev, Component]);
  const key = violationKey(project.id, frame.id, primary ? undefined : variant?.name);
  const host = useRef<HTMLDivElement>(null);
  const first = page === 0 && props.publish !== false;
  const settle = useAfterRender(host, geometry.width, project, key, { publish: first, count: page === 0 && primary, measure: first && props.measure !== false });
  if (error) {
    return <FrameError geometry={geometry} title={frame.src} message={error.message} />;
  }
  if (!Component) return <div style={{ width: geometry.width, height: geometry.height }} />;
  return (
    <FrameHost
      key={rev}
      kind={project.kind as FrameKind}
      project={project.id}
      file={frame.src}
      geometry={geometry}
      index={before + page}
      total={total}
      sink={sink}
      viewport={variant?.name}
      onRendered={(hasRoot) => {
        const list = sink.list();
        if (!hasRoot && !list.some((v) => v.rule === "render-error")) list.push(missingRootViolation(project.kind as FrameKind, frame.src));
        settle(list);
      }}
    >
      <FlowPageContext.Provider value={flow}>
        <ThreadContext.Provider value={threads}>
          <div ref={host} style={{ display: "contents" }}>
            <Component />
          </div>
        </ThreadContext.Provider>
      </FlowPageContext.Provider>
    </FrameHost>
  );
}

/** The viewport of a responsive web screen to render (the widest when none is named); null for other projects. */
export function variantOf(project: WsProject, viewport?: string): { name: "desktop" | "tablet" | "mobile"; width: number; height: number } | null {
  const all = project.geometry?.viewports;
  if (!all?.length) return null;
  return all.find((v) => v.name === viewport) ?? all[0]!;
}

/** Violations are kept per frame, and per viewport for a responsive screen's narrower viewports. */
export function violationKey(project: string, frame: string, viewport?: string): string {
  return `${project}/${frame}${viewport ? `@${viewport}` : ""}`;
}

/** Where this frame's thread boxes sit in their stories, from what the other frames measured. */
function useThreadEnv(project: WsProject, index: number): ThreadEnv {
  const counts = useStore(threadCounts);
  const starts = useStore(threadStarts);
  return useMemo(() => {
    const boxes = (frames: readonly WsFrame[], story: string) => frames.reduce((n, f) => n + (counts[`${project.id}/${f.id}`]?.[story] ?? 0), 0);
    return {
      index: (story, local) => boxes(project.frames.slice(0, index), story) + local,
      start: (story, k) => (k === 0 ? STORY_START : (decodePoint(starts[`${project.id}/${story}`]?.[k]) ?? null)),
      isLast: (story, k) => k === boxes(project.frames, story) - 1,
    };
  }, [counts, starts, project, index]);
}

/**
 * Returns a function to call after each render. It publishes the render's violations together
 * with the last layout findings (so a re-render does not drop them); then, once fonts and images
 * are in, it counts a flowing page's pages and measures the layout, publishing only what changed.
 * A newer render cancels work still waiting.
 */
function useAfterRender(
  host: React.RefObject<HTMLDivElement | null>,
  width: number,
  project: WsProject,
  key: string,
  opts: { publish: boolean; count: boolean; measure: boolean },
): (list: Violation[]) => void {
  const latest = useRef(0);
  const layout = useRef<Violation[]>([]);
  useEffect(() => () => void (latest.current = -1), []);
  return (list) => {
    if (opts.publish) publishViolations(key, [...list, ...layout.current]);
    if (!opts.count && !opts.measure) return;
    const ticket = ++latest.current;
    measuring(1);
    void (async () => {
      await document.fonts.ready;
      const images = [...(host.current?.querySelectorAll("img") ?? [])].filter((i) => !i.complete);
      await Promise.all(images.map((i) => new Promise((r) => (i.addEventListener("load", r, { once: true }), i.addEventListener("error", r, { once: true })))));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (ticket !== latest.current || !host.current) return;
      if (opts.count) {
        const flow = host.current.querySelector<HTMLElement>("[data-ided-flow]");
        const step = Number(flow?.dataset.idedFlowStep);
        setPageCount(key, flow && step ? Math.max(1, Math.round((flow.scrollWidth + step - flow.clientWidth) / step)) : 1);
        // Threads: how many boxes of each story this frame holds, and where each box's text ends.
        const perStory: Record<string, number> = {};
        const root = host.current.querySelector<HTMLElement>(".ided-root");
        const scale = root ? root.getBoundingClientRect().width / width || 1 : 1;
        for (const box of host.current.querySelectorAll<HTMLElement>("[data-ided-thread]")) {
          const story = box.dataset.idedThread!;
          perStory[story] = (perStory[story] ?? 0) + 1;
          if (!box.dataset.idedThreadStart) continue; // the boxes before it are still being measured
          const { end, tooLarge, visible } = measureThread(box, scale);
          markThread(box, end, tooLarge, visible, scale);
          setThreadStart(`${project.id}/${story}`, Number(box.dataset.idedThreadIndex) + 1, encodePoint(end));
        }
        setThreadCounts(key, perStory);
      }
      const root = host.current.querySelector<HTMLElement>(".ided-root");
      if (!opts.measure || !root || !brand) return;
      const found = measureLayout(root, { width, bodySize: bodySize(brand.type) });
      if (JSON.stringify(found) === JSON.stringify(layout.current)) return;
      layout.current = found;
      publishViolations(key, [...list, ...found]);
    })().finally(() => measuring(-1));
  };
}

/**
 * Renders a project's other frames offscreen, so thread boxes on the frame in view know where
 * their story starts. Mounted only while the project has threads, or has not been measured yet.
 */
export function ThreadMeasurer(props: { project: WsProject; except?: string }) {
  const { project } = props;
  const counts = useStore(threadCounts);
  const known = project.frames.every((f) => counts[`${project.id}/${f.id}`] !== undefined);
  const threaded = project.frames.some((f) => Object.keys(counts[`${project.id}/${f.id}`] ?? {}).length > 0);
  if (!project.geometry || (known && !threaded)) return null;
  const g = project.geometry;
  return (
    <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, visibility: "hidden", pointerEvents: "none" }}>
      {project.frames
        .filter((f) => f.id !== props.except)
        .map((f) => (
          <div key={f.id} style={{ width: g.width, ...(g.fixedHeight ? { height: g.height } : {}) }}>
            <FrameRender project={project} frame={f} index={project.frames.indexOf(f)} publish={false} />
          </div>
        ))}
    </div>
  );
}

function FrameError(props: { geometry: { width: number; height: number }; title: string; message: string }) {
  return (
    <div className="frame-error" style={{ width: props.geometry.width, height: props.geometry.height }}>
      <div className="frame-error-title">{props.title}</div>
      <pre>{props.message}</pre>
    </div>
  );
}

/** Scales a native-size frame to a target CSS width. */
export function Scaled(props: { width: number; height: number; scale: number; children: ReactNode; className?: string; overlay?: ReactNode }) {
  return (
    <div className={props.className} style={{ width: props.width * props.scale, height: props.height * props.scale, position: "relative" }}>
      <div style={{ width: props.width, height: props.height, transform: `scale(${props.scale})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0, ["--ided-scale" as string]: props.scale }}>
        {props.children}
      </div>
      {props.overlay}
    </div>
  );
}

/** Measures an element's content box. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect;
      setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** The rendered height of a frame (web screens grow with content). */
export function useFrameHeight(ref: React.RefObject<HTMLElement | null>, fallback: number): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const root = el.querySelector(".ided-root") as HTMLElement | null;
      setH(root ? root.offsetHeight : fallback);
    });
    ro.observe(el);
    const root = el.querySelector(".ided-root");
    if (root) ro.observe(root);
    const mo = new MutationObserver(() => {
      const r = el.querySelector(".ided-root");
      if (r) ro.observe(r);
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref, fallback]);
  return h;
}
