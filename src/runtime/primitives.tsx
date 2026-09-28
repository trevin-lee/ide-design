// The complete visual vocabulary of an ided artifact. There is no `style`, no
// `className` and no HTML: every visual decision is one of these primitives
// with token props. Each primitive validates its own props while rendering,
// so the same checks run in the browser, in export, and in `ided check`.

import { Children, Fragment, isValidElement, useContext, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { colorValue, isSurface, typeMetrics } from "../shared/brand-schema.ts";
import { FACT_FORMATS, factNames, formatFact, splitFact, type FactFormat } from "../shared/brand-facts.ts";
import { contrast, requiredContrast } from "../shared/color.ts";
import { FRAME_ROOT, type FrameKind } from "../shared/formats.ts";
import { composeLogo } from "../shared/lockup.ts";
import { brandVariables, cssVar } from "../shared/tokens.ts";
import {
  FrameContext,
  LayoutContext,
  SinkContext,
  SurfaceContext,
  TextContext,
  useBrandEnv,
  type LayoutEnv,
} from "./context.ts";
import {
  ALIGNS,
  ANCHORS,
  COLUMNS,
  FRACTIONS,
  JUSTIFIES,
  RATIOS,
  type Align,
  type Anchor,
  type ColorToken,
  type ColorwayToken,
  type Columns,
  type Extent,
  type Justify,
  type LogoSizeToken,
  type LogoVariant,
  type RadiusToken,
  type Ratio,
  type ShadowToken,
  type SizeToken,
  type SpaceToken,
  type StrokeToken,
  type SurfaceToken,
  type TypeToken,
  type ImageAsset,
  type FactName,
} from "./tokens.ts";

type Reporter = (rule: string, message: string, hint?: string, severity?: "error" | "warning") => void;

const SRC = "data-ided-src";
const ALWAYS_ALLOWED = new Set(["children", SRC, "key"]);

function usePrimitive(name: string, props: object, allowed: readonly string[], required: readonly string[] = []) {
  const sink = useContext(SinkContext);
  const p = props as Record<string, unknown>;
  const src = typeof p[SRC] === "string" ? (p[SRC] as string) : undefined;
  const report: Reporter = (rule, message, hint, severity = "error") =>
    sink.report({ rule, severity, message: `<${name}> ${message}`, src, hint });
  for (const k of Object.keys(p)) {
    if (!ALWAYS_ALLOWED.has(k) && !allowed.includes(k)) {
      report("unknown-prop", `does not accept \`${k}\`.`, allowed.length ? `Allowed props: ${allowed.join(", ")}.` : "It takes no props.");
    }
  }
  for (const k of required) {
    if (p[k] === undefined) report("missing-prop", `requires \`${k}\`.`);
  }
  return { src, report, dom: { [SRC]: src, "data-ided": name } };
}

function oneOf<T>(value: T | undefined, options: readonly T[], prop: string, report: Reporter): T | undefined {
  if (value === undefined) return undefined;
  if (!options.includes(value)) {
    report("invalid-value", `\`${prop}\` must be one of ${options.map((o) => JSON.stringify(o)).join(", ")} (got ${JSON.stringify(value)}).`);
    return undefined;
  }
  return value;
}

type Group = "space" | "radius" | "stroke" | "size" | "shadow" | "color" | "type";

function useTokens() {
  const { brand } = useBrandEnv();
  const table = (group: Group): Record<string, unknown> => (brand[group] as Record<string, unknown> | undefined) ?? {};
  /** Returns the token if it exists, reporting a helpful error if not. */
  const token = (group: Group, value: unknown, prop: string, report: Reporter, keywords: readonly string[] = []): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === "string" && (keywords.includes(value) || value in table(group))) return value;
    const valid = [...keywords, ...Object.keys(table(group))];
    const raw = typeof value === "number" || (typeof value === "string" && /\d|#|\(/.test(value));
    report(
      "invalid-token",
      `\`${prop}\` got ${JSON.stringify(value)}, which is not a ${group} token.`,
      `${raw ? "Raw values are not allowed; every value comes from the brand. " : ""}Use one of: ${valid.join(", ")}.`,
    );
    return undefined;
  };
  return { brand, token };
}

function fractionValue(f: string): number {
  const [a, b] = f.split("/").map(Number);
  return a! / b!;
}

/** Resolve a width/height extent. Main-axis fractions subtract the parent gap so siblings fill exactly. */
function extentCss(
  value: Extent | undefined,
  dim: "width" | "height",
  layout: LayoutEnv,
  prop: string,
  report: Reporter,
  token: ReturnType<typeof useTokens>["token"],
): CSSProperties {
  if (value === undefined || value === "auto") return {};
  const mainAxis = (dim === "width" && layout.axis === "row") || (dim === "height" && layout.axis === "column");
  if (value === "full") return mainAxis ? { [dim]: "100%", flexShrink: 0 } : { [dim]: "100%" };
  if ((FRACTIONS as readonly string[]).includes(value)) {
    const f = fractionValue(value);
    if (mainAxis) return { [dim]: `calc((100% + ${layout.gap}) * ${f} - ${layout.gap})`, flexShrink: 0 };
    return { [dim]: `calc(100% * ${f})` };
  }
  const t = token("size", value, prop, report, []);
  if (t === undefined) {
    report("invalid-value", `\`${prop}\` accepts "auto", "full", a fraction (${FRACTIONS.join(", ")}) or a size token.`);
    return {};
  }
  return mainAxis ? { [dim]: `var(${cssVar.size(t)})`, flexShrink: 0 } : { [dim]: `var(${cssVar.size(t)})` };
}

function spaceCss(value: SpaceToken | "none" | undefined, prop: string, report: Reporter, token: ReturnType<typeof useTokens>["token"]) {
  const t = token("space", value, prop, report, ["none"]);
  if (t === undefined) return undefined;
  return t === "none" ? "0px" : `var(${cssVar.space(t)})`;
}

function checkNoLooseText(children: ReactNode, report: Reporter) {
  let found = false;
  const walk = (node: ReactNode) => {
    Children.forEach(node, (c) => {
      if ((typeof c === "string" && c.trim()) || typeof c === "number") found = true;
      else if (isValidElement(c) && c.type === Fragment) walk((c.props as { children?: ReactNode }).children);
    });
  };
  walk(children);
  if (found) report("loose-text", "contains raw text.", 'Text only renders inside <Text type="…">.');
}

const JUSTIFY_CSS: Record<Justify, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};
const ALIGN_CSS: Record<Align, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

// ---------------------------------------------------------------------------
// Roots
// ---------------------------------------------------------------------------

export interface RootProps {
  /** Background of the whole frame. Must be a surface color. */
  surface: SurfaceToken;
  gap?: SpaceToken | "none";
  align?: Align;
  justify?: Justify;
  children?: ReactNode;
}

const variableCache = new WeakMap<object, Record<string, string>>();

function makeRoot(name: string, kind: FrameKind) {
  function Root(props: RootProps) {
    const { report, dom } = usePrimitive(name, props, ["surface", "gap", "align", "justify"], ["surface"]);
    const { brand, token } = useTokens();
    const frame = useContext(FrameContext);
    const parentSurface = useContext(SurfaceContext);
    if (!frame) {
      report("wrong-root", "rendered outside a frame.");
    } else if (frame.kind !== kind) {
      report("wrong-root", `cannot be used in a ${frame.kind} project.`, `${frame.kind} frames return <${FRAME_ROOT[frame.kind]}>.`);
    } else {
      frame.root.rendered = true;
    }
    if (parentSurface !== null) report("nested-root", "must be the outermost element of the frame, not nested.");
    checkNoLooseText(props.children, report);

    const surface = token("color", props.surface, "surface", report);
    if (surface && !isSurface(brand.color[surface])) {
      report("invalid-token", `\`surface\` "${surface}" is a color but not a surface.`, "Surfaces are colors declared as { value, on } in brand.ts.");
    }
    const gap = spaceCss(props.gap ?? "none", "gap", report, token) ?? "0px";
    const align = oneOf(props.align, ALIGNS, "align", report) ?? "stretch";
    const justify = oneOf(props.justify, JUSTIFIES, "justify", report) ?? "start";
    let vars = variableCache.get(brand);
    if (!vars) variableCache.set(brand, (vars = brandVariables(brand)));
    const marginToken = brand.margin[kind];
    const surfaceDef = surface ? brand.color[surface] : undefined;
    const bg = isSurface(surfaceDef) ? surfaceDef : undefined;
    const width = frame?.width ?? 1920;
    const height = frame?.height ?? 1080;
    const fixed = frame?.fixedHeight ?? true;
    const style: CSSProperties = {
      ...(vars as CSSProperties),
      ...({ "--brand-frame-margin": `var(${cssVar.space(marginToken)})` } as CSSProperties),
      position: "relative",
      boxSizing: "border-box",
      width,
      ...(fixed ? { height, overflow: "hidden" } : { minHeight: height }),
      padding: "var(--brand-frame-margin)",
      display: "flex",
      flexDirection: "column",
      gap,
      alignItems: ALIGN_CSS[align],
      justifyContent: JUSTIFY_CSS[justify],
      background: bg ? bg.value : undefined,
      color: bg ? colorValue(brand, bg.on) : undefined,
    };
    return (
      <div {...dom} className="ided-root" style={style}>
        <SurfaceContext.Provider value={bg ? surface! : null}>
          <LayoutContext.Provider value={{ axis: "column", gap, inText: false, box: null }}>{props.children}</LayoutContext.Provider>
        </SurfaceContext.Provider>
      </div>
    );
  }
  Root.displayName = name;
  return Root;
}

/** Root of every deck slide (1920×1080). */
export const Slide = makeRoot("Slide", "deck");
/** Root of every document page (Letter or A4). */
export const Page = makeRoot("Page", "doc");
/** Root of every graphic (fixed social / print sizes). */
export const Artboard = makeRoot("Artboard", "graphic");
/** Root of every web screen (fixed width, grows vertically). */
export const Screen = makeRoot("Screen", "web");

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface StackProps {
  gap?: SpaceToken | "none";
  align?: Align;
  justify?: Justify;
  width?: Extent;
  height?: Extent;
  /** Take up remaining space along the parent's axis. */
  grow?: boolean;
  children?: ReactNode;
}

export interface RowProps extends StackProps {
  /** Wrap onto new lines when children overflow. */
  wrap?: boolean;
}

function makeFlex(name: "Stack" | "Row", axis: "row" | "column") {
  const allowed = ["gap", "align", "justify", "width", "height", "grow", ...(axis === "row" ? ["wrap"] : [])];
  function Flex(props: RowProps) {
    const { report, dom } = usePrimitive(name, props, allowed);
    const { token } = useTokens();
    const layout = useContext(LayoutContext);
    if (layout.inText) report("misplaced", "cannot be inside <Text>.");
    checkNoLooseText(props.children, report);
    const gap = spaceCss(props.gap ?? "none", "gap", report, token) ?? "0px";
    const align = oneOf(props.align, ALIGNS, "align", report) ?? "stretch";
    const justify = oneOf(props.justify, JUSTIFIES, "justify", report) ?? "start";
    const style: CSSProperties = {
      display: "flex",
      flexDirection: axis,
      flexWrap: props.wrap ? "wrap" : "nowrap",
      gap,
      alignItems: ALIGN_CSS[align],
      justifyContent: JUSTIFY_CSS[justify],
      minWidth: 0,
      minHeight: 0,
      ...(props.grow ? { flex: "1 1 0" } : {}),
      ...extentCss(props.width, "width", layout, "width", report, token),
      ...extentCss(props.height, "height", layout, "height", report, token),
    };
    return (
      <div {...dom} style={style}>
        <LayoutContext.Provider value={{ axis, gap, inText: false, box: null }}>{props.children}</LayoutContext.Provider>
      </div>
    );
  }
  Flex.displayName = name;
  return Flex;
}

/** Vertical layout. The only way to space things vertically is `gap`. */
export const Stack = makeFlex("Stack", "column") as (props: StackProps) => ReactElement;
/** Horizontal layout. The only way to space things horizontally is `gap`. */
export const Row = makeFlex("Row", "row") as (props: RowProps) => ReactElement;

export interface GridProps {
  /** Number of equal columns. */
  columns: Columns;
  gap?: SpaceToken | "none";
  width?: Extent;
  height?: Extent;
  grow?: boolean;
  children?: ReactNode;
}

/** Equal-column grid. For unequal columns use <Row> with fractional widths. */
export function Grid(props: GridProps) {
  const { report, dom } = usePrimitive("Grid", props, ["columns", "gap", "width", "height", "grow"], ["columns"]);
  const { token } = useTokens();
  const layout = useContext(LayoutContext);
  checkNoLooseText(props.children, report);
  const columns = oneOf(props.columns, COLUMNS, "columns", report) ?? 1;
  const gap = spaceCss(props.gap ?? "none", "gap", report, token) ?? "0px";
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap,
    minWidth: 0,
    ...(props.grow ? { flex: "1 1 0" } : {}),
    ...extentCss(props.width, "width", layout, "width", report, token),
    ...extentCss(props.height, "height", layout, "height", report, token),
  };
  return (
    <div {...dom} style={style}>
      <LayoutContext.Provider value={{ axis: "column", gap: "0px", inText: false, box: null }}>{props.children}</LayoutContext.Provider>
    </div>
  );
}

export interface BoxProps {
  /** Background. Sets the default text and logo color for everything inside. */
  surface?: SurfaceToken;
  /** Padding: one token for all sides, or [vertical, horizontal]. */
  pad?: SpaceToken | readonly [SpaceToken, SpaceToken];
  /** Corner radius. "concentric" derives it from the parent Box: parent radius − parent padding. */
  radius?: RadiusToken | "full" | "concentric";
  border?: StrokeToken;
  borderColor?: ColorToken;
  shadow?: ShadowToken;
  width?: Extent;
  height?: Extent;
  grow?: boolean;
  ratio?: Ratio;
  /** At most one child. Use <Stack> or <Row> inside for several. */
  children?: ReactNode;
}

/** A surface: background, padding, corners, border. Holds at most one child. */
export function Box(props: BoxProps) {
  const { report, dom } = usePrimitive("Box", props, [
    "surface",
    "pad",
    "radius",
    "border",
    "borderColor",
    "shadow",
    "width",
    "height",
    "grow",
    "ratio",
  ]);
  const { brand, token } = useTokens();
  const layout = useContext(LayoutContext);
  const parentSurface = useContext(SurfaceContext);
  if (layout.inText) report("misplaced", "cannot be inside <Text>.");
  checkNoLooseText(props.children, report);
  if (Children.toArray(props.children).length > 1) {
    report("box-children", "holds at most one child.", "Wrap several children in <Stack> or <Row>; Box only decorates.");
  }

  const surface = token("color", props.surface, "surface", report);
  const surfaceDef = surface ? brand.color[surface] : undefined;
  if (surface && !isSurface(surfaceDef)) {
    report("invalid-token", `\`surface\` "${surface}" is a color but not a surface.`, "Surfaces are colors declared as { value, on } in brand.ts.");
  }

  // Padding
  let padCss: string | undefined;
  let padPx = 0;
  if (props.pad !== undefined) {
    const pair = Array.isArray(props.pad) ? props.pad : [props.pad, props.pad];
    if (pair.length !== 2) report("invalid-value", "`pad` is a space token or a [vertical, horizontal] pair.");
    const y = token("space", pair[0], "pad", report);
    const x = token("space", pair[1], "pad", report);
    if (y && x) {
      padCss = `var(${cssVar.space(y)}) var(${cssVar.space(x)})`;
      padPx = Math.min(brand.space[y]!, brand.space[x]!);
    }
  }

  // Radius
  let radiusCss: string | undefined;
  let radiusPx = 0;
  if (props.radius === "concentric") {
    if (!layout.box) {
      report("concentric", 'uses radius="concentric" but its parent is not a <Box>.', "Concentric radii are derived from the directly enclosing Box.");
    } else {
      radiusPx = Math.max(0, layout.box.radius - layout.box.pad);
      radiusCss = `${radiusPx}px`;
    }
  } else if (props.radius === "full") {
    radiusPx = 9999;
    radiusCss = "9999px";
  } else {
    const r = token("radius", props.radius, "radius", report);
    if (r) {
      radiusPx = brand.radius[r]!;
      radiusCss = `var(${cssVar.radius(r)})`;
      if (layout.box && layout.box.radius > 0 && layout.box.radius < 9999) {
        const ideal = Math.max(0, layout.box.radius - layout.box.pad);
        if (radiusPx !== ideal) {
          report(
            "concentric",
            `radius ${radiusPx}px is not concentric with its parent (${layout.box.radius}px radius, ${layout.box.pad}px padding → ${ideal}px).`,
            'Use radius="concentric" so nested corners share a center.',
            "warning",
          );
        }
      }
    }
  }

  // Border
  let borderCss: string | undefined;
  if (props.border !== undefined || props.borderColor !== undefined) {
    const b = token("stroke", props.border, "border", report);
    const c = token("color", props.borderColor, "borderColor", report);
    if (props.border === undefined) report("missing-prop", "`borderColor` needs a `border` width.");
    if (props.borderColor === undefined) report("missing-prop", "`border` needs a `borderColor`.");
    if (b && c) borderCss = `var(${cssVar.stroke(b)}) solid var(${cssVar.color(c)})`;
  }
  const shadow = token("shadow", props.shadow, "shadow", report);
  const ratio = oneOf(props.ratio, RATIOS, "ratio", report);

  const bg = isSurface(surfaceDef) ? surfaceDef : undefined;
  const style: CSSProperties = {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    padding: padCss,
    borderRadius: radiusCss,
    overflow: radiusCss ? "hidden" : undefined,
    border: borderCss,
    boxShadow: shadow ? `var(${cssVar.shadow(shadow)})` : undefined,
    background: bg?.value,
    color: bg ? colorValue(brand, bg.on) : undefined,
    aspectRatio: ratio ? ratio.replace(":", " / ") : undefined,
    ...(props.grow ? { flex: "1 1 0" } : {}),
    ...extentCss(props.width, "width", layout, "width", report, token),
    ...extentCss(props.height, "height", layout, "height", report, token),
  };
  return (
    <div {...dom} style={style}>
      <SurfaceContext.Provider value={bg ? surface! : parentSurface}>
        <LayoutContext.Provider value={{ axis: "column", gap: "0px", inText: false, box: { radius: radiusPx, pad: padPx } }}>
          {props.children}
        </LayoutContext.Provider>
      </SurfaceContext.Provider>
    </div>
  );
}

export interface PlaceProps {
  /** Which corner, edge or center of the enclosing Box or frame to pin to. */
  anchor: Anchor;
  /** Distance from the anchored edges. "margin" aligns with the frame's content edge. */
  inset: SpaceToken | "margin" | "none";
  children?: ReactNode;
}

/**
 * Pin one child to an anchor of the enclosing Box or frame, out of the layout
 * flow. This is how a logo sits the same distance from a corner in every medium.
 */
export function Place(props: PlaceProps) {
  const { report, dom } = usePrimitive("Place", props, ["anchor", "inset"], ["anchor", "inset"]);
  const { token } = useTokens();
  checkNoLooseText(props.children, report);
  if (Children.toArray(props.children).length > 1) report("place-children", "holds exactly one child.");
  const anchor = oneOf(props.anchor, ANCHORS, "anchor", report) ?? "top-left";
  const t = token("space", props.inset, "inset", report, ["margin", "none"]);
  const inset = t === "margin" ? "var(--brand-frame-margin)" : t === "none" || t === undefined ? "0px" : `var(${cssVar.space(t)})`;
  const [v, h] = anchor === "center" ? ["center", "center"] : anchor.includes("-") ? anchor.split("-") : ["top", "bottom"].includes(anchor) ? [anchor, "center"] : ["center", anchor];
  const style: CSSProperties = { position: "absolute", display: "flex", flexDirection: "column" };
  const transforms: string[] = [];
  if (v === "top") style.top = inset;
  else if (v === "bottom") style.bottom = inset;
  else {
    style.top = "50%";
    transforms.push("translateY(-50%)");
  }
  if (h === "left") style.left = inset;
  else if (h === "right") style.right = inset;
  else {
    style.left = "50%";
    transforms.push("translateX(-50%)");
  }
  if (transforms.length) style.transform = transforms.join(" ");
  return (
    <div {...dom} style={style}>
      <LayoutContext.Provider value={{ axis: "column", gap: "0px", inText: false, box: null }}>{props.children}</LayoutContext.Provider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export interface TextProps {
  /** A type style from the brand: size, weight, leading and tracking come as one unit. */
  type: TypeToken;
  /** Defaults to the current surface's foreground. */
  color?: ColorToken;
  align?: "start" | "center" | "end";
  /** Strings, numbers, <Em>, <Fact> and <FrameNumber> only. */
  children?: ReactNode;
}

function checkTextChildren(children: ReactNode, report: Reporter) {
  Children.forEach(children, (c) => {
    if (c === null || c === undefined || typeof c === "boolean" || typeof c === "string" || typeof c === "number") return;
    if (isValidElement(c)) {
      if (c.type === Em || c.type === FrameNumber || c.type === Fact) return;
      if (c.type === Fragment) return checkTextChildren((c.props as { children?: ReactNode }).children, report);
    }
    report("text-children", "may only contain text, <Em>, <Fact> and <FrameNumber>.", "Put layout outside the Text: <Stack><Text/><Text/></Stack>.");
  });
}

/** All text. The only way to set type is a brand type style. */
export function Text(props: TextProps) {
  const { report, dom } = usePrimitive("Text", props, ["type", "color", "align"], ["type"]);
  const { brand, token } = useTokens();
  const layout = useContext(LayoutContext);
  const surface = useContext(SurfaceContext);
  if (layout.inText) report("misplaced", "cannot be nested inside another <Text>.");
  checkTextChildren(props.children, report);
  const typeToken = token("type", props.type, "type", report);
  const m = typeToken ? typeMetrics(brand, typeToken) : undefined;
  const colorToken = token("color", props.color, "color", report);
  const surfaceDef = surface ? brand.color[surface] : undefined;
  const fgToken = colorToken ?? (isSurface(surfaceDef) ? surfaceDef.on : undefined);
  const fg = fgToken ? colorValue(brand, fgToken) : undefined;
  const bg = isSurface(surfaceDef) ? surfaceDef.value : undefined;
  if (fg && bg && m) {
    const ratio = contrast(fg, bg);
    const need = requiredContrast(m.size, m.weight);
    if (ratio < need) {
      report(
        "contrast",
        `"${fgToken}" on "${surface}" is ${ratio.toFixed(2)}:1; ${props.type} text needs ${need}:1.`,
        `Use the surface's default foreground ("${isSurface(surfaceDef) ? surfaceDef.on : ""}") or a darker/lighter color token.`,
      );
    }
  }
  const align = oneOf(props.align, ["start", "center", "end"] as const, "align", report);
  const style: CSSProperties = {
    margin: 0,
    minWidth: 0,
    fontFamily: m?.family,
    fontSize: m ? `${m.size}px` : undefined,
    lineHeight: m ? `${m.lineHeight}px` : undefined,
    fontWeight: m?.weight,
    letterSpacing: m && m.tracking ? `${m.tracking}em` : undefined,
    textTransform: m?.upper ? "uppercase" : undefined,
    textWrap: m?.wrap,
    textAlign: align,
    color: colorToken ? `var(${cssVar.color(colorToken)})` : fg,
    fontKerning: "normal",
    fontFeatureSettings: '"kern"',
  };
  return (
    <p {...dom} style={style}>
      <TextContext.Provider value={{ emphasisWeight: m?.emphasisWeight ?? 700 }}>
        <LayoutContext.Provider value={{ ...layout, inText: true, box: null }}>{props.children}</LayoutContext.Provider>
      </TextContext.Provider>
    </p>
  );
}

export interface EmProps {
  color?: ColorToken;
  children?: ReactNode;
}

/** Emphasis inside <Text>: the type style's emphasis weight, optionally a brand color. */
export function Em(props: EmProps) {
  const { report, dom } = usePrimitive("Em", props, ["color"]);
  const { token } = useTokens();
  const text = useContext(TextContext);
  if (!text) report("misplaced", "only works inside <Text>.");
  checkTextChildren(props.children, report);
  const color = token("color", props.color, "color", report);
  return (
    <span {...dom} style={{ fontWeight: text?.emphasisWeight, color: color ? `var(${cssVar.color(color)})` : undefined }}>
      {props.children}
    </span>
  );
}

export interface FrameNumberProps {
  /** "n" → 3, "nn" → 03, "n/total" → 3 / 12. */
  format?: "n" | "nn" | "n/total";
}

/** The current slide/page number, inside <Text>. */
export function FrameNumber(props: FrameNumberProps) {
  const { report, dom } = usePrimitive("FrameNumber", props, ["format"]);
  const frame = useContext(FrameContext);
  const text = useContext(TextContext);
  if (!text) report("misplaced", "only works inside <Text>.");
  const format = oneOf(props.format, ["n", "nn", "n/total"] as const, "format", report) ?? "n";
  const n = (frame?.index ?? 0) + 1;
  const label = format === "nn" ? String(n).padStart(2, "0") : format === "n/total" ? `${n} / ${frame?.total ?? n}` : String(n);
  return <span {...dom}>{label}</span>;
}

export interface FactProps {
  /** A fact from the brand: "links.website", "contact.email", "locations.studio"… */
  name: FactName;
  /**
   * links: "display" (default, reads "kilnandcopper.com") or "full". locations: "line" (default),
   * "city", "street" or "full". abbreviations: "short" (default), "long" or "both".
   */
  format?: FactFormat;
}

/** A fact from the brand's facts, inside <Text>. Links, addresses and names are never typed by hand. */
export function Fact(props: FactProps) {
  const { report, dom } = usePrimitive("Fact", props, ["name", "format"], ["name"]);
  const { brand } = useTokens();
  const text = useContext(TextContext);
  if (!text) report("misplaced", "only works inside <Text>.");
  const { group } = splitFact(String(props.name));
  const formats = FACT_FORMATS[group as keyof typeof FACT_FORMATS];
  if (props.format !== undefined && formats && !formats.allowed.includes(props.format)) {
    report("invalid-value", `\`format\` for ${group} is one of ${formats.allowed.map((f) => `"${f}"`).join(", ")}.`);
  }
  const value = formatFact(brand.facts, String(props.name), props.format);
  if (value === undefined) {
    const known = factNames(brand.facts);
    report(
      "invalid-token",
      `\`name\` "${props.name}" is not one of the brand's facts.`,
      known.length ? `Facts: ${known.join(", ")}. Add missing ones to \`facts\` in brand.ts; never type or invent them.` : "The brand has no facts yet. Add them to `facts` in brand.ts; never type or invent them.",
    );
    return null;
  }
  return <span {...dom}>{value}</span>;
}

export interface ListProps {
  type: TypeToken;
  items: readonly string[];
  marker?: "bullet" | "number" | "dash";
  gap?: SpaceToken | "none";
  color?: ColorToken;
}

/** A list of short text items with aligned markers. */
export function List(props: ListProps) {
  const { report, dom } = usePrimitive("List", props, ["type", "items", "marker", "gap", "color"], ["type", "items"]);
  const { brand, token } = useTokens();
  const surface = useContext(SurfaceContext);
  const typeToken = token("type", props.type, "type", report);
  const m = typeToken ? typeMetrics(brand, typeToken) : undefined;
  const marker = oneOf(props.marker, ["bullet", "number", "dash"] as const, "marker", report) ?? "bullet";
  const gap = spaceCss(props.gap ?? "none", "gap", report, token) ?? "0px";
  const colorToken = token("color", props.color, "color", report);
  const surfaceDef = surface ? brand.color[surface] : undefined;
  const fgToken = colorToken ?? (isSurface(surfaceDef) ? surfaceDef.on : undefined);
  const fg = fgToken ? colorValue(brand, fgToken) : undefined;
  if (fg && isSurface(surfaceDef) && m) {
    const ratio = contrast(fg, surfaceDef.value);
    const need = requiredContrast(m.size, m.weight);
    if (ratio < need) report("contrast", `"${fgToken}" on "${surface}" is ${ratio.toFixed(2)}:1; needs ${need}:1.`);
  }
  if (!Array.isArray(props.items) || props.items.some((i) => typeof i !== "string")) {
    report("invalid-value", "`items` is an array of strings.");
  }
  const items = Array.isArray(props.items) ? props.items : [];
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: m ? `${Math.round(m.size * 0.6)}px` : "0.6em",
    rowGap: gap,
    margin: 0,
    padding: 0,
    fontFamily: m?.family,
    fontSize: m ? `${m.size}px` : undefined,
    lineHeight: m ? `${m.lineHeight}px` : undefined,
    fontWeight: m?.weight,
    letterSpacing: m && m.tracking ? `${m.tracking}em` : undefined,
    color: fg,
    textWrap: "pretty",
  };
  return (
    <div {...dom} role="list" style={style}>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span aria-hidden style={{ fontVariantNumeric: "tabular-nums", textAlign: "end" }}>
            {marker === "number" ? `${i + 1}.` : marker === "dash" ? "–" : "•"}
          </span>
          <span role="listitem">{item}</span>
        </Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graphics
// ---------------------------------------------------------------------------

export interface LogoProps {
  /** "mark", "wordmark", or a lockup defined in brand.ts. */
  variant: LogoVariant;
  size: LogoSizeToken;
  /** Defaults to the colorway the current surface declares. */
  colorway?: ColorwayToken;
}

/** The brand logo, composed from the brand's mark and wordmark. */
export function Logo(props: LogoProps) {
  const { report, dom } = usePrimitive("Logo", props, ["variant", "size", "colorway"], ["variant", "size"]);
  const { brand, svgs } = useBrandEnv();
  const surface = useContext(SurfaceContext);
  const variants = ["mark", "wordmark", ...Object.keys(brand.logo.lockups)];
  if (!variants.includes(props.variant)) {
    report("invalid-token", `\`variant\` "${props.variant}" is not a logo variant.`, `Use one of: ${variants.join(", ")}.`);
    return null;
  }
  const height = brand.logo.sizes[props.size];
  if (height === undefined) {
    report("invalid-token", `\`size\` "${props.size}" is not a logo size.`, `Use one of: ${Object.keys(brand.logo.sizes).join(", ")}.`);
    return null;
  }
  const surfaceDef = surface ? brand.color[surface] : undefined;
  const colorway = props.colorway ?? (isSurface(surfaceDef) ? surfaceDef.logo : undefined) ?? Object.keys(brand.logo.colorways)[0]!;
  const cw = brand.logo.colorways[colorway];
  if (!cw) {
    report("invalid-token", `\`colorway\` "${colorway}" is not defined.`, `Use one of: ${Object.keys(brand.logo.colorways).join(", ")}.`);
    return null;
  }
  const colors = { mark: colorValue(brand, cw.mark) ?? "#000000", wordmark: colorValue(brand, cw.wordmark) ?? "#000000" };
  if (isSurface(surfaceDef)) {
    const parts = props.variant === "mark" ? (["mark"] as const) : props.variant === "wordmark" ? (["wordmark"] as const) : (["mark", "wordmark"] as const);
    for (const part of parts) {
      const ratio = contrast(colors[part], surfaceDef.value);
      if (ratio < 3) {
        report("contrast", `${part} in colorway "${colorway}" is ${ratio.toFixed(2)}:1 on "${surface}"; logos need 3:1.`, `Declare \`logo\` on the "${surface}" surface or pass a legible colorway.`);
      }
    }
  }
  let svg = "";
  let aspect = 1;
  try {
    ({ svg, aspect } = composeLogo(brand, svgs, props.variant, colors, height));
  } catch (e) {
    report("logo", (e as Error).message);
  }
  return (
    <div
      {...dom}
      role="img"
      aria-label={brand.name}
      style={{ width: `${Math.round(aspect * height * 100) / 100}px`, height: `${height}px`, flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export interface ImageProps {
  /** An imported asset: `import team from "@kit/assets/team.jpg"`. */
  src: ImageAsset;
  /** Describe the image. Required. */
  alt: string;
  ratio?: Ratio;
  fit?: "cover" | "contain";
  radius?: RadiusToken | "full" | "concentric";
  width?: Extent;
  height?: Extent;
  grow?: boolean;
}

/** An image imported from a package's assets/. */
export function Image(props: ImageProps) {
  const { report, dom } = usePrimitive("Image", props, ["src", "alt", "ratio", "fit", "radius", "width", "height", "grow"], ["src", "alt"]);
  const { token } = useTokens();
  const layout = useContext(LayoutContext);
  // Imported assets resolve to server paths; anything else was typed by hand.
  if (typeof props.src !== "string" || !/^(\/|data:)/.test(props.src)) {
    report("image-src", `\`src\` ${JSON.stringify(props.src)} is not an imported asset.`, 'Import the file and pass it: import team from "@<package>/assets/team.jpg"; <Image src={team} … />.');
  }
  const url = typeof props.src === "string" ? props.src : "";
  const ratio = oneOf(props.ratio, RATIOS, "ratio", report);
  const fit = oneOf(props.fit, ["cover", "contain"] as const, "fit", report) ?? "cover";
  let radius: string | undefined;
  if (props.radius === "concentric") {
    if (!layout.box) report("concentric", 'uses radius="concentric" but its parent is not a <Box>.');
    else radius = `${Math.max(0, layout.box.radius - layout.box.pad)}px`;
  } else if (props.radius === "full") radius = "9999px";
  else {
    const r = token("radius", props.radius, "radius", report);
    if (r) radius = `var(${cssVar.radius(r)})`;
  }
  const style: CSSProperties = {
    display: "block",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    borderRadius: radius,
    aspectRatio: ratio ? ratio.replace(":", " / ") : undefined,
    ...(props.grow ? { flex: "1 1 0" } : {}),
    ...extentCss(props.width, "width", layout, "width", report, token),
    ...extentCss(props.height, "height", layout, "height", report, token),
  };
  return (
    <div {...dom} style={style}>
      <img src={url} alt={props.alt} style={{ display: "block", width: "100%", height: "100%", objectFit: fit }} />
    </div>
  );
}

export interface DividerProps {
  color: ColorToken;
  weight: StrokeToken;
}

/** A rule. Horizontal inside a Stack, vertical inside a Row. */
export function Divider(props: DividerProps) {
  const { report, dom } = usePrimitive("Divider", props, ["color", "weight"], ["color", "weight"]);
  const { token } = useTokens();
  const layout = useContext(LayoutContext);
  const color = token("color", props.color, "color", report);
  const weight = token("stroke", props.weight, "weight", report);
  const w = weight ? `var(${cssVar.stroke(weight)})` : "1px";
  const style: CSSProperties =
    layout.axis === "row"
      ? { width: w, alignSelf: "stretch", flexShrink: 0, background: color ? `var(${cssVar.color(color)})` : undefined }
      : { height: w, alignSelf: "stretch", flexShrink: 0, background: color ? `var(${cssVar.color(color)})` : undefined };
  return <div {...dom} role="separator" style={style} />;
}
