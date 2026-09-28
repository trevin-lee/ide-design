# ided

**Parametric graphic design. Design as code.**

> Working name. The package, CLI, and `ided.json` marker will all be renamed together.

ided is a CLI plus a strict React framework for making decks, documents, social graphics,
web mocks and brand systems the way you write software: as deterministic, reusable functions
checked by a compiler. It is built for developers who work in the terminal, and for the coding
agents they work with.

```tsx
import { Slide, Stack, Text, Em } from "ided";
import { CornerMark } from "@brand/components/corner-mark";

export default function Principles() {
  return (
    <Slide surface="paper" justify="between">
      <CornerMark />
      <Stack gap="l" width="1/2">
        <Text type="title">
          One way to <Em color="accent">do everything.</Em>
        </Text>
      </Stack>
    </Slide>
  );
}
```

There is no `style`, no `className`, no HTML and no CSS. `gap="l"` is not a class that might
be `gap-6` in one file and `gap-[23px]` in the next: it is a named token from the brand, the
only one that exists at that size, and `gap="24px"` does not compile.

## Why

Design tools that work on top of generic HTML and Tailwind let the agent that consumes a design
system write almost-right code: `px` where the system uses a scale, a nearby grey instead of the
brand grey, a corner radius that is 2px off from its container. Each mistake is invisible on its
own. Across a company's output, they add up to the inconsistency good brands spend years
eliminating (line up the corner radii of Apple's products and they are concentric).

ided makes those mistakes unrepresentable:

- **Every value is a token.** Colors, spacing, radii, type styles, logo sizes and margins come from
  one file, `design/brand/brand.ts`. Artifacts contain only token names, typed as closed unions.
- **One way to do each thing.** 16 primitives. Space is `gap`. Padding is `Box pad`. Text is a type
  style. Chrome is `Place` with an anchor and an inset. There are no alternatives to choose between.
- **Parametric by construction.** Fractional widths subtract the parent's gap, so columns meet
  exactly. `radius="concentric"` computes an inner corner from its parent's radius and padding. Line
  heights snap to the base grid. Surfaces carry their own text and logo colors, so contrast is
  correct wherever a component lands.
- **Same values in every medium.** A logo placed by `<CornerMark />` sits the same distance from the
  corner on a slide, a Letter page and an Instagram post, because it is the same component and token.
- **A compiler, not a style guide.** `ided check` runs four layers, all of which report
  `file:line:col` and a fix:
  1. **Structure**: the workspace and every project have a fixed shape.
  2. **Lint**: no HTML, `style`, raw CSS values, hooks, randomness, dates, browser globals, `any`,
     `@ts-ignore`, relative imports, or imports from packages you have not declared.
  3. **Types**: strict TypeScript with the brand registered, so token props are exact unions and
     `<div>` is a type error (the JSX namespace has no intrinsic elements).
  4. **Render audit**: every frame is server-rendered and each primitive validates itself, covering
     WCAG contrast of text and logos on their surfaces, non-concentric nested radii, Box
     single-child, the root element, and the frame kind.

## Install

macOS or Linux. Windows is not supported in 0.1.

```sh
brew install trevin-lee/tap/ided   # pulls in Node; nothing is installed per repository
ided setup                         # skills + MCP server for Claude Code and Codex
```

Upgrade with `brew upgrade`. Everything ided writes outside its own install survives upgrades:
the workspace's editor types point at Homebrew's version-independent path, Claude Code's skills
are links to the installed copy, and Codex's skill copies refresh themselves on the next `ided`
command. The MCP server is registered by absolute path (`/opt/homebrew/bin/ided`), so agents
started outside a terminal still find it.

Without Homebrew, any Node 20.19+ works:

```sh
npm install -g ided
```

Neither channel is live until the first release is tagged. Until then, install from a checkout:

```sh
git clone https://github.com/trevin-lee/ided && cd ided && npm install && npm run build && npm install -g .
```

PDF and PNG export render with one pinned Chromium build (the headless shell that ided's
Playwright version targets), not with whatever Chrome you have installed, so an export looks the
same after a Chrome update and on every machine of the same OS. It downloads on the first export
(about 100 MB, 195 MB on disk, shared by every workspace in `~/.cache/ided/browsers`), or ahead of
time with `ided browser install`. It comes from Playwright's download server over HTTPS; Playwright
does not publish checksums for these builds, so ided cannot verify one.

## Quick start

```sh
cd your-repo
ided init --name "Acme"    # ided.json + design/brand (starter brand, generated wordmark) + a sample deck
ided run                   # opens the viewer at http://127.0.0.1:4800
```

In the viewer:

- The sidebar lists every project in the repository. The Brand page shows logos in every colorway,
  surfaces with contrast ratios, the type scale at size, and space and radius scales.
- **C** toggles comment mode: hover highlights the primitive under the cursor; click to leave a
  comment. The comment records the element's source line, so an agent can go straight to it.
- **P** presents full screen (arrows or space to move, Esc to exit).
- **Export** gives PDF, PNGs or JPEGs; on the Brand page, **Download brand kit**.
- Edits hot-reload in place, and the Issues panel updates live with type, lint and render findings.

The viewer listens on `127.0.0.1` only and has no authentication. It refuses requests addressed
to any other host name (DNS rebinding) and cross-origin writes, and it serves only `design/` and
its own files, never the rest of the repository. `--host 0.0.0.0` exposes it to your network and
prints a warning: use that only on a network you trust.

## Workspace shape

```
your-repo/
  ided.json                  # marks the workspace root
  design/
    tsconfig.json            # editor support; extends .ided/ (generated, gitignored)
    brand/                   # the design system: exactly one, always this name
      project.json           # { "kind": "brand", "title": "Acme Brand" }
      brand.ts               # export default defineBrand({ … })
      assets/                # mark.svg, wordmark.svg, fonts/, shared images
      components/            # chrome shared by every medium
    kit/                     # a library: shared components and assets
      project.json           # { "kind": "library", "title": "Marketing Kit" }
    q3-review/
      project.json           # { "kind": "deck", "title": "Q3 Review", "dependencies": ["kit"] }
      slides/01-title.tsx    # NN-name.tsx, ordered by number
      components/            # private to this project
      assets/                # private images
      comments.json          # review comments (written by the viewer)
```

### Packages

Reuse works like code. Every project folder is a package named by its folder, and every import
names the package it comes from:

```tsx
import { CornerMark } from "@brand/components/corner-mark";   // the brand: always available
import { Stat } from "@kit/components/stat";                   // a library, declared in project.json
import hero from "@kit/assets/photos/hero.jpg";                // assets are imports too
import { Timeline } from "@q3-review/components/timeline";    // this project's own files
```

- **Libraries** (`ided new library kit`) hold components and assets and have no frames. A project
  opts in with `ided use q3-review kit`, which adds `"kit"` to its `"dependencies"`. Importing an
  undeclared package is a lint error, and a dependency cycle is a structure error.
- **Assets are typed.** Each asset file gets an exact module declaration in `design/.ided/assets.d.ts`,
  so a misspelled image is a compile error in your editor, and `<Image src="hero.jpg">` does not
  type-check. Asset names are kebab-case and limited to image formats (fonts live only in the brand).
- **Reuse goes up, not sideways.** Only libraries and the brand can be imported. Decks never import
  from other decks: shared pieces move down into a library.
- **No versions.** Everything in the repo is used at its current state, the way monorepos work.
  `ided check` re-audits every dependent project whenever a library or the brand changes. Versions
  and a lockfile only become useful once packages are shared across repositories.

| kind      | frames       | root         | size                                                          |
|-----------|--------------|--------------|---------------------------------------------------------------|
| `deck`    | `slides/`    | `<Slide>`    | 1920×1080                                                     |
| `doc`     | `pages/`     | `<Page>`     | Letter or A4, laid out at 2× and printed at true size          |
| `graphic` | `artboards/` | `<Artboard>` | square, portrait, story, landscape, og, banner                |
| `web`     | `screens/`   | `<Screen>`   | desktop 1440, tablet 834, mobile 390; grows vertically        |

Anything else in these folders is an error. Create things with the CLI so they start in shape.

## Commands

| command | |
|---|---|
| `ided init [--name X] [--bare]` | create a workspace at the repository root |
| `ided run [--port] [--no-open]` | start the viewer |
| `ided new <kind> <name> [--title] [--page\|--size\|--viewport]` | create a project |
| `ided new library <name>` | create a library of shared components and assets |
| `ided add <project> <name>` | add the next numbered frame (or a component, in a library or the brand) |
| `ided use <project> <library>` | declare a dependency on a library |
| `ided list [--json]` | projects and frames |
| `ided check [project] [--json] [--no-render]` | verify everything; exit 1 on errors |
| `ided brand [--json]` | every token in the brand |
| `ided rules` | the primitive reference agents read |
| `ided export <project> [-f pdf\|png\|jpeg] [--frames …] [-o dir]` | export artifacts |
| `ided export brand [--zip]` | export the brand kit |
| `ided screenshot <project> <frame>` | one frame to PNG, for agents to look at their work |
| `ided browser [install]` | show or download the pinned Chromium used for export |
| `ided comments [project] [--all]` / `resolve <id> -m …` / `reply <id> …` | review loop |
| `ided mcp` | MCP server on stdio |
| `ided setup [--claude] [--codex]` | install skills and register the MCP server |
| `ided ci` | write a GitHub Actions workflow that publishes the brand kit |

## Agents

`ided setup` installs three skills and registers the MCP server with Claude Code (user scope)
and Codex (`~/.codex/config.toml`). Claude Code's skills in `~/.claude/skills` are links to the
installed package; Codex's in `~/.codex/skills` are copies marked with the ided version, which
any later `ided` command replaces after an upgrade. Folders ided did not create are never touched.

- **ided**: the workflow (scaffold, write, `ided check`, screenshot, iterate) and the hard rules.
- **ided-brand**: building the design system, including scales, surfaces, type, logo preparation,
  lockups, colorways and the brand kit.
- **ided-compose**: layout and typography judgment within the rules: hierarchy, proximity,
  alignment, and per-medium guidance.

The MCP server exposes `ided_rules`, `ided_list_projects`, `ided_get_brand`, `ided_check`,
`ided_new_project`, `ided_add_frame`, `ided_screenshot` (returns images), `ided_export`, and the
comment tools. The CLI covers the same ground for agents that prefer shell commands.

The intended loop: you review in the browser and leave comments on elements; the agent runs
`ided comments`, edits the recorded lines, runs `ided check`, looks at `ided screenshot`, and
resolves each comment with a note.

## Brand kit

`ided export brand --zip` writes:

```
acme-brand-kit/
  logos/<variant>/<variant>-<colorway>.svg        # mark, wordmark, every lockup × every colorway
  logos/<variant>/<variant>-<colorway>-{128,512}.png
  tokens/tokens.css      # :root custom properties + .brand-type-* classes
  tokens/tailwind.css    # Tailwind v4 @theme that replaces the default palette and scales
  tokens/tokens.json     # Design Tokens Community Group format
  tokens/brand.ts        # typed constant
  fonts/                 # font files + licenses
  manifest.json, README.md
```

Lockups are composed from `mark.svg` and `wordmark.svg` by rule (geometry is relative to the
wordmark height), so they are identical in the viewer, in artifacts and in the kit. The kit needs
no browser (SVGs are rasterized with resvg), so it runs anywhere.

**Always-current brand in deployed sites.** `ided ci` writes `.github/workflows/brand-kit.yml`,
which runs `ided check`, exports the kit on every change to `design/brand/`, and syncs it to an
S3-compatible bucket under both `/<sha>/` and `/latest/`. Sites that load
`…/latest/tokens/tokens.css` or `…/latest/logos/…svg` pick up brand changes on their next page
load. `action.yml` packages the same steps as a composite action.

## How it works

- **One global install serves every repo.** `ided run` starts a Vite server rooted in the installed
  package. It serves the viewer and compiles your `design/` files on the fly, resolving `ided` and
  React from the package, so workspaces contain only design files.
- **Source locations.** A transform stamps every component element with `data-ided-src="file:line:col"`,
  and primitives forward it to the DOM. That is how a click becomes a line number and how render
  findings get compiler-style locations.
- **Types.** `design/.ided/` is regenerated on every command, holding a tsconfig with
  `jsxImportSource: "ided"` (no intrinsic elements) and a `register.d.ts` that registers
  `typeof brand`, which turns every token prop into an exact union. Your editor gets the same errors as
  `ided check`.
- **Deterministic rendering.** Artifacts are pure functions of their source; fonts ship in the brand's
  assets; frames have fixed pixel geometry. Export is headless Chrome printing or screenshotting a
  chrome-free render route.

## Releasing

Releases are cut by CI from a tag, never from a laptop:

1. Set `version` in `package.json` and add a matching `## <version>` section to `CHANGELOG.md`.
2. `git tag -a v<version> -m "<version>" && git push --follow-tags`.

`.github/workflows/release.yml` then checks that the tag, `package.json` and the changelog agree,
runs the full test suite, attaches the npm tarball to a GitHub release (notes taken from the
changelog), and publishes to npm if `NPM_TOKEN` is set. A macOS job renders the formula with
`packaging/homebrew/formula.mjs`, installs it with real Homebrew, runs `brew test` and
`brew audit --strict`, and only then commits it to `trevin-lee/homebrew-tap` using
`HOMEBREW_TAP_TOKEN` (a fine-grained token with write access to that repository alone).

## Development

```sh
npm install
npm run build        # CLI bundle + runtime declarations
npm test             # unit, lint, CLI, MCP, viewer and export tests (build first;
                     # browser tests skip themselves when no Chrome is installed)
npm run typecheck
node dist/cli.js run # inside any workspace
```

`src/runtime` is the `ided` module (primitives, tokens, JSX types), `src/shared` holds pure
isomorphic logic (brand schema, lockups, tokens, color), `src/app` is the viewer, `src/check` holds the
four check layers, `src/export` the PDF/PNG and brand-kit exporters, `src/mcp` the MCP server, and
`skills/` the agent skills. The app and runtime ship as source because Vite compiles them next to
your files at run time.

## Current limits

- Doc pages are explicit, one file per page. Text does not flow across pages automatically.
- Web screens have one fixed viewport per project and no responsive variants yet.
- Logos are single-color SVGs (recolored per colorway). Multi-color marks need one file per color.
- If the pinned Chromium cannot be downloaded, export falls back to installed Chrome and warns that
  output then follows that browser's version. `IDED_CHROME_PATH` forces a specific binary;
  `IDED_NO_BROWSER_DOWNLOAD=1` disables the download; `IDED_BROWSERS_PATH` moves the cache.
- There is no pinned build for Linux on ARM; those machines use a system Chromium.
- Pinning removes browser drift, not OS differences: macOS and Linux smooth fonts differently, so
  PNGs differ slightly between them. Treat CI's Linux exports as canonical if that matters.
- macOS and Linux only; Windows paths are untested.
- The starter fonts are the Latin subsets of Inter and JetBrains Mono. Other scripts fall back to system fonts until you add font files.
- The Codex skills location (`~/.codex/skills`) follows current Codex conventions and may change.
