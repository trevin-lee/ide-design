# Changelog

## 0.1.0 (unreleased)

First release.

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
- MCP server and skills for Claude Code and Codex; GitHub Actions workflow template and
  composite action for publishing the brand kit.
