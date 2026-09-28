import { Marked } from "marked";
import { useEffect, useMemo } from "react";
import { designDocs, refreshDesignDoc, useStore } from "./store.ts";

// Raw HTML never renders: the section prompts are HTML comments, and a design
// document is prose, not markup.
const markdown = new Marked({ gfm: true, breaks: false, renderer: { html: () => "" } });

export function DesignDocView(props: { project: string }) {
  const docs = useStore(designDocs);
  const doc = docs[props.project];
  useEffect(() => {
    void refreshDesignDoc(props.project);
  }, [props.project]);
  const html = useMemo(() => (doc?.markdown ? (markdown.parse(doc.markdown) as string) : ""), [doc?.markdown]);
  if (!doc) return <div className="panel-empty">Loading…</div>;
  if (doc.markdown === null) {
    return (
      <div className="panel-empty">
        <p>No DESIGN.md yet.</p>
        <p>Every project explains its design: who it is for, the message, the concept and the reasoning behind each decision.</p>
      </div>
    );
  }
  return (
    <div className="design-doc">
      <div className="design-doc-file">{doc.file}</div>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
