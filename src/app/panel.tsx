import { useEffect, useMemo, useState } from "react";
import { brand, svgs, workspace, type WsProject } from "virtual:ided/workspace";
import { validateBrand } from "../shared/brand-schema.ts";
import { isFrameKind } from "../shared/formats.ts";
import { DesignDocView } from "./design-doc.tsx";
import { openSource } from "./editor.ts";
import { LAYOUT_RULES } from "../runtime/layout.ts";
import {
  activeComment,
  comments as commentsStore,
  go,
  patchComment,
  removeComment,
  showToast,
  staticIssues,
  useStore,
  violations as violationStore,
  type Comment,
} from "./store.ts";

export interface PanelIssue {
  severity: "error" | "warning";
  message: string;
  where: string | null;
  hint?: string;
  frame?: string;
  source: "structure" | "runtime" | "layout" | "brand" | "types" | "lint" | "assets";
}

export function useProjectIssues(project: WsProject): PanelIssue[] {
  const all = useStore(violationStore);
  const checked = useStore(staticIssues);
  return useMemo(() => {
    const out: PanelIssue[] = [];
    // Design-doc and comment issues change as those files are edited, so they come from the live check below instead.
    for (const i of [...workspace.issues, ...project.issues].filter((x) => x.rule !== "design-doc" && x.rule !== "comments")) {
      out.push({ severity: i.severity, message: i.message, where: i.file, hint: i.hint, source: "structure" });
    }
    for (const i of checked.filter((c) => c.project === project.id)) {
      out.push({ severity: i.severity, message: i.message, where: i.where, hint: i.hint, source: i.source, frame: project.frames.find((f) => i.where?.startsWith(f.src))?.id });
    }
    if (project.kind === "brand" && brand) {
      for (const i of validateBrand(brand, svgs)) out.push({ severity: i.severity, message: i.message, where: `brand.ts › ${i.path}`, source: "brand" });
    }
    for (const f of project.frames) {
      for (const v of all[`${project.id}/${f.id}`] ?? []) {
        out.push({ severity: v.severity, message: v.message, where: v.src ?? f.src, hint: v.hint, frame: f.id, source: (LAYOUT_RULES as readonly string[]).includes(v.rule) ? "layout" : "runtime" });
      }
    }
    // Same rule as `ided check`: a type error restating a runtime finding on the same line is noise.
    const lineOf = (w: string | null) => w?.split(":").slice(0, 2).join(":") ?? "";
    const runtimeLines = new Set(out.filter((i) => i.source === "runtime" || i.source === "lint").map((i) => lineOf(i.where)));
    const seen = new Set<string>();
    return out
      .filter((i) => !(i.source === "types" && runtimeLines.has(lineOf(i.where))))
      .filter((i) => {
        const k = `${i.message}|${i.where}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  }, [all, checked, project]);
}

export function SidePanel(props: { project: WsProject }) {
  const { project } = props;
  const issues = useProjectIssues(project);
  const comments = useStore(commentsStore).filter((c) => c.project === project.id);
  const open = comments.filter((c) => c.status === "open");
  // Comments are left on frames, so the brand and libraries have none.
  const commentable = isFrameKind(project.kind);
  // Open comments are the active conversation; otherwise lead with why the design looks the way it does.
  const [chosen, setTab] = useState<"design" | "comments" | "issues">(() => (open.length ? "comments" : "design"));
  const tab = chosen === "comments" && !commentable ? "design" : chosen;
  const resolved = comments.filter((c) => c.status === "resolved");
  const [showResolved, setShowResolved] = useState(false);
  const active = useStore(activeComment);
  const errors = issues.filter((i) => i.severity === "error").length;

  useEffect(() => {
    if (active) setTab("comments");
  }, [active]);

  return (
    <aside className="panel">
      <div className="tabs">
        <button className={tab === "design" ? "on" : ""} onClick={() => setTab("design")}>
          Design
        </button>
        {commentable && (
          <button className={tab === "comments" ? "on" : ""} onClick={() => setTab("comments")}>
            Comments <span className="count">{open.length}</span>
          </button>
        )}
        <button className={tab === "issues" ? "on" : ""} onClick={() => setTab("issues")}>
          Issues <span className={`count${errors ? " count-error" : ""}`}>{issues.length}</span>
        </button>
      </div>
      {tab === "design" ? (
        <div className="panel-body">
          <DesignDocView project={project.id} />
        </div>
      ) : tab === "comments" ? (
        <div className="panel-body">
          {open.length === 0 && (
            <div className="panel-empty">
              <p>No open comments.</p>
              <p>
                Press <kbd>C</kbd>, then click any element to leave a note on its line of code.
              </p>
            </div>
          )}
          {open.map((c, i) => (
            <CommentCard key={c.id} c={c} n={i + 1} project={project} active={active === c.id} />
          ))}
          {resolved.length > 0 && (
            <button className="linkish" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? "Hide" : "Show"} {resolved.length} resolved
            </button>
          )}
          {showResolved && resolved.map((c) => <CommentCard key={c.id} c={c} n={null} project={project} active={active === c.id} />)}
        </div>
      ) : (
        <div className="panel-body">
          {issues.length === 0 && (
            <div className="panel-empty">
              <p>Clean. No structure, type, lint or render issues.</p>
            </div>
          )}
          {issues.map((i, k) => (
            <div
              key={k}
              className={`issue issue-${i.severity}`}
              onClick={() => {
                if (i.frame) go(`#/p/${project.id}/${i.frame}`);
                openSource(i.where);
              }}
            >
              <div className="issue-head">
                <span className="dot" />
                <span className="issue-source">{i.source}</span>
                {i.where && <span className="issue-where">{shortSrc(i.where)}</span>}
              </div>
              <div className="issue-msg">{i.message}</div>
              {i.hint && <div className="issue-hint">{i.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function shortSrc(src: string): string {
  return src.replace(/^design\/[^/]+\//, "");
}

function CommentCard(props: { c: Comment; n: number | null; project: WsProject; active: boolean }) {
  const { c, project } = props;
  const [reply, setReply] = useState("");
  const frame = project.frames.find((f) => f.id === c.frame);
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };
  return (
    <div
      className={`comment${props.active ? " active" : ""}${c.status === "resolved" ? " resolved" : ""}`}
      onClick={() => {
        activeComment.set(c.id);
        if (c.frame) go(`#/p/${project.id}/${c.frame}`, true);
      }}
    >
      <div className="comment-head">
        {props.n !== null && <span className="pin static">{props.n}</span>}
        <span className="comment-where">
          {frame ? `${String(frame.number).padStart(2, "0")} ${frame.title}` : "Project"}
          {c.target?.primitive && <span className="tag">{c.target.primitive}</span>}
        </span>
      </div>
      {c.target?.text && <div className="comment-quote">{c.target.text}</div>}
      <div className="comment-body">{c.body}</div>
      {c.replies.map((r, i) => (
        <div key={i} className="comment-reply">
          <span className="comment-author">{r.author}</span> {r.body}
        </div>
      ))}
      {c.target?.src && (
        <div className="comment-src" onClick={() => openSource(c.target?.src)}>
          {shortSrc(c.target.src)}
        </div>
      )}
      {props.active && (
        <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
          <input
            value={reply}
            placeholder="Reply"
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && reply.trim()) {
                void act(async () => {
                  await patchComment(c.id, { reply: { body: reply } });
                  setReply("");
                });
              }
            }}
          />
          <div className="row">
            {c.status === "open" ? (
              <button className="btn" onClick={() => void act(() => patchComment(c.id, { status: "resolved" }))}>
                Resolve
              </button>
            ) : (
              <button className="btn" onClick={() => void act(() => patchComment(c.id, { status: "open" }))}>
                Reopen
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void act(() => removeComment(c.id))}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
