import { defineBrand } from "ided";

// The single source of every value in this workspace. Artifacts reference
// these tokens by name; they never contain a color, length or font of their own.
export default defineBrand({
  name: "Acme",

  // Base grid in px. Every space, radius, size and line height is a multiple of it.
  unit: 4,

  // Surfaces ({ value, on }) can be backgrounds and declare their own text and
  // logo colors. Plain hex colors are foreground-only.
  color: {
    paper: { value: "#FAFAF7", on: "ink", logo: "primary" },
    sand: { value: "#EDEAE2", on: "ink", logo: "black" },
    ink: { value: "#111113", on: "paper", logo: "reversed" },
    accent: { value: "#FF4F1F", on: "ink", logo: "black" },
    muted: "#62626A",
    line: "#D9D6CE",
  },

  space: {
    "2xs": 4,
    xs: 8,
    s: 12,
    m: 16,
    l: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
    "4xl": 96,
    "5xl": 128,
    "6xl": 192,
  },

  radius: { s: 8, m: 16, l: 32, xl: 48 },
  stroke: { hairline: 1, thin: 2, thick: 4 },
  size: { icon: 32, avatar: 96, thumb: 320, measure: 1200 },
  shadow: {
    raised: "0 1px 2px rgba(17, 17, 19, 0.06), 0 12px 32px rgba(17, 17, 19, 0.10)",
  },

  font: {
    sans: {
      family: "Inter",
      fallback: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
      files: [{ src: "fonts/inter.woff2", weight: "100 900" }],
    },
    mono: {
      family: "JetBrains Mono",
      fallback: 'ui-monospace, "SF Mono", Menlo, monospace',
      files: [{ src: "fonts/jetbrains-mono.woff2", weight: "100 800" }],
    },
  },

  // One type scale for every medium. Doc pages render at 2x, so body copy
  // reads the same on a slide and prints at 10.5pt.
  type: {
    display: { font: "sans", size: 160, weight: 700, leading: 0.95, tracking: -0.045, wrap: "balance" },
    title: { font: "sans", size: 96, weight: 700, leading: 1, tracking: -0.035, wrap: "balance" },
    heading: { font: "sans", size: 56, weight: 600, leading: 1.1, tracking: -0.02, wrap: "balance" },
    subhead: { font: "sans", size: 36, weight: 500, leading: 1.25, tracking: -0.01 },
    body: { font: "sans", size: 28, weight: 400, leading: 1.45, emphasisWeight: 600 },
    code: { font: "mono", size: 28, weight: 400, leading: 1.45 },
    small: { font: "sans", size: 22, weight: 400, leading: 1.45, emphasisWeight: 600 },
    label: { font: "sans", size: 18, weight: 600, leading: 1.3, tracking: 0.08, case: "upper" },
  },

  // Frame margins per medium.
  margin: { deck: "4xl", doc: "5xl", graphic: "3xl", web: "3xl" },

  logo: {
    mark: "mark.svg",
    wordmark: "wordmark.svg",
    // Geometry relative to the wordmark height, so lockups are scale-free.
    lockups: {
      horizontal: { direction: "row", mark: 2.2, gap: 1, align: "center" },
      stacked: { direction: "column", mark: 4, gap: 1.2, align: "center" },
    },
    colorways: {
      primary: { mark: "accent", wordmark: "ink" },
      reversed: { mark: "accent", wordmark: "paper" },
      black: { mark: "ink", wordmark: "ink" },
      white: { mark: "paper", wordmark: "paper" },
    },
    sizes: { xs: 24, s: 40, m: 64, l: 96, xl: 160 },
  },
});
