// Stamps every component element in workspace files with its source location
// (`data-ided-src="design/deck/slides/01-title.tsx:12:7"`). Primitives forward
// it to the DOM, so a click in the viewer maps straight back to a line of code,
// and runtime violations report file:line like a compiler.

import MagicString from "magic-string";
import ts from "typescript";

export function injectSourceLocations(code: string, id: string, relPath: string): { code: string; map: ReturnType<MagicString["generateMap"]> } | null {
  if (!/\.tsx$/.test(id)) return null;
  const sf = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // Leave unparsable files untouched so the compiler's error shows the user's code at the right column.
  if ((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length) return null;
  const s = new MagicString(code);
  let touched = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      const first = tag.split(".").pop()![0]!;
      const already = node.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "data-ided-src");
      if (first >= "A" && first <= "Z" && !already) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        s.appendLeft(node.attributes.pos, ` data-ided-src="${relPath}:${line + 1}:${character + 1}"`);
        touched = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!touched) return null;
  return { code: s.toString(), map: s.generateMap({ hires: true, source: id }) };
}
