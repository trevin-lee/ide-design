import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { loaders, type WsFrame, type WsProject } from "virtual:ided/workspace";
import { Collector, FrameHost, missingRootViolation } from "../runtime/host.tsx";
import type { FrameKind } from "../shared/formats.ts";
import { publishViolations, revision, useStore } from "./store.ts";

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

/** Renders one frame at native size. Violations are published after commit. */
export function FrameRender(props: { project: WsProject; frame: WsFrame; index: number; publish?: boolean }) {
  const { project, frame, index } = props;
  const rev = useStore(revision);
  const { Component, error } = useFrameComponent(project.id, frame.id);
  const geometry = project.geometry!;
  const sink = useMemo(() => new Collector(), [rev, Component]);
  const key = `${project.id}/${frame.id}`;
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
      index={index}
      total={project.frames.length}
      sink={sink}
      onRendered={(hasRoot) => {
        if (props.publish === false) return;
        const list = sink.list();
        if (!hasRoot && !list.some((v) => v.rule === "render-error")) list.push(missingRootViolation(project.kind as FrameKind, frame.src));
        publishViolations(key, list);
      }}
    >
      <Component />
    </FrameHost>
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
