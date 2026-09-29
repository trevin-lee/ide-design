#!/usr/bin/env node
// Rolls the open design axes for a new piece of work.
//
// A model's "free" choice is its most probable one, which is why unassisted
// output converges on the same few layouts. The roll breaks that tie. It never
// touches brand values (colors, type, spacing are the brand's); it only picks
// how the piece uses them. Override any axis you can argue against from the
// brief, and write the argument in DESIGN.md.
//
//   node roll.mjs --medium deck|doc|graphic|web [--seed <any text>]

import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const STRUCTURES = {
  deck: ["statement-sequence", "argument-ladder", "objection-answer", "ledger", "before-after", "one-object", "map", "chapters", "timeline"],
  doc: ["letter", "timetable", "poster-flyer", "report", "reference-card", "field-guide", "manifesto"],
  graphic: ["type-as-image", "one-object", "diagram", "document-fragment", "split", "field-pattern", "quote"],
  web: ["poster-hero", "long-read", "demo-first", "index", "manifesto", "ledger"],
};

const AXES = {
  color: ["restrained", "restrained", "committed", "committed", "drenched"],
  // No "quiet": combined with restraint elsewhere it produced timid, half-empty frames.
  scale: ["strong", "strong", "extreme"],
  density: ["sparse", "balanced", "balanced", "dense"],
  axis: ["hung-left", "asymmetric-split", "full-bleed", "modular-grid", "single-column", "centered"],
  constraint: [
    "no images: type, color and space carry it",
    "one idea per frame, stated in the headline as a sentence",
    "exactly two type styles in the whole piece",
    "every element hangs from one vertical line",
    "the most important number is the largest thing on its frame",
    "a single recurring device (a rule, a shape, a crop) threads every frame",
    "nothing centered",
    "one frame breaks the system on purpose, everywhere else holds it",
    "copy cut to half its first draft",
    "an artifact from the subject's world is the layout's model",
  ],
};

const { values } = parseArgs({ options: { medium: { type: "string" }, seed: { type: "string" }, help: { type: "boolean", short: "h" } } });
if (values.help) {
  console.log("Usage: node roll.mjs --medium deck|doc|graphic|web [--seed <any text>]\n\nRolls the open design axes (structure, color strategy, scale, density, axis, one constraint)\nfor a new piece. The same seed always gives the same roll.");
  process.exit(0);
}
const medium = values.medium ?? "deck";
if (!STRUCTURES[medium]) {
  console.error(`--medium is one of: ${Object.keys(STRUCTURES).join(", ")}`);
  process.exit(1);
}
const seed = values.seed ?? `${Date.now()}-${Math.random()}`;
let counter = 0;
const pick = (list) => {
  const h = createHash("sha256").update(`${seed}:${counter++}`).digest();
  return list[h.readUInt32BE(0) % list.length];
};

const roll = {
  medium,
  structure: pick(STRUCTURES[medium]),
  color: pick(AXES.color),
  scale: pick(AXES.scale),
  density: pick(AXES.density),
  axis: pick(AXES.axis),
  constraint: pick(AXES.constraint),
  seed,
};

const row = (k, v, note = "") => `  ${k.padEnd(11)} ${v.padEnd(22)} ${note}`.trimEnd();
console.log(
  [
    `roll for a ${medium} (seed ${JSON.stringify(seed)})`,
    row("structure", roll.structure, "see references/structures.md"),
    row("color", roll.color, "see references/color.md"),
    row("scale", roll.scale, "the focal element's size relative to the frame"),
    row("density", roll.density, roll.density === "sparse" ? "few elements, each large; not small things in an empty field" : ""),
    row("axis", roll.axis),
    row("constraint", roll.constraint),
    "",
    "Treat this as the starting position, not the answer. Keep what the brief can live with;",
    "override an axis only with a reason from the brief, and record the roll and every override",
    "under Alternatives in DESIGN.md.",
  ].join("\n"),
);
