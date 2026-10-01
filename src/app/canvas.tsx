import { useEffect, useRef, useState } from "react";
import type { WsFrame, WsProject } from "virtual:ided/workspace";
import { openSource } from "./editor.ts";
import { FrameRender, Scaled, ThreadMeasurer, useFrameHeight, useSize, variantOf, violationKey } from "./frame.tsx";
import {
  activeComment,
  commentMode,
  comments as commentsStore,
  createComment,
  go,
  pageCounts,
  pageList,
  pagesOf,
  showToast,
  useDraft,
  useStore,
  violations as violationStore,
  type Comment,
  type CommentTarget,
} from "./store.ts";

export function ProjectCanvas(props: { project: WsProject; focus: string | null }) {
  const { project, focus } = props;
  const counts = useStore(pageCounts);
  const [ref, size] = useSize<HTMLDivElement>();
  const focusIndex = focus ? project.frames.findIndex((f) => f.id === focus) : -1;

  useEffect(() => {
    if (focusIndex < 0) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const next = project.frames[Math.min(project.frames.length - 1, focusIndex + 1)]!;
        go(`#/p/${project.id}/${next.id}`, true);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const prev = project.frames[Math.max(0, focusIndex - 1)]!;
        go(`#/p/${project.id}/${prev.id}`, true);
        e.preventDefault();
      } else if (e.key === "Escape" && !commentMode.get()) {
        go(`#/p/${project.id}`);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [project, focusIndex]);

  if (!project.geometry) return null;
  if (project.frames.length === 0) {
    return (
      <div className="canvas empty-state">
        <div>
          <p className="empty-title">No frames yet</p>
          <p className="empty-body">
            <code>ided add {project.id} &lt;name&gt;</code>
          </p>
        </div>
      </div>
    );
  }

  // useSize reports the content box, so the canvas padding is already excluded.
  const g = project.geometry;
  // A responsive web screen: each frame's viewports side by side, all at one scale, so the
  // narrow ones look as narrow as they are.
  const variants = g.viewports && g.viewports.length > 1 ? g.viewports : null;
  if (variants) {
    const gap = 32;
    const inner = Math.max(200, size.width);
    const scale = (inner - gap * (variants.length - 1)) / variants.reduce((n, v) => n + v.width, 0);
    const frames = focusIndex >= 0 ? [project.frames[focusIndex]!] : project.frames;
    return (
      <div className="canvas" ref={ref}>
        {size.width > 0 &&
          frames.map((f) => (
            <div key={f.id} className="variant-row" style={{ gap }}>
              {variants.map((v) => (
                <FrameCard key={v.name} project={project} frame={f} index={project.frames.indexOf(f)} viewport={v.name} scale={scale} focused={focusIndex >= 0} />
              ))}
            </div>
          ))}
      </div>
    );
  }
  if (focusIndex >= 0) {
    const frame = project.frames[focusIndex]!;
    const availW = Math.max(200, size.width);
    const availH = Math.max(200, size.height - 36);
    const scale = g.fixedHeight ? Math.min(availW / g.width, availH / g.height) : availW / g.width;
    const pages = pagesOf(counts, project.id, frame.id);
    return (
      <div className={`canvas canvas-focus${pages > 1 ? " canvas-pages" : ""}`} ref={ref}>
        {size.width > 0 &&
          Array.from({ length: pages }, (_, page) => (
            <FrameCard key={page} project={project} frame={frame} index={focusIndex} page={page} pages={pages} scale={scale} focused />
          ))}
        <ThreadMeasurer project={project} except={frame.id} />
      </div>
    );
  }

  const minCard = g.width >= g.height ? 420 : 300;
  const inner = Math.max(200, size.width);
  const gap = 32;
  const cols = Math.max(1, Math.floor((inner + gap) / (minCard + gap)));
  const cardW = (inner - gap * (cols - 1)) / cols;
  const scale = cardW / g.width;
  return (
    <div className="canvas" ref={ref}>
      {size.width > 0 && (
        <div className="frame-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap }}>
          {pageList(counts, project.id, project.frames).map(({ frame: f, page, pages }) => (
            <FrameCard key={`${f.id}/${page}`} project={project} frame={f} index={project.frames.indexOf(f)} page={page} pages={pages} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One page of a frame: a frame is one card, a flowing page one card per page. */
function FrameCard(props: { project: WsProject; frame: WsFrame; index: number; page?: number; pages?: number; viewport?: string; scale: number; focused?: boolean }) {
  const { project, frame, index, scale } = props;
  const page = props.page ?? 0;
  const pages = props.pages ?? 1;
  const variant = variantOf(project, props.viewport);
  const g = variant ? { ...project.geometry!, width: variant.width, height: variant.height } : project.geometry!;
  const primary = !variant || variant.name === project.geometry!.viewports![0]!.name;
  const hostRef = useRef<HTMLDivElement>(null);
  const height = useFrameHeight(hostRef, g.height);
  const all = useStore(violationStore);
  const issues = all[violationKey(project.id, frame.id, primary ? undefined : variant?.name)] ?? [];
  const errors = issues.filter((v) => v.severity === "error").length;
  const warnings = issues.length - errors;
  const mode = useStore(commentMode);
  const openCount = useStore(commentsStore).filter(
    (c) => c.project === project.id && c.frame === frame.id && (c.target?.page ?? 0) === page && c.target?.viewport === (primary ? undefined : variant?.name) && c.status === "open",
  ).length;
  return (
    <figure className={`frame-card${props.focused ? " focused" : ""}`}>
      <div
        className="frame-surface"
        ref={hostRef}
        onClick={() => {
          if (!props.focused && !mode) go(`#/p/${project.id}/${frame.id}`);
        }}
      >
        <Scaled
          width={g.width}
          height={height}
          scale={scale}
          overlay={<CommentLayer project={project} frame={frame} page={page} viewport={primary ? undefined : variant?.name} scale={scale} hostRef={hostRef} />}
        >
          <FrameRender project={project} frame={frame} index={index} page={page} viewport={variant?.name} />
        </Scaled>
      </div>
      <figcaption>
        <span className="frame-num">{String(frame.number).padStart(2, "0")}</span>
        <span className="frame-title">
          {frame.title}
          {pages > 1 && <span className="frame-page">{` ${page + 1}/${pages}`}</span>}
          {variant && project.geometry!.viewports!.length > 1 && <span className="frame-page">{` ${variant.name}`}</span>}
        </span>
        <span className="frame-meta">
          {openCount > 0 && <span className="pill pill-comment">{openCount}</span>}
          {/* A frame's issues belong to the frame, shown once on its first page. */}
          {page === 0 && errors > 0 && <span className="pill pill-error">{errors} error{errors > 1 ? "s" : ""}</span>}
          {page === 0 && warnings > 0 && <span className="pill pill-warn">{warnings}</span>}
          {props.focused && (
            <span className="frame-file" onClick={() => openSource(frame.src)}>
              {frame.src}
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Commenting: pick a primitive, attach a note to its source location.
// ---------------------------------------------------------------------------

interface Hover {
  el: HTMLElement;
  rect: { x: number; y: number; width: number; height: number };
}

function describe(el: HTMLElement, root: HTMLElement, scale: number): CommentTarget {
  const ancestors: string[] = [];
  let p = el.parentElement?.closest<HTMLElement>("[data-ided-src]") ?? null;
  while (p && root.contains(p) && ancestors.length < 6) {
    const s = p.dataset.idedSrc;
    if (s && !ancestors.includes(s)) ancestors.push(s);
    p = p.parentElement?.closest<HTMLElement>("[data-ided-src]") ?? null;
  }
  const r = el.getBoundingClientRect();
  const fr = (root.querySelector(".ided-root") ?? root).getBoundingClientRect();
  const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  return {
    src: el.dataset.idedSrc ?? null,
    primitive: el.dataset.ided ?? null,
    ancestors,
    text: text.length > 120 ? text.slice(0, 117) + "…" : text,
    rect: {
      x: Math.round((r.left - fr.left) / scale),
      y: Math.round((r.top - fr.top) / scale),
      width: Math.round(r.width / scale),
      height: Math.round(r.height / scale),
    },
  };
}

function CommentLayer(props: { project: WsProject; frame: WsFrame; page: number; viewport?: "desktop" | "tablet" | "mobile"; scale: number; hostRef: React.RefObject<HTMLDivElement | null> }) {
  const { project, frame, page, viewport, scale, hostRef } = props;
  const mode = useStore(commentMode);
  const all = useStore(commentsStore);
  const active = useStore(activeComment);
  const layerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [draft, setDraft] = useState<{ target: CommentTarget | null; x: number; y: number } | null>(null);

  const projectComments = all.filter((c) => c.project === project.id && c.status === "open");
  const pins = projectComments.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => c.frame === frame.id && (c.target?.page ?? 0) === page && c.target?.viewport === viewport);

  const pick = (e: React.MouseEvent): Hover | null => {
    const host = hostRef.current;
    const layer = layerRef.current;
    if (!host || !layer) return null;
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    const el = stack.find((n): n is HTMLElement => n instanceof HTMLElement && host.contains(n) && !!n.dataset.idedSrc && !layer.contains(n));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    return { el, rect: { x: r.left - lr.left, y: r.top - lr.top, width: r.width, height: r.height } };
  };

  return (
    <div
      ref={layerRef}
      className={`comment-layer${mode ? " active" : ""}`}
      onMouseMove={(e) => mode && !draft && setHover(pick(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        if (!mode || draft) return;
        e.stopPropagation();
        const h = pick(e);
        const lr = layerRef.current!.getBoundingClientRect();
        const target = h ? describe(h.el, hostRef.current!, scale) : null;
        setDraft({ target: target ? { ...target, ...(page > 0 ? { page } : {}), ...(viewport ? { viewport } : {}) } : target, x: e.clientX - lr.left, y: e.clientY - lr.top });
      }}
    >
      {mode && hover && !draft && (
        <div className="hover-box" style={{ left: hover.rect.x, top: hover.rect.y, width: hover.rect.width, height: hover.rect.height }}>
          <span className="hover-label">{hover.el.dataset.ided}</span>
        </div>
      )}
      {pins.map(({ c, n }) => (
        <Pin key={c.id} comment={c} n={n} scale={scale} active={active === c.id} />
      ))}
      {draft && (
        <Composer
          x={draft.x}
          y={draft.y}
          target={draft.target}
          onCancel={() => setDraft(null)}
          onSave={async (body) => {
            try {
              const c = await createComment({ project: project.id, frame: frame.id, target: draft.target, body });
              activeComment.set(c.id);
              setDraft(null);
            } catch (err) {
              showToast((err as Error).message, "error");
            }
          }}
        />
      )}
    </div>
  );
}

function Pin(props: { comment: Comment; n: number; scale: number; active: boolean }) {
  const r = props.comment.target?.rect;
  const x = r ? r.x * props.scale : 8;
  const y = r ? r.y * props.scale : 8;
  return (
    <>
      {props.active && r && <div className="pin-box" style={{ left: x, top: y, width: r.width * props.scale, height: r.height * props.scale }} />}
      <button
        className={`pin${props.active ? " active" : ""}`}
        style={{ left: x, top: y }}
        title={props.comment.body}
        onClick={(e) => {
          e.stopPropagation();
          activeComment.set(props.active ? null : props.comment.id);
        }}
      >
        {props.n}
      </button>
    </>
  );
}

function Composer(props: { x: number; y: number; target: CommentTarget | null; onCancel(): void; onSave(body: string): Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Keep the box inside the visible canvas, clear of the side panel on the right-most cards.
  const [shift, setShift] = useState(0);
  useEffect(() => {
    ref.current?.focus();
    const r = box.current?.getBoundingClientRect();
    const edge = box.current?.closest(".canvas")?.getBoundingClientRect().right;
    if (r && edge && r.right > edge - 12) setShift(r.right - edge + 12);
  }, []);
  useDraft(body.trim() !== "");
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    await props.onSave(body);
    setBusy(false);
  };
  return (
    <div ref={box} className="composer" style={{ left: props.x - shift, top: props.y }} onClick={(e) => e.stopPropagation()} onMouseMove={(e) => e.stopPropagation()}>
      <div className="composer-target">
        {props.target?.primitive ? (
          <>
            <span className="tag">{props.target.primitive}</span>
            <span className="composer-src">{props.target.src?.split("/").slice(-2).join("/")}</span>
          </>
        ) : (
          <span className="composer-src">Whole frame</span>
        )}
      </div>
      <textarea
        ref={ref}
        value={body}
        placeholder="What should change?"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          if (e.key === "Escape") props.onCancel();
          e.stopPropagation();
        }}
      />
      <div className="composer-actions">
        <span className="kbd-hint">⌘↵</span>
        <button className="btn btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!body.trim() || busy} onClick={() => void submit()}>
          Comment
        </button>
      </div>
    </div>
  );
}
