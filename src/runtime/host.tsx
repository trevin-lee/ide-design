// Internal: hosts artifacts inside the viewer, the exporter and the checker.
// Not part of the public `ided` module.

import "katex/dist/katex.css";
import { Component, useEffect, useMemo, type ErrorInfo, type ReactNode } from "react";
import type { BrandInput } from "../shared/brand-schema.ts";
import type { FrameGeometry, FrameKind } from "../shared/formats.ts";
import { FRAME_ROOT } from "../shared/formats.ts";
import { fontFaceCss } from "../shared/tokens.ts";
import { BrandContext, FrameContext, SinkContext, type BrandEnv, type FrameEnv, type Violation, type ViolationSink } from "./context.ts";

export type { Violation, ViolationSink } from "./context.ts";

export const FRAME_CSS = `
.ided-root, .ided-root * { box-sizing: border-box; }
.ided-root { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision; }
.ided-root p { margin: 0; }
.ided-root svg { display: block; }
.ided-root .katex { letter-spacing: normal; text-transform: none; }
.ided-root .katex-display { margin: 0; }
.ided-root .katex-display > .katex { text-align: inherit; }
.ided-root [data-ided-flow] > * + * { margin-top: var(--ided-flow-gap); }
[data-ided-flow] > * { break-inside: avoid; }
[data-ided-flow] > p { break-inside: auto; orphans: 2; widows: 2; }
[data-ided-flow] > [data-ided-heading] { break-after: avoid; }
`;

export function BrandProvider(props: BrandEnv & { children: ReactNode }) {
  const { brand, svgs, brandAssetUrl } = props;
  const env = useMemo(() => ({ brand, svgs, brandAssetUrl }), [brand, svgs, brandAssetUrl]);
  const css = useMemo(() => FRAME_CSS + fontFaceCss(brand, brandAssetUrl), [brand, brandAssetUrl]);
  return (
    <BrandContext.Provider value={env}>
      <style>{css}</style>
      {props.children}
    </BrandContext.Provider>
  );
}

export class Collector implements ViolationSink {
  private map = new Map<string, Violation>();
  report(v: Violation) {
    this.map.set(`${v.rule}|${v.src ?? ""}|${v.message}`, v);
  }
  list(): Violation[] {
    return [...this.map.values()];
  }
}

interface BoundaryProps {
  geometry: FrameGeometry;
  sink: ViolationSink;
  file: string;
  children: ReactNode;
}

class FrameBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.sink.report({ rule: "render-error", severity: "error", message: error.message, src: this.props.file, hint: info.componentStack?.split("\n").slice(0, 4).join("\n") });
  }
  render() {
    if (this.state.error) {
      const { width, height } = this.props.geometry;
      return (
        <div
          style={{
            width,
            height,
            background: "repeating-linear-gradient(45deg,#fff5f5,#fff5f5 16px,#ffecec 16px,#ffecec 32px)",
            color: "#9b1c1c",
            font: "500 28px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
            padding: 64,
            boxSizing: "border-box",
            whiteSpace: "pre-wrap",
          }}
        >
          {`${this.props.file}\n\n${this.state.error.message}`}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface FrameHostProps {
  kind: FrameKind;
  project: string;
  file: string;
  geometry: FrameGeometry;
  index: number;
  total: number;
  sink: ViolationSink;
  /** Called after commit with whether the frame rendered its root primitive. */
  onRendered?: (hasRoot: boolean) => void;
  /** Supplied by server rendering, where effects do not run. */
  rootState?: { rendered: boolean };
  children: ReactNode;
}

export function FrameHost(props: FrameHostProps) {
  const ownRoot = useMemo(() => ({ rendered: false }), []);
  const root = props.rootState ?? ownRoot;
  root.rendered = false;
  const env: FrameEnv = {
    kind: props.kind,
    project: props.project,
    width: props.geometry.width,
    height: props.geometry.height,
    fixedHeight: props.geometry.fixedHeight,
    index: props.index,
    total: props.total,
    root,
  };
  const { onRendered } = props;
  useEffect(() => {
    onRendered?.(root.rendered);
  });
  return (
    <SinkContext.Provider value={props.sink}>
      <FrameContext.Provider value={env}>
        <FrameBoundary geometry={props.geometry} sink={props.sink} file={props.file}>
          {props.children}
        </FrameBoundary>
      </FrameContext.Provider>
    </SinkContext.Provider>
  );
}

export function missingRootViolation(kind: FrameKind, file: string): Violation {
  return {
    rule: "missing-root",
    severity: "error",
    message: `Frame does not render <${FRAME_ROOT[kind]}>.`,
    src: file,
    hint: `Every ${kind} frame's default export returns <${FRAME_ROOT[kind]} surface="…">…</${FRAME_ROOT[kind]}>.`,
  };
}

export type { BrandInput };
