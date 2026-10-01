// How to fix a finding, for rules whose findings do not say it themselves. `ided check`, the MCP
// tools and the viewer's Issues tab all fill a missing hint from here, so every finding has one.

const HINTS: Record<string, string> = {
  brand: "Fix design/brand/brand.ts at the path shown. Every project depends on the brand, so this comes first.",
  "brand-load": "design/brand/brand.ts must load: fix the syntax or import error shown.",
  "brand-export": "Write brand.ts as the import plus `export default defineBrand({ … })`, values only.",
  logo: "Fix the logo files in design/brand/assets/; `ided check brand` says what is wrong with them.",
  "missing-prop": "Add the prop; `ided rules` lists what each primitive requires.",
  "invalid-value": "Use one of the values listed; `ided rules` lists what each prop accepts.",
  "invalid-token": "Pick one of the brand's tokens (`ided brand` lists them).",
  "nested-root": "Use the root once, as the frame's outermost element; lay out sections with Stack, Row or Box.",
  "place-children": "Put the elements in one Stack or Row inside the Place.",
  misplaced: "Move it out: Text holds only text and inline marks, and flowing content runs across pages by itself.",
  "load-error": "The file does not compile or import; fix the error shown (the type errors for the file point at the line).",
  "render-error": "The component threw while rendering; fix the error shown. Artifacts are pure functions of their source.",
  structure: "Use `ided new` and `ided add` to create projects, frames and components; `ided rules` shows the workspace shape.",
  "frame-name": "Frames are NN-name.tsx: a number, then a kebab-case name.",
  manifest: "Fix project.json as the message says; `ided new` writes a valid one.",
  "frame-export": "A frame file default-exports one function that returns its kind's root.",
  "component-export": "A component file has named function exports only.",
  "asset-name": "Rename the file or folder in kebab-case.",
};

/** A finding's hint, or the rule's own when it has none. TypeScript errors share one. */
export function ruleHint(rule: string, hint?: string): string | undefined {
  if (hint) return hint;
  if (HINTS[rule]) return HINTS[rule];
  if (/^ts\d+$/.test(rule)) return "A TypeScript error, the same one your editor shows. Token props accept only the brand's tokens (`ided brand`).";
  return undefined;
}
