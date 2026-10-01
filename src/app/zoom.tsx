// Zoom and pan for looking closely: a focused frame, a brand asset or a logo. One behavior
// everywhere: ⌘/Ctrl-scroll or pinch zooms around the cursor, + − 0 1 from the keyboard, and
// dragging or scrolling pans. Fit is the default; zoom goes to 800% so single pixels show.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export const ZOOM_MAX = 8;
export const ZOOM_MIN = 0.05;
const STEPS = [0.05, 0.1, 0.125, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8];

export interface Zoom {
  /** The scale in use: the fitted one until the user zooms. */
  scale: number;
  fitted: boolean;
  /** Set an absolute scale, keeping the point at (x, y) of the scroller (default: its center) in place. */
  zoomTo(scale: number, at?: { x: number; y: number }): void;
  step(direction: 1 | -1): void;
  fit(): void;
}

/** Zoom state for a scroller whose content is laid out at `scale`. Resets to fit when `key` changes. */
export function useZoom(scroller: RefObject<HTMLElement | null>, fit: number, key: string): Zoom {
  const [zoom, setZoom] = useState<number | null>(null);
  const anchor = useRef<{ x: number; y: number; contentX: number; contentY: number } | null>(null);
  useEffect(() => setZoom(null), [key]);
  const scale = zoom ?? fit;

  // After a zoom, scroll so the anchored content point is back under the cursor.
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.contentX * scale - a.x;
    el.scrollTop = a.contentY * scale - a.y;
  }, [scale, scroller]);

  const zoomTo = (next: number, at?: { x: number; y: number }) => {
    const el = scroller.current;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (el) {
      const x = at?.x ?? el.clientWidth / 2;
      const y = at?.y ?? el.clientHeight / 2;
      anchor.current = { x, y, contentX: (el.scrollLeft + x) / scale, contentY: (el.scrollTop + y) / scale };
    }
    setZoom(clamped);
  };
  return {
    scale,
    fitted: zoom === null,
    zoomTo,
    step(direction) {
      const next = direction > 0 ? STEPS.find((s) => s > scale * 1.01) : [...STEPS].reverse().find((s) => s < scale * 0.99);
      zoomTo(next ?? (direction > 0 ? ZOOM_MAX : ZOOM_MIN));
    },
    fit: () => setZoom(null),
  };
}

/**
 * Wheel, drag and key handling for a zoomable scroller. A drag that moves pans and swallows the
 * click it ends with; a plain click (comment mode, ⌥-click to the code) still goes through.
 */
export function useZoomGestures(scroller: RefObject<HTMLElement | null>, zoom: Zoom, opts: { keys: boolean; dragPan: boolean }) {
  const latest = useRef(zoom);
  latest.current = zoom;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      // Trackpad pinch arrives as a wheel event with ctrlKey.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const z = latest.current;
      z.zoomTo(z.scale * Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (!opts.dragPan || e.button !== 0 || e.altKey) return;
      if ((e.target as HTMLElement).closest("button, a, input, textarea, .comment, .composer")) return;
      drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      el.classList.add("panning");
      el.scrollLeft = drag.left - dx;
      el.scrollTop = drag.top - dy;
    };
    const up = () => {
      if (drag?.moved) {
        // The click that ends a pan is not a click on the design.
        const swallow = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      }
      drag = null;
      el.classList.remove("panning");
    };
    const key = (e: KeyboardEvent) => {
      if (!opts.keys || (e.target as HTMLElement).closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      const z = latest.current;
      if (e.key === "+" || e.key === "=") z.step(1);
      else if (e.key === "-" || e.key === "_") z.step(-1);
      else if (e.key === "0") z.fit();
      else if (e.key === "1") z.zoomTo(1);
      else return;
      e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
  }, [scroller, opts.keys, opts.dragPan]);
}

/** The zoom controls: − level + · Fit · 1:1. */
export function ZoomBar(props: { zoom: Zoom; children?: ReactNode }) {
  const { zoom } = props;
  return (
    <div className="zoom-bar" onPointerDown={(e) => e.stopPropagation()}>
      {props.children}
      <button onClick={() => zoom.step(-1)} title="Zoom out (−)" aria-label="Zoom out">
        −
      </button>
      <span className="zoom-level" title="⌘-scroll or pinch to zoom; drag or scroll to pan">
        {Math.round(zoom.scale * 100)}%
      </span>
      <button onClick={() => zoom.step(1)} title="Zoom in (+)" aria-label="Zoom in">
        +
      </button>
      <button className={zoom.fitted ? "on" : ""} onClick={() => zoom.fit()} title="Fit (0)">
        Fit
      </button>
      <button className={!zoom.fitted && Math.abs(zoom.scale - 1) < 0.001 ? "on" : ""} onClick={() => zoom.zoomTo(1)} title="Actual size (1)">
        1:1
      </button>
    </div>
  );
}

export interface LightboxItem {
  title: string;
  /** Natural size in px, the size 1:1 shows. */
  width: number;
  height: number;
  render: (scale: number) => ReactNode;
  /** A raster: its pixels show square when zoomed in. */
  raster?: boolean;
}

/** One thing large over the page, zoomable; ← → step through its siblings, Esc closes. */
export function Lightbox(props: { items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { items, index } = props;
  const item = items[index]!;
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 800, height: 600 });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = Math.min(ZOOM_MAX, (box.width - 96) / item.width, (box.height - 96) / item.height);
  const zoom = useZoom(scroller, Math.max(ZOOM_MIN, fit), `${index}`);
  useZoomGestures(scroller, zoom, { keys: true, dragPan: true });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      else if (e.key === "ArrowRight" && index < items.length - 1) props.onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) props.onIndex(index - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", key, { capture: true });
    return () => window.removeEventListener("keydown", key, { capture: true });
  });
  return (
    <div className="lightbox" role="dialog" aria-label={item.title}>
      <div className={`lightbox-scroll${item.raster && zoom.scale >= 2 ? " lightbox-pixels" : ""}`} ref={scroller} onClick={(e) => e.target === e.currentTarget && props.onClose()}>
        <div className="lightbox-item" style={{ width: item.width * zoom.scale, height: item.height * zoom.scale }}>
          {item.render(zoom.scale)}
        </div>
      </div>
      <ZoomBar zoom={zoom}>
        <span className="zoom-title" title={item.title}>
          {item.title} · {Math.round(item.width)}×{Math.round(item.height)}
        </span>
        {items.length > 1 && (
          <>
            <button onClick={() => props.onIndex(index - 1)} disabled={index === 0} title="Previous (←)" aria-label="Previous">
              ←
            </button>
            <button onClick={() => props.onIndex(index + 1)} disabled={index === items.length - 1} title="Next (→)" aria-label="Next">
              →
            </button>
          </>
        )}
        <button onClick={props.onClose} title="Close (Esc)" aria-label="Close">
          ✕
        </button>
      </ZoomBar>
    </div>
  );
}

/** A lightbox to open from a list: `open(items, i)` shows it, `element` renders it. */
export function useLightbox(): { open: (items: LightboxItem[], index: number) => void; element: ReactNode } {
  const [state, setState] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  return {
    open: (items, index) => setState({ items, index }),
    element: state ? <Lightbox items={state.items} index={state.index} onIndex={(index) => setState({ ...state, index })} onClose={() => setState(null)} /> : null,
  };
}

/** An image file as a lightbox item, once its natural size is known (SVGs: from their viewBox). */
export async function imageItem(url: string, title: string): Promise<LightboxItem> {
  let width = 0;
  let height = 0;
  if (/\.svg(\?|$)/i.test(url)) {
    const text = await (await fetch(url)).text();
    const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
    const num = (attr: string) => parseFloat(new RegExp(`\\s${attr}\\s*=\\s*["']?([\\d.]+)`, "i").exec(tag)?.[1] ?? "");
    const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim().split(/[\s,]+/).map(Number);
    width = num("width") || vb?.[2] || 300;
    height = num("height") || vb?.[3] || 150;
  } else {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => undefined);
    width = img.naturalWidth || 300;
    height = img.naturalHeight || 150;
  }
  const raster = !/\.svg(\?|$)/i.test(url);
  return { title, width, height, raster, render: () => <img src={url} alt={title} draggable={false} style={{ width: "100%", height: "100%", display: "block" }} /> };
}
