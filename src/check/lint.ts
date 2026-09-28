// Static rules for artifact source. TypeScript already rejects wrong tokens and
// HTML elements; these rules close the remaining escape hatches and explain
// themselves in terms an agent can act on.

import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import type { Issue, Project } from "../core/workspace.ts";

export type FileRole = "frame" | "component" | "brand";

const TLDS = "com|org|net|io|co|app|dev|ai|us|uk|ca|au|de|fr|nl|eu|edu|gov|info|biz|me|tv|xyz|shop|studio|design|art|coop";
const FACT_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "a URL", re: /\bhttps?:\/\/[^\s"'<>]+/i },
  { kind: "an email address", re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/ },
  { kind: "a URL", re: /\bwww\.[\w-]+(?:\.[\w-]+)+/i },
  { kind: "a domain", re: new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b(?![.\\w-])`, "i") },
];

/** A URL, email, domain or phone number in visible text, if any. */
function rawFact(text: string): { kind: string; text: string } | null {
  for (const { kind, re } of FACT_PATTERNS) {
    const m = re.exec(text);
    if (m) return { kind, text: m[0] };
  }
  const phone = /\+?\(?\d[\d\s().-]{8,}\d/.exec(text);
  if (phone && (phone[0].match(/\d/g) ?? []).length >= 10) return { kind: "a phone number", text: phone[0].trim() };
  return null;
}

const LAYOUT_PRIMITIVES = new Set(["Slide", "Page", "Artboard", "Screen", "Stack", "Row", "Grid", "Box", "Place"]);
const FORBIDDEN_ATTRS = new Set(["style", "className", "class", "dangerouslySetInnerHTML", "ref", "id", "tabIndex"]);
const FORBIDDEN_GLOBALS = new Set(["window", "document", "fetch", "localStorage", "sessionStorage", "globalThis", "process", "require", "eval", "Function", "XMLHttpRequest", "navigator", "setTimeout", "setInterval"]);
const RAW_UNIT_RE = /^-?\d*\.?\d+(px|rem|em|vh|vw|vmin|vmax|pt|pc|cm|mm|in|ch|ex)$/;
const RAW_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RAW_FN_RE = /^(rgb|rgba|hsl|hsla|hwb|oklch|oklab|lab|lch|color|calc|var|clamp|min|max)\(/i;
const ESCAPE_COMMENT_RE = /@ts-(ignore|expect-error|nocheck)|eslint-disable|prettier-ignore/;

/** Kinds of every project in the workspace, keyed by id: the import namespace. */
export type PackageTable = ReadonlyMap<string, string>;

export function lintFile(abs: string, code: string, role: FileRole, project: Project, root: string, packages: PackageTable): Issue[] {
  const rel = relative(root, abs);
  const sf = ts.createSourceFile(abs, code, ts.ScriptTarget.Latest, true, abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const issues: Issue[] = [];
  const at = (node: ts.Node | number) => {
    const pos = typeof node === "number" ? node : node.getStart(sf);
    const { line, character } = sf.getLineAndCharacterOfPosition(pos);
    return { line: line + 1, column: character + 1 };
  };
  const report = (node: ts.Node | number, rule: string, message: string, hint?: string, severity: "error" | "warning" = "error") =>
    issues.push({ file: rel, ...at(node), rule, message, hint, severity });

  // Escape-hatch comments
  const commentRe = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  for (const m of code.matchAll(commentRe)) {
    if (ESCAPE_COMMENT_RE.test(m[0])) report(m.index!, "no-escape-hatch", `Suppression comments are not allowed (${m[0].trim().slice(0, 40)}).`, "Fix the underlying error instead; the rules are the design system.");
  }

  // Imports: "ided", or a package path. There are no relative imports, so every
  // dependency is visible in the import line itself and declared in project.json.
  const importable = new Set(["brand", project.id, ...project.dependencies]);
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) && !ts.isExportDeclaration(stmt)) continue;
    const spec = stmt.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec)) continue;
    const from = spec.text;
    if (role === "brand") {
      if (from !== "ided") report(spec, "imports", `brand.ts may only import from "ided" (got "${from}").`);
      continue;
    }
    if (from === "ided") continue;
    const m = /^@([a-z0-9]+(?:-[a-z0-9]+)*)\/(.+)$/.exec(from);
    if (from.startsWith(".")) {
      const target = relative(dirname(project.dir), resolve(dirname(abs), from)).replace(/\.(tsx?|jsx?)$/, "").split(sep).join("/");
      const guess = target.startsWith("..") ? null : `@${target}`;
      report(spec, "imports", `Relative import "${from}".`, `Import by package path${guess ? `: "${guess}"` : ""}. Every import names the package it comes from.`);
      continue;
    }
    if (!m) {
      report(spec, "imports", `Importing "${from}" is not allowed.`, 'Artifacts import only "ided" and package paths: "@<package>/components/<name>" or "@<package>/assets/<file>". There is no React, no CSS and no npm.');
      continue;
    }
    const [, pkg, rest] = m;
    const kind = packages.get(pkg!);
    if (!kind) {
      report(spec, "imports", `"@${pkg}" is not a project in design/.`);
      continue;
    }
    if (!importable.has(pkg!)) {
      report(
        spec,
        "imports",
        `"@${pkg}" is not a dependency of ${project.id}.`,
        kind === "library" ? `Run \`ided use ${project.id} ${pkg}\` to add it to project.json.` : `Only libraries can be shared; move the piece into a library.`,
      );
      continue;
    }
    if (/^components\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rest!)) {
      continue;
    } else if (/^assets\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/.test(rest!)) {
      if (rest!.startsWith("assets/fonts/")) report(spec, "imports", "Fonts are used through type styles, not imported.");
      continue;
    } else if (/\.(tsx?|jsx?)$/.test(rest!)) {
      report(spec, "imports", `Drop the file extension: "${from.replace(/\.(tsx?|jsx?)$/, "")}".`);
      continue;
    } else {
      report(spec, "imports", `"${from}" is not importable.`, `From a package, import "@${pkg}/components/<name>" or "@${pkg}/assets/<file>". Frames are never imported.`);
    }
  }

  // Exports shape
  const exported = sf.statements.filter(
    (s) =>
      (ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) || ts.isExportAssignment(s) || ts.isExportDeclaration(s),
  );
  if (role === "frame") {
    const defaults = exported.filter((s) => ts.isFunctionDeclaration(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
    if (defaults.length !== 1) {
      report(0, "frame-export", "A frame file has exactly one `export default function Name() { … }`.");
    } else {
      const fn = defaults[0] as ts.FunctionDeclaration;
      if (!fn.name || !/^[A-Z]/.test(fn.name.text)) report(fn, "frame-export", "The default export needs a PascalCase name, e.g. `export default function Title()`.");
      if (fn.parameters.length > 0) report(fn.parameters[0]!, "frame-export", "Frames take no props; they are the top of the tree.");
    }
    for (const s of exported) {
      if (defaults.includes(s)) continue;
      if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) continue;
      report(s, "frame-export", "Frames export only their default component. Move shared pieces to components/.");
    }
  }
  if (role === "component") {
    for (const s of exported) {
      if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) continue;
      if (ts.isFunctionDeclaration(s) && !ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && s.name && /^[A-Z]/.test(s.name.text)) continue;
      report(s, "component-export", "Component files export PascalCase functions: `export function Callout(props: {…}) { … }`. No default exports, no constants.");
    }
  }
  if (role === "brand") {
    const def = sf.statements.find(ts.isExportAssignment);
    const ok =
      def &&
      ts.isCallExpression(def.expression) &&
      ts.isIdentifier(def.expression.expression) &&
      def.expression.expression.text === "defineBrand" &&
      def.expression.arguments.length === 1 &&
      ts.isObjectLiteralExpression(def.expression.arguments[0]!);
    if (!ok) report(def ?? 0, "brand-export", "brand.ts is `export default defineBrand({ … })` with an object literal.");
    for (const s of sf.statements) {
      if (!ts.isImportDeclaration(s) && !ts.isExportAssignment(s)) report(s, "brand-export", "brand.ts contains only the import and `export default defineBrand({ … })`. Keep it declarative.");
    }
  }

  const visit = (node: ts.Node) => {
    // JSX
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (/^[a-z]/.test(tag)) {
        report(node, "no-html", `<${tag}> is HTML. Artifacts are built from ided primitives only.`, "Use Stack/Row/Grid/Box for layout, Text for type, Logo/Image/Divider for graphics.");
      }
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(sf);
        if (FORBIDDEN_ATTRS.has(name) || /^on[A-Z]/.test(name) || /^data-/.test(name)) {
          report(attr, "no-escape-hatch", `\`${name}\` is not part of the design vocabulary.`, name === "style" || name === "className" ? "Every visual property is a primitive prop with a token value." : undefined);
        }
        const init = attr.initializer;
        if (init && ts.isJsxExpression(init) && init.expression && ts.isNumericLiteral(init.expression) && name !== "columns") {
          report(init, "no-raw-values", `\`${name}={${init.expression.text}}\` is a raw number.`, "Values are brand tokens, e.g. gap=\"m\".");
        }
      }
    }
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sf);
      if (LAYOUT_PRIMITIVES.has(tag)) {
        for (const child of node.children) {
          if (ts.isJsxText(child) && child.text.trim()) {
            report(child, "loose-text", `Raw text inside <${tag}>: "${child.text.trim().slice(0, 30)}".`, 'Wrap copy in <Text type="…">.');
          }
        }
      }
    }
    // Raw CSS-looking values in string literals
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isImportDeclaration(node.parent) && role !== "brand") {
      const v = node.text.trim();
      if (RAW_UNIT_RE.test(v) || RAW_COLOR_RE.test(v) || RAW_FN_RE.test(v)) {
        report(node, "no-raw-values", `"${v}" is a raw CSS value.`, "Every length, color and font comes from brand tokens. Add a token to design/brand/brand.ts if one is missing.");
      }
    }
    // Contact details typed by hand. They come from the brand's data through <Fact>, so they
    // are written once, stay current everywhere, and cannot be invented.
    if (role !== "brand" && (ts.isJsxText(node) || ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isImportDeclaration(node.parent)))) {
      const found = rawFact(node.text);
      if (found) {
        report(
          node,
          "no-raw-facts",
          `"${found.text}" looks like ${found.kind} typed by hand.`,
          `Links, email addresses, phone numbers and domains come from the brand's data: <Fact name="${found.kind === "an email address" || found.kind === "a phone number" ? "contact" : "links"}.…" /> inside <Text>. If the fact is missing, add it to \`data\` in brand.ts, or ask; never invent one.`,
        );
      }
    }
    // Hooks, nondeterminism, globals
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && /^use[A-Z]/.test(callee.text)) {
        report(callee, "pure", `\`${callee.text}\` is a hook. Artifacts are pure functions of their props: no state, no effects.`);
      }
      if (callee.kind === ts.SyntaxKind.ImportKeyword) report(node, "imports", "Dynamic import() is not allowed.");
      const text = callee.getText(sf);
      if (/^(Math\.random|Date\.now|performance\.now|crypto\.)/.test(text)) {
        report(node, "deterministic", `\`${text}\` makes the design non-deterministic.`, "The same source must always render the same pixels. Hard-code the data.");
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date") {
      report(node, "deterministic", "`new Date()` makes the design non-deterministic.", "Write the date as text.");
    }
    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
      const p = node.parent;
      const isProp = (ts.isPropertyAccessExpression(p) && p.name === node) || (ts.isPropertyAssignment(p) && p.name === node) || ts.isJsxAttribute(p) || (ts.isBindingElement(p) && p.propertyName === node);
      if (!isProp) report(node, "pure", `\`${node.text}\` is not available to artifacts.`, "Artifacts render the same in the viewer, the exporter and the checker; they have no browser or network.");
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) report(node, "pure", "Classes are not allowed. Components are functions.");
    if (node.kind === ts.SyntaxKind.AnyKeyword) report(node, "no-escape-hatch", "`any` turns off the type checker, which is what enforces the brand.");
    if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.UnknownKeyword) report(node, "no-escape-hatch", "Casting through `unknown` bypasses token types.");
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return issues;
}
