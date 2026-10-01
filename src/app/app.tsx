import { useEffect, useRef, useState } from "react";
import { brand, brandAssetBase, projects, svgs, workspace, type WsProject } from "virtual:ided/workspace";
import { BrandProvider } from "../runtime/host.tsx";
import { FRAME_NOUN, isFrameKind } from "../shared/formats.ts";
import { BrandBoard } from "./brand-board.tsx";
import { ProjectCanvas } from "./canvas.tsx";
import { embedded } from "./editor.ts";
import { LibraryBoard } from "./library.tsx";
import { SidePanel, useProjectIssues } from "./panel.tsx";
import { enterPresentation, Presentation } from "./present.tsx";
import { RenderRoute } from "./render.tsx";
import {
  activeComment,
  commentMode,
  comments as commentsStore,
  go,
  pageCounts,
  pageList,
  pagesOf,
  panelOpen,
  refreshComments,
  refreshStaticIssues,
  showToast,
  sidebarOpen,
  toast as toastStore,
  useRoute,
  useStore,
} from "./store.ts";

const brandAssetUrl = (p: string) => brandAssetBase + p;
const FALLBACK_BRAND = {
  name: "",
  unit: 4,
  color: {},
  space: {},
  radius: {},
  stroke: {},
  font: {},
  type: {},
  margin: { deck: "", doc: "", graphic: "", web: "" },
  logo: { mark: "", wordmark: "", lockups: {}, colorways: {}, sizes: {} },
};

export function App() {
  const route = useRoute();
  useEffect(() => {
    if (route.name !== "render") {
      void refreshComments();
      refreshStaticIssues();
    }
  }, [route.name]);

  let body: React.ReactNode;
  if (route.name === "render") {
    const p = projects.find((x) => x.id === route.project);
    body = p ? <RenderRoute project={p} frames={route.frames} print={route.print} sheet={route.sheet} /> : <RenderMissing id={route.project} />;
  } else if (route.name === "present") {
    const p = projects.find((x) => x.id === route.project);
    body = p?.geometry ? <Presentation project={p} index={route.index} /> : <Shell project={null} frame={null} />;
  } else if (route.name === "project") {
    const p = projects.find((x) => x.id === route.project) ?? null;
    body = <Shell project={p} frame={route.frame} missing={p ? undefined : route.project} />;
  } else {
    body = <Home />;
  }
  return (
    <BrandProvider brand={brand ?? FALLBACK_BRAND} svgs={svgs} brandAssetUrl={brandAssetUrl}>
      {body}
    </BrandProvider>
  );
}

function RenderMissing(props: { id: string }) {
  useEffect(() => {
    window.__IDED_ERROR__ = `No project "${props.id}"`;
    window.__IDED_READY__ = true;
  }, [props.id]);
  return null;
}

function Home() {
  useEffect(() => {
    const first = projects.find((p) => isFrameKind(p.kind)) ?? projects[0];
    if (first) go(`#/p/${first.id}`, true);
  }, []);
  return <Shell project={null} frame={null} />;
}

const KIND_LABEL: Record<string, string> = { brand: "Brand", library: "Lib", deck: "Deck", doc: "Doc", graphic: "Graphic", web: "Web" };

function Sidebar(props: { current: string | null }) {
  const all = useStore(commentsStore);
  const groups: { title: string; items: WsProject[] }[] = [
    { title: "Brand", items: projects.filter((p) => p.kind === "brand") },
    { title: "Libraries", items: projects.filter((p) => p.kind === "library") },
    { title: "Projects", items: projects.filter((p) => isFrameKind(p.kind)) },
  ];
  return (
    <nav className="sidebar">
      <div className="sidebar-head">
        <span className="logo-glyph" aria-hidden>
          <svg viewBox="0 0 100 100" width="18" height="18">
            <path
              fillRule="evenodd"
              fill="currentColor"
              d="M30 0H70A30 30 0 0 1 100 30V70A30 30 0 0 1 70 100H30A30 30 0 0 1 0 70V30A30 30 0 0 1 30 0ZM54 30A16 16 0 1 0 86 30A16 16 0 1 0 54 30Z"
            />
          </svg>
        </span>
        <div className="sidebar-ws">
          <strong>{workspace.name}</strong>
          <span>{brand?.name ?? "no brand"}</span>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="sidebar-group">
          <div className="sidebar-label">{g.title}</div>
          {g.items.length === 0 && (
            <div className="sidebar-none">{g.title === "Brand" ? "Missing design/brand" : g.title === "Libraries" ? "ided new library <name>" : "ided new deck <name>"}</div>
          )}
          {g.items.map((p) => (
            <SidebarItem key={p.id} project={p} current={props.current === p.id} open={all.filter((c) => c.project === p.id && c.status === "open").length} badge={g.title === "Projects"} />
          ))}
        </div>
      ))}
      <div className="sidebar-foot">
        <code>ided check</code> · <code>ided export</code>
      </div>
    </nav>
  );
}

function ExportMenu(props: { project: WsProject; frame: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const run = async (query: string, label: string) => {
    setOpen(false);
    setBusy(true);
    showToast(`Exporting ${label}…`, "info", 0);
    try {
      const res = await fetch(`/api/export?project=${props.project.id}&${query}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(`Saved ${name}`);
    } catch (e) {
      showToast((e as Error).message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };
  const isWeb = props.project.kind === "web";
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn" disabled={busy} onClick={() => setOpen(!open)} title="Export">
        <Icon name="export" />
        <span className="btn-label">{busy ? "Exporting…" : "Export"}</span>
      </button>
      {open && (
        <div className="menu">
          {!isWeb && <button onClick={() => void run("format=pdf", "PDF")}>PDF</button>}
          <button onClick={() => void run("format=png", "PNGs")}>PNG · all frames</button>
          {props.frame && <button onClick={() => void run(`format=png&frames=${props.frame}`, "PNG")}>PNG · this frame</button>}
          <button onClick={() => void run("format=jpeg", "JPEGs")}>JPEG · all frames</button>
        </div>
      )}
    </div>
  );
}

/** Small line icons for toolbar buttons, which show only their icon when the viewer is narrow. */
const ICONS: Record<string, string> = {
  sidebar: "M2.5 3.5h11v9h-11zM6 3.5v9",
  panel: "M2.5 3.5h11v9h-11zM10 3.5v9",
  comment: "M3 3.5h10v7H7l-3 2.5v-2.5H3z",
  present: "M5 3.5v9l7.5-4.5z",
  export: "M8 2.5v7M5 6.5l3 3 3-3M3 11v2.5h10V11",
};

function Icon(props: { name: keyof typeof ICONS }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d={ICONS[props.name]} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BrandKitButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-primary"
      disabled={busy}
      title="Download brand kit"
      onClick={async () => {
        setBusy(true);
        showToast("Building brand kit…", "info", 0);
        try {
          const res = await fetch("/api/brand-kit");
          if (!res.ok) throw new Error((await res.json()).error);
          const blob = await res.blob();
          const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "brand-kit.zip";
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();
          URL.revokeObjectURL(a.href);
          showToast(`Saved ${name}`);
        } catch (e) {
          showToast((e as Error).message, "error", 8000);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="export" />
      <span className="btn-label">{busy ? "Building…" : "Download brand kit"}</span>
    </button>
  );
}

/** One project in the sidebar, with the same error count its toolbar and Issues tab show. */
function SidebarItem(props: { project: WsProject; current: boolean; open: number; badge: boolean }) {
  const p = props.project;
  const errors = useProjectIssues(p).filter((i) => i.severity === "error").length;
  return (
    <a href={`#/p/${p.id}`} className={`sidebar-item${props.current ? " on" : ""}`}>
      {/* The group heading already names the brand and libraries; only projects mix kinds. */}
      {props.badge && <span className={`kind kind-${p.kind}`}>{KIND_LABEL[p.kind]}</span>}
      <span className="sidebar-title" title={p.title}>
        {p.title}
      </span>
      {errors > 0 && (
        <span className="pill pill-error" title={`${errors} error${errors > 1 ? "s" : ""}`}>
          {errors}
        </span>
      )}
      {props.open > 0 && <span className="pill pill-comment">{props.open}</span>}
      {isFrameKind(p.kind) && <span className="sidebar-count">{p.frames.length}</span>}
    </a>
  );
}

/** The presentation index (counted in pages) of a frame's first page. */
function firstPage(project: WsProject, frameIndex: number): number {
  const counts = pageCounts.get();
  return project.frames.slice(0, frameIndex).reduce((n, f) => n + pagesOf(counts, project.id, f.id), 0);
}

function Toolbar(props: { project: WsProject; frame: string | null }) {
  const { project, frame } = props;
  const mode = useStore(commentMode);
  const drawer = useStore(panelOpen);
  const sidebar = useStore(sidebarOpen);
  const issues = useProjectIssues(project);
  const errors = issues.filter((i) => i.severity === "error").length;
  const g = project.geometry;
  const focused = frame ? project.frames.find((f) => f.id === frame) : null;
  const frameIndex = focused ? project.frames.indexOf(focused) : 0;
  // A flowing page prints as several pages, so pages are counted, not page files.
  const pages = pageList(useStore(pageCounts), project.id, project.frames).length;
  return (
    <header className="toolbar">
      <button className={`btn btn-icon sidebar-toggle${sidebar ? "" : " btn-on"}`} onClick={() => sidebarOpen.set(!sidebar)} title={`${sidebar ? "Hide" : "Show"} projects ([)`}>
        <Icon name="sidebar" />
      </button>
      <div className="toolbar-title">
        {focused ? (
          <>
            <a href={`#/p/${project.id}`} className="crumb toolbar-name">
              {project.title}
            </a>
            <span className="crumb-sep">/</span>
            <span className="toolbar-name">{focused.title}</span>
          </>
        ) : (
          <span className="toolbar-name">{project.title}</span>
        )}
        <span className="toolbar-meta">
          {project.kind === "brand"
            ? "design/brand/brand.ts"
            : isFrameKind(project.kind)
              ? `${pages} ${FRAME_NOUN[project.kind]}${pages === 1 ? "" : "s"}${pages !== project.frames.length ? ` from ${project.frames.length} file${project.frames.length === 1 ? "" : "s"}` : ""}`
              : `${project.components.length} components · ${project.assets.length} assets`}
          {g && isFrameKind(project.kind) && ` · ${g.width}×${g.fixedHeight ? g.height : "auto"}`}
          {project.dependencies.length > 0 && ` · uses ${project.dependencies.join(", ")}`}
          {embedded && isFrameKind(project.kind) && " · ⌥-click opens the code"}
        </span>
        {/* Outside the details line, which hides when the toolbar is narrow. */}
        {errors > 0 && <span className="pill pill-error">{errors} error{errors > 1 ? "s" : ""}</span>}
      </div>
      <div className="toolbar-actions">
        <button className={`btn panel-toggle${drawer ? " btn-on" : ""}`} onClick={() => panelOpen.set(!drawer)} title="Design, comments and issues">
          <Icon name="panel" />
          <span className="btn-label">Panel</span>
        </button>
        {project.kind === "brand" ? (
          <BrandKitButton />
        ) : !isFrameKind(project.kind) ? null : (
          <>
            <button className={`btn${mode ? " btn-on" : ""}`} onClick={() => commentMode.set(!mode)} title="Comment mode (C)">
              <Icon name="comment" />
              <span className="btn-label">{mode ? "Commenting" : "Comment"}</span> <kbd>C</kbd>
            </button>
            <button className="btn" onClick={() => enterPresentation(project.id, firstPage(project, frameIndex))} disabled={!project.frames.length} title="Present (P)">
              <Icon name="present" />
              <span className="btn-label">Present</span> <kbd>P</kbd>
            </button>
            <ExportMenu project={project} frame={frame} />
          </>
        )}
      </div>
    </header>
  );
}

function Shell(props: { project: WsProject | null; frame: string | null; missing?: string }) {
  const { project, frame, missing } = props;
  const toast = useStore(toastStore);
  const drawerOpen = useStore(panelOpen);
  const sidebar = useStore(sidebarOpen);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[") return sidebarOpen.set(!sidebarOpen.get());
      if (!project || !isFrameKind(project.kind)) return;
      if (e.key === "c") commentMode.set(!commentMode.get());
      else if (e.key === "p" && project.frames.length) {
        const i = frame ? Math.max(0, project.frames.findIndex((f) => f.id === frame)) : 0;
        enterPresentation(project.id, firstPage(project, i));
      } else if (e.key === "Escape" && commentMode.get()) {
        commentMode.set(false);
        activeComment.set(null);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [project, frame]);

  return (
    <div className={`shell${drawerOpen ? " panel-open" : ""}${sidebar ? "" : " sidebar-closed"}`}>
      <Sidebar current={project?.id ?? null} />
      <main className="main">
        {project ? (
          <>
            <Toolbar project={project} frame={frame} />
            <div className="stage">
              {project.kind === "brand" ? (
                <BrandBoard project={project} />
              ) : project.kind === "library" ? (
                <LibraryBoard project={project} />
              ) : (
                <ProjectCanvas project={project} focus={frame} />
              )}
              <SidePanel project={project} />
            </div>
          </>
        ) : (
          <div className="canvas empty-state">
            <div>
              <p className="empty-title">{missing ? `No project "${missing}"` : projects.length ? "Pick a project" : "No projects yet"}</p>
              <p className="empty-body">
                <code>ided new deck launch</code>
              </p>
            </div>
          </div>
        )}
      </main>
      {toast && <div className={`toast toast-${toast.tone}`}>{toast.text}</div>}
    </div>
  );
}
