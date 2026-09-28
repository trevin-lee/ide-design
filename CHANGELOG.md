# Changelog

## Unreleased

- Re-running `ided init` in an existing workspace only adds what is missing: the `DESIGN.md`
  template for projects without one (the upgrade path from 0.1), never the starter fonts,
  components or sample deck again.
- `ided setup --remove` (and `--project --remove`) undoes setup; `ided use --remove` drops a
  library dependency and lists files still importing it. Skills renamed since 0.1 (`ided-compose`)
  are removed wherever setup put them.
- Agent-agnostic setup. `ided setup` installs the skills with the standard Agent Skills installer
  (pinned, telemetry off) into `~/.agents/skills`, which Codex, Cursor, Copilot, Gemini CLI and
  most others read, linking agents with their own folder such as Claude Code. `ided setup
  --project` commits them to the repository (`.agents/skills`, `.claude/skills` links, `.mcp.json`),
  and `ided init` adds an ided section to `AGENTS.md`.
- Brand facts: `facts` in brand.ts holds names, links, contact details, locations, social handles
  and abbreviations; artifacts show them with `<Fact name="links.website" />`, and a URL, email,
  phone number or domain typed into an artifact fails `ided check`. Listed by `ided brand`, shown on
  the brand page, exported in the brand kit as `facts.json`.
- Every project has a `DESIGN.md` design document (brief, message, concept, hierarchy,
  decisions, alternatives, critique; a brand and a library variant). `ided new` scaffolds it,
  `ided check` requires it and warns until it is written, the viewer shows it in a Design tab,
  and the brand kit includes the brand's.
- New `ided-design` skill, replacing `ided-compose`: the designer's process from brief to
  critique, with references on generated-design defaults, structures per medium, type and
  layout, color within a fixed palette, critique, and writing rationales, plus a roll script
  for open design choices. `ided-brand` now starts with positioning, a category audit and the
  brand idea, and shows how to add an open-licensed typeface.
- `ided screenshot <project> --sheet` (and `sheet` on the MCP screenshot tool): every frame on
  one contact sheet.
- The sample deck from `ided init` is redesigned (claims with code as evidence, no template
  chrome) and ships with written design documents for it and the starter brand. The starter
  brand's `code` style is 28px, readable on slides.

## 0.1.0 (2026-09-28)

First release, for macOS and Linux.

```sh
brew install trevin-lee/tap/ided
ided setup        # skills and MCP server for Claude Code and Codex
```

- `ided` CLI: `init`, `run`, `new`, `add`, `use`, `list`, `check`, `brand`, `rules`, `export`,
  `screenshot`, `comments`, `mcp`, `setup`, `ci`.
- Runtime: 16 token-only primitives, brand registration for exact token types, and JSX with no
  intrinsic elements.
- `ided check`: workspace structure, lint rules, strict types, and a server-side render audit
  (contrast, concentric radii, Box single child, frame roots).
- Project kinds: brand, library, deck, doc (Letter/A4), graphic, web.
- Local packages: every project is a package, imports are package paths, assets are typed
  imports, libraries are declared as dependencies.
- Viewer: projects sidebar, brand and library pages, comments on elements with source
  locations, presentation mode, live issues, PDF/PNG/JPEG export, brand kit download.
- Brand kit: logos in every variant and colorway (SVG + PNG), tokens as CSS, Tailwind v4, DTCG
  JSON and TypeScript, fonts.
- Pinned export renderer: a Chromium headless shell matched to the driver, downloaded on first
  export into a shared cache (`ided browser install|status`), with installed Chrome as a warned fallback.
- Install with Homebrew, or without it from the release itself:
  `npm install -g https://github.com/trevin-lee/ided/releases/latest/download/ided.tgz`.
  Each release installs and tests the formula with real Homebrew before publishing it to the tap.
- `ided setup` links Claude Code skills and copies Codex skills with a version marker; any `ided`
  command refreshes them after an upgrade. The MCP server is registered by absolute path.
- MCP server and skills for Claude Code and Codex; GitHub Actions workflow template and
  composite action for publishing the brand kit.
