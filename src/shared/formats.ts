// Project kinds and their fixed frame geometry. Every artifact renders into a
// frame of known pixel size, so every token resolves to the same absolute value
// in every medium: 24px of margin in a deck is 24px of margin in a document.

export const PROJECT_KINDS = ["brand", "library", "deck", "doc", "graphic", "web"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type FrameKind = Exclude<ProjectKind, "brand" | "library">;
/** Kinds other projects can depend on and import from. */
export type PackageKind = "brand" | "library";
export const isFrameKind = (k: ProjectKind): k is FrameKind => k !== "brand" && k !== "library";
export const FRAME_KINDS: readonly FrameKind[] = ["deck", "doc", "graphic", "web"];

/** Directory inside a project that holds its ordered frame files. */
export const FRAME_DIR: Record<FrameKind, string> = {
  deck: "slides",
  doc: "pages",
  graphic: "artboards",
  web: "screens",
};

/** The root primitive every frame file of a kind must return. */
export const FRAME_ROOT: Record<FrameKind, string> = {
  deck: "Slide",
  doc: "Page",
  graphic: "Artboard",
  web: "Screen",
};

export const FRAME_NOUN: Record<FrameKind, string> = {
  deck: "slide",
  doc: "page",
  graphic: "artboard",
  web: "screen",
};

/**
 * Document pages are laid out at 192 design px per inch (2× CSS px) so that the
 * one brand type scale reads correctly on a slide and on paper: 28px body copy
 * prints at 10.5pt. PDF export maps them back to physical page sizes.
 */
export const DOC_PAGES = {
  letter: { width: 1632, height: 2112, pdf: { width: "8.5in", height: "11in" } },
  a4: { width: 1588, height: 2246, pdf: { width: "210mm", height: "297mm" } },
} as const;

export const GRAPHIC_SIZES = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  og: { width: 1200, height: 630 },
  banner: { width: 1500, height: 500 },
} as const;

export const WEB_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1194 },
  mobile: { width: 390, height: 844 },
} as const;

export type DocPage = keyof typeof DOC_PAGES;
export type GraphicSize = keyof typeof GRAPHIC_SIZES;
export type WebViewport = keyof typeof WEB_VIEWPORTS;

/** Libraries this project imports from. The brand is always available and never listed. */
type Deps = { dependencies?: string[] };

export type ProjectManifest =
  | { kind: "brand"; title: string }
  | ({ kind: "library"; title: string } & Deps)
  | ({ kind: "deck"; title: string } & Deps)
  | ({ kind: "doc"; title: string; page: DocPage } & Deps)
  | ({ kind: "graphic"; title: string; size: GraphicSize } & Deps)
  | ({ kind: "web"; title: string; viewport: WebViewport | readonly WebViewport[] } & Deps);

/** A web project's viewports, widest first (a single one, or several for a responsive screen). */
export function webViewports(m: { viewport: WebViewport | readonly WebViewport[] }): WebViewport[] {
  const listed = typeof m.viewport === "string" ? [m.viewport] : m.viewport;
  return (Object.keys(WEB_VIEWPORTS) as WebViewport[]).filter((v) => listed.includes(v));
}

export interface FrameGeometry {
  width: number;
  height: number;
  /** Web screens grow vertically with their content; everything else is fixed. */
  fixedHeight: boolean;
  /** Physical PDF page size and the scale from design px to CSS px, when not 1:1. */
  print?: { width: string; height: string; scale: number };
  /** Web screens: every viewport the screen renders at, widest first. `width`/`height` are the first's. */
  viewports?: { name: WebViewport; width: number; height: number }[];
}

export function frameGeometry(m: ProjectManifest): FrameGeometry {
  switch (m.kind) {
    case "deck":
      return { width: 1920, height: 1080, fixedHeight: true };
    case "doc": {
      const p = DOC_PAGES[m.page];
      return { width: p.width, height: p.height, fixedHeight: true, print: { ...p.pdf, scale: 0.5 } };
    }
    case "graphic":
      return { ...GRAPHIC_SIZES[m.size], fixedHeight: true };
    case "web": {
      const viewports = webViewports(m).map((name) => ({ name, ...WEB_VIEWPORTS[name] }));
      return { width: viewports[0]!.width, height: viewports[0]!.height, fixedHeight: false, viewports };
    }
    case "brand":
    case "library":
      return { width: 1440, height: 900, fixedHeight: false };
  }
}

/** A project's frame size for listings: "1920x1080", "1440xauto", or a responsive screen's viewports. */
export function describeGeometry(g: FrameGeometry): string {
  if (g.viewports && g.viewports.length > 1) return g.viewports.map((v) => `${v.name} ${v.width}`).join(", ");
  return `${g.width}x${g.fixedHeight ? g.height : "auto"}`;
}

/** Frame files are `NN-slug.tsx`; the number orders them, the slug names them. */
export const FRAME_FILE_RE = /^(\d{2,3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.tsx$/;
/**
 * Asset files: kebab-case names, known formats. Imported by package path
 * (`@kit/assets/team.jpg`), so a missing file is a type error.
 */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif", "gif", "svg"] as const;
export const FONT_EXTENSIONS = ["woff2", "woff", "ttf", "otf"] as const;
export const ASSET_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ASSET_FILE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z0-9]+)$/;

/** Component files are kebab-case `.tsx`. */
export const COMPONENT_FILE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.tsx$/;
/** Project directory names are kebab-case. */
export const PROJECT_DIR_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function frameTitleFromFile(file: string): string {
  const m = FRAME_FILE_RE.exec(file);
  const slug = m ? m[2]! : file.replace(/\.tsx$/, "");
  return slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
