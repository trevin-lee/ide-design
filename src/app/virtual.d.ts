declare module "virtual:ided/workspace" {
  type BrandInput = import("../shared/brand-schema.ts").BrandInput;
  type FrameGeometry = import("../shared/formats.ts").FrameGeometry;
  type ProjectKind = import("../shared/formats.ts").ProjectKind;
  type ProjectManifest = import("../shared/formats.ts").ProjectManifest;

  export interface WsIssue {
    file: string;
    rule: string;
    message: string;
    severity: "error" | "warning";
    hint?: string;
  }
  export interface WsFrame {
    id: string;
    file: string;
    title: string;
    number: number;
    abs: string;
    /** Path relative to the workspace root. */
    src: string;
  }
  export interface WsProject {
    id: string;
    kind: ProjectKind;
    title: string;
    manifest: ProjectManifest | null;
    geometry: FrameGeometry | null;
    issues: WsIssue[];
    dependencies: string[];
    dependents: string[];
    /** Component files, e.g. `components/stat.tsx`. */
    components: string[];
    /** Image assets (fonts excluded). */
    assets: { path: string; url: string }[];
    frames: WsFrame[];
  }
  export const brand: BrandInput | null;
  export const svgs: Record<string, string>;
  export const brandAssetBase: string;
  export const workspace: { name: string; root: string; issues: WsIssue[] };
  export const projects: WsProject[];
  export const loaders: Record<string, () => Promise<{ default?: unknown }>>;
}
