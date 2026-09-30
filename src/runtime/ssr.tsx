// Internal: server-side render of one frame for `ided check`. Runs the same
// primitive validation as the viewer, without a browser.

import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import type { BrandInput } from "../shared/brand-schema.ts";
import type { FrameGeometry, FrameKind } from "../shared/formats.ts";
import { BrandProvider, Collector, FrameHost, missingRootViolation, type Violation } from "./host.tsx";

export interface RenderFrameInput {
  brand: BrandInput;
  svgs: Record<string, string>;
  kind: FrameKind;
  project: string;
  file: string;
  geometry: FrameGeometry;
  index: number;
  total: number;
  Component: ComponentType;
  /** For a web screen: which viewport to render (with `geometry` for that viewport). */
  viewport?: "desktop" | "tablet" | "mobile";
}

export function renderFrame(input: RenderFrameInput): { html: string; violations: Violation[] } {
  const sink = new Collector();
  const rootState = { rendered: false };
  let html = "";
  try {
    html = renderToString(
      <BrandProvider brand={input.brand} svgs={input.svgs} brandAssetUrl={(p) => `/brand-assets/${p}`}>
        <FrameHost
          kind={input.kind}
          project={input.project}
          file={input.file}
          geometry={input.geometry}
          index={input.index}
          total={input.total}
          sink={sink}
          rootState={rootState}
          viewport={input.viewport}
        >
          <input.Component />
        </FrameHost>
      </BrandProvider>,
    );
  } catch (e) {
    sink.report({ rule: "render-error", severity: "error", message: (e as Error).message, src: input.file });
    return { html, violations: sink.list() };
  }
  const list = sink.list();
  if (!rootState.rendered) list.push(missingRootViolation(input.kind, input.file));
  return { html, violations: list };
}
