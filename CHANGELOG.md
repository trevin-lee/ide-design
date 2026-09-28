# Changelog

## Unreleased

- ided's full name is **ide-design**: the GitHub repository is `trevin-lee/ide-design`, the Homebrew
  formula `trevin-lee/tap/ide-design` (existing `ided` installs move over on `brew upgrade`), and
  release tarballs `ide-design-<version>.tgz`. The command stays `ided`.

## 0.2.0 (2026-09-28)

Design that is thought through, not just on-brand: every project now explains itself, agents
work through a designer's process, contact details come from the brand, and the skills install
into any coding agent.

```sh
brew upgrade ided   # or: brew install trevin-lee/tap/ided
ided setup          # skills for every agent on this machine; --project for the repository
```

- **Design documents.** Every project has a `DESIGN.md` (brief, message, concept, hierarchy,
  decisions, alternatives, critique; a brand and a library variant). `ided new` scaffolds it,
  `ided check` requires it and warns until it is written, the viewer shows it in a Design tab,
  and the brand kit includes the brand's.
- **A designer's process for agents.** The new `ided-design` skill replaces `ided-compose`: brief
  and message first, a concept from the subject's own world, ranked hierarchy, a structure and
  color strategy (with a roll script so choices are not always the most probable ones),
  critique from screenshots with a fresh-eyes reviewer, and a subtractive final pass. References
  cover generated-design defaults, structures per medium, type and layout, color within a fixed
  palette, and writing rationales. `ided-brand` starts from positioning, a category audit and
  the brand idea, and only changes the brand when asked.
- **Brand facts.** `facts` in brand.ts holds names, links, contact details, locations, social
  handles and abbreviations; artifacts show them with `<Fact name="links.website" />`, and a URL,
  email, phone number or domain typed into an artifact fails `ided check`, so none can be
  invented. Listed by `ided brand`, shown on the brand page, exported as `facts.json`.
- **Any agent.** `ided setup` installs the skills with the standard Agent Skills installer
  (pinned, telemetry off) into `~/.agents/skills`, which Codex, Cursor, Copilot, Gemini CLI and
  most others read, and links agents with their own folder such as Claude Code. `ided setup
  --project` commits them to the repository (`.agents/skills`, `.claude/skills`, `.mcp.json`),
  `ided init` adds an ided section to `AGENTS.md`, and `ided setup --remove` undoes it all.
- `ided screenshot <project> --sheet` (and `sheet` on the MCP screenshot tool) puts every frame on
  one contact sheet.
- `ided use --remove` drops a library dependency and lists files still importing it.
- The sample deck from `ided init` is redesigned (claims with code as evidence, no template
  chrome) and ships with written design documents for it and the starter brand; the starter
  `code` style is 28px, readable on slides.
- Fixed: logo SVG titles dropped "&" and similar characters from brand names.

### Upgrading from 0.1

- Run `ided init` once in each workspace. It adds a `DESIGN.md` template to every project that
  lacks one and changes nothing else; `ided check` then warns until each is written.
- Run `ided setup` again. It moves the skills to the shared `~/.agents/skills` folder and removes
  0.1's copies and the retired `ided-compose` skill.
- Artifacts that typed a URL, email or phone number now fail `ided check`: move the value into
  `facts` in brand.ts and use `<Fact>`.

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
