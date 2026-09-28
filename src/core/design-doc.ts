// DESIGN.md: every project explains itself. A designer can say why a piece
// looks the way it does (who it is for, the one message, the idea behind it,
// what was tried and rejected), and so can an ided project. The sections are
// fixed per kind, like the rest of a project's shape; their content is free.

import type { ProjectKind } from "../shared/formats.ts";

export const DESIGN_DOC = "DESIGN.md";

export interface DesignSection {
  title: string;
  /** The question the section answers. Scaffolded as an HTML comment, so it never renders. */
  prompt: string;
}

const FRAME_SECTIONS: DesignSection[] = [
  {
    title: "Brief",
    prompt:
      "Who sees this, where, for how long, and what should they think or do afterwards? What do they already believe? What is actually hard here (the real problem behind the stated one)? Constraints: format, deadline, what must be included, what must not change.",
  },
  {
    title: "Message",
    prompt: "The one sentence this piece must land, ideally as: get [who] to [think or do what] by [the message]. If a viewer remembers one thing an hour later, it is this.",
  },
  {
    title: "Concept",
    prompt:
      "The idea that organizes everything, in one sentence a stranger could repeat after seeing the piece. Where it comes from in the subject's own world (its artifacts, notation, places, vernacular), and why it fits this audience. If it would suit a competitor unchanged, it is not a concept yet.",
  },
  {
    title: "Hierarchy",
    prompt: "The content ranked by importance, and the reading order you intend: what is seen first, second, third, on each frame and across the piece. Decided before layout.",
  },
  {
    title: "Decisions",
    prompt:
      "How the concept becomes form: structure, grid and axis, type styles and their roles, color strategy and what each color means here, imagery, copy tone, rhythm across frames. Each choice traced to a line in the brief, message or concept, stated as an effect rather than a symbol, and named by token or component.",
  },
  {
    title: "Alternatives",
    prompt: "At least two genuinely different directions (different ideas, not different styling) and why each lost. The roll you started from and every axis you overrode, with the reason.",
  },
  {
    title: "Critique",
    prompt:
      "The tests you ran (squint, grayscale, glance, swap, reading order, removal) and what each found, what changed as a result, what you cut and why, and what is still weak or risky.",
  },
];

const BRAND_SECTIONS: DesignSection[] = [
  {
    title: "Positioning",
    prompt: "Who the brand serves, what it does for them and what makes it different. Personality as three to five 'X, not Y' pairs (precise, not cold).",
  },
  {
    title: "Category",
    prompt: "What every brand in this category looks and sounds like (colors, marks, type, clichés), so this one can deliberately depart from it or knowingly join it.",
  },
  {
    title: "Concept",
    prompt: "The brand idea in one line, and where it comes from: the product, its method, its history, its place. Every section below should trace back to it.",
  },
  {
    title: "Mark",
    prompt:
      "The mark's idea, how it is constructed (grid, geometry, proportions), and what it is deliberately not. Results of the tests: legible at 16px, works in one color and reversed, can be drawn from memory. A mark identifies; it does not have to explain the business.",
  },
  {
    title: "Typography",
    prompt: "Each typeface and type style by role, and the effect its forms have (not what they 'symbolize'). How the scale expresses hierarchy.",
  },
  {
    title: "Color",
    prompt: "Each color by role (surface, text, signal), which lead and which support, and the proportions they appear in. Why these, against the category's usual colors.",
  },
  {
    title: "Form",
    prompt: "The unit, spacing scale, radii and strokes, and the shape language they add up to. What stays constant in every application and what is allowed to vary.",
  },
  {
    title: "Voice",
    prompt: "How the brand writes: vocabulary, sentence length, register, what it never says. Two or three example lines.",
  },
  {
    title: "Usage",
    prompt: "Which lockup and colorway in which context, clear space and minimum sizes, and the misuses most likely to happen.",
  },
  {
    title: "Alternatives",
    prompt: "The routes explored and rejected for the concept, the mark and the palette, and why.",
  },
];

const LIBRARY_SECTIONS: DesignSection[] = [
  { title: "Purpose", prompt: "What this library is for, which projects should use it, and what belongs here rather than in the brand or a single project." },
  { title: "Contents", prompt: "Each component and asset group, what problem it solves and when to reach for it (and when not to)." },
  { title: "Rules", prompt: "Conventions that keep these pieces consistent with each other and with the brand." },
];

export function designSections(kind: ProjectKind): DesignSection[] {
  if (kind === "brand") return BRAND_SECTIONS;
  if (kind === "library") return LIBRARY_SECTIONS;
  return FRAME_SECTIONS;
}

export function designDocTemplate(kind: ProjectKind, title: string): string {
  const intro =
    kind === "brand"
      ? "The meaning behind this identity: what it stands for and why every part of it looks the way it does."
      : kind === "library"
        ? "What this library is for and how its pieces should be used."
        : "Why this looks the way it does. Write it before and while designing, not after: the brief and concept come first, and they decide the frames.";
  const sections = designSections(kind)
    .map((s) => `## ${s.title}\n\n<!-- ${s.prompt} -->\n`)
    .join("\n");
  return `# ${title}\n\n<!-- ${intro} \`ided check\` warns until every section is written. -->\n\n${sections}`;
}

export interface DesignDocStatus {
  /** Required sections whose heading is missing. */
  missing: string[];
  /** Required sections present but with nothing written beyond the prompt. */
  empty: string[];
}

/** Text a reader would see: HTML comments (the prompts) do not count. */
const visible = (body: string) => body.replace(/<!--[\s\S]*?-->/g, "").trim();

export function checkDesignDoc(kind: ProjectKind, markdown: string): DesignDocStatus {
  const bodies = new Map<string, string>();
  const parts = markdown.split(/^##[ \t]+(.+?)[ \t]*$/m);
  for (let i = 1; i < parts.length; i += 2) bodies.set(parts[i]!.trim().toLowerCase(), parts[i + 1] ?? "");
  const status: DesignDocStatus = { missing: [], empty: [] };
  for (const s of designSections(kind)) {
    const body = bodies.get(s.title.toLowerCase());
    if (body === undefined) status.missing.push(s.title);
    else if (!visible(body)) status.empty.push(s.title);
  }
  return status;
}
