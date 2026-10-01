import { useState } from "react";
import { projects, type WsProject } from "virtual:ided/workspace";
import { showToast } from "./store.ts";
import { imageItem, useLightbox } from "./zoom.tsx";

function pascal(slug: string): string {
  return slug.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
}

/** Import names for an asset: `team-offsite.jpg` → `teamOffsite`. */
function camel(file: string): string {
  const base = file.split("/").pop()!.replace(/\.[a-z0-9]+$/, "");
  const p = pascal(base);
  const name = p.charAt(0).toLowerCase() + p.slice(1);
  return /^[0-9]/.test(name) ? `asset${p}` : name;
}

function CopyLine(props: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-line"
      title="Copy import"
      onClick={() => {
        void navigator.clipboard.writeText(props.code).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => showToast("Clipboard unavailable", "error"),
        );
      }}
    >
      <code>{props.code}</code>
      <span>{copied ? "copied" : "copy"}</span>
    </button>
  );
}

export function AssetGrid(props: { project: WsProject; exclude?: string[] }) {
  const assets = props.project.assets.filter((a) => !props.exclude?.includes(a.path));
  const lightbox = useLightbox();
  const open = async (i: number) => lightbox.open(await Promise.all(assets.map((a) => imageItem(a.url, a.path))), i);
  if (assets.length === 0) {
    return (
      <p className="lib-empty">
        No assets. Drop images into <code>design/{props.project.id}/assets/</code> (kebab-case names; png, jpg, webp, avif, gif, svg).
      </p>
    );
  }
  return (
    <div className="lib-assets">
      {assets.map((a, i) => (
        <figure key={a.path} className="lib-asset">
          <button className="lib-thumb" onClick={() => void open(i)} title="Open large (zoom and pan)">
            <img src={a.url} alt={a.path} loading="lazy" />
          </button>
          <figcaption>
            <strong>{a.path}</strong>
            <CopyLine code={`import ${camel(a.path)} from "@${props.project.id}/assets/${a.path}";`} />
          </figcaption>
        </figure>
      ))}
      {lightbox.element}
    </div>
  );
}

function ProjectLinks(props: { ids: string[]; empty: string }) {
  if (!props.ids.length) return <span className="lib-muted">{props.empty}</span>;
  return (
    <>
      {props.ids.map((id) => {
        const p = projects.find((x) => x.id === id);
        return (
          <a key={id} className="lib-chip" href={`#/p/${id}`}>
            {p?.title ?? id}
          </a>
        );
      })}
    </>
  );
}

/** A package's components with the line that imports each one. */
export function ComponentList(props: { project: WsProject }) {
  const p = props.project;
  if (p.components.length === 0) return <p className="lib-empty">No components yet.</p>;
  return (
    <div className="lib-components">
      {p.components.map((c) => {
        const slug = c.replace(/^components\//, "").replace(/\.tsx$/, "");
        return (
          <div key={c} className="lib-component">
            <strong>{pascal(slug)}</strong>
            <CopyLine code={`import { ${pascal(slug)} } from "@${p.id}/components/${slug}";`} />
          </div>
        );
      })}
    </div>
  );
}

export function LibraryBoard(props: { project: WsProject }) {
  const p = props.project;
  return (
    <div className="canvas brand-canvas">
      <div className="brand-board">
        <section className="bb-section">
          <header className="bb-section-head">
            <h2>{p.title}</h2>
            <p>
              A library shares components and assets between projects. Projects opt in with <code>ided use &lt;project&gt; {p.id}</code>.
            </p>
          </header>
          <div className="lib-meta">
            <div>
              <span className="lib-label">Used by</span>
              <ProjectLinks ids={p.dependents} empty="No project uses this library yet." />
            </div>
            <div>
              <span className="lib-label">Depends on</span>
              <ProjectLinks ids={["brand", ...p.dependencies]} empty="" />
            </div>
          </div>
        </section>

        <section className="bb-section">
          <header className="bb-section-head">
            <h2>Components</h2>
            <p>Named exports in components/. Add one with <code>ided add {p.id} &lt;name&gt;</code>.</p>
          </header>
          <ComponentList project={p} />
        </section>

        <section className="bb-section">
          <header className="bb-section-head">
            <h2>Assets</h2>
            <p>Imported by path, so a missing file is a type error.</p>
          </header>
          <AssetGrid project={p} />
        </section>
      </div>
    </div>
  );
}
