# ide-design

**Parametric graphic design. Design as code.**

ide-design (`ided` for short, which is also its command) is a CLI plus a strict React framework for making decks, documents, social graphics,
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
- **One way to do each thing.** 20 primitives. Space is `gap`. Padding is `Box pad`. Text is a type
  style. Math is TeX in an `<Equation>`. Chrome is `Place` with an anchor and an inset. There are
  no alternatives to choose between.
- **Parametric by construction.** Fractional widths subtract the parent's gap, so columns meet
  exactly. `radius="concentric"` computes an inner corner from its parent's radius and padding. Line
  heights snap to the base grid. Surfaces carry their own text and logo colors, so contrast is
  correct wherever a component lands.
- **Same values in every medium.** A logo placed by `<CornerMark />` sits the same distance from the
  corner on a slide, a Letter page and an Instagram post, because it is the same component and token.
- **A compiler, not a style guide.** `ided check` runs five layers, all of which report
  `file:line:col` and a fix:
  1. **Structure**: the workspace and every project have a fixed shape.
  2. **Lint**: no HTML, `style`, raw CSS values, hooks, randomness, dates, browser globals, `any`,
     `@ts-ignore`, relative imports, or imports from packages you have not declared.
  3. **Types**: strict TypeScript with the brand registered, so token props are exact unions and
     `<div>` is a type error (the JSX namespace has no intrinsic elements).
  4. **Render audit**: every frame is server-rendered and each primitive validates itself, covering
     WCAG contrast of text and logos on their surfaces, non-concentric nested radii, Box
     single-child, bleeds toward edges a Box cannot reach, the root element, and the frame kind.
     SVG assets are checked too: every color they use must be one of the brand's.
  5. **Layout**: every frame is laid out in the pinned Chromium and measured. Content that runs
     past its box, into the margin or off the frame is an error; the one sanctioned overflow is
     `<Box crop>`, which cuts content at its edge on purpose.

## Install

macOS or Linux. Windows is not supported yet.

```sh
brew install trevin-lee/tap/ide-design   # pulls in Node; installs the `ided` command
ided setup                         # skills for your agents + the MCP server
```

Upgrade with `brew upgrade ide-design`. Everything ided writes outside its own install survives
upgrades: the workspace's editor types point at Homebrew's version-independent path, and the
skills (and the links agents read them through) refresh on the next `ided` command. User-wide, the
MCP server is registered by absolute path (`/opt/homebrew/bin/ided`), so agents started outside a
terminal still find it. A repository's `.mcp.json` names plain `ided` instead, because it is
committed and read on other people's machines, where ided may be installed somewhere else.

To uninstall, undo each thing ided added, then remove the package:

```sh
ided setup --remove             # skills and MCP server, from every agent
ided setup --project --remove   # in each repository you ran `ided setup --project` in
ided browser remove             # the downloaded Chromium (about 100 MB)
brew uninstall ide-design       # or: npm rm -g ide-design
```

`design/.ided` in a workspace holds generated editor types and can be deleted; the VS Code
extension is removed from the Extensions view.

Installed 0.2 or earlier, when the formula was called `ided`? Homebrew trusts tap formulae by
name, so trust the new name once, then move the install over:

```sh
brew trust --formula trevin-lee/tap/ide-design
brew update
brew migrate ided          # skip if `brew list ided` says it is not installed
brew upgrade ide-design
```

Without Homebrew, any Node 20.19+ works. Every release attaches the package to its GitHub release:

```sh
npm install -g https://github.com/trevin-lee/ide-design/releases/latest/download/ide-design.tgz
```

To run unreleased changes from `main`, install from a checkout:

```sh
git clone https://github.com/trevin-lee/ide-design && cd ide-design && npm install && npm run build && npm install -g .
```

`ided check` (its layout layer), screenshots and PDF and PNG export render with one pinned
Chromium build (the headless shell that ided's Playwright version targets), not with whatever
Chrome you have installed, so a render looks the same after a Chrome update and on every machine of
the same OS. It downloads the first time one of them needs it (about 100 MB, 195 MB on disk, shared
by every workspace in `~/.cache/ided/browsers`), or ahead of time with `ided browser install`. It comes from Playwright's download server over HTTPS; Playwright
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

Coming from ided 0.1? Run `ided init` once in each workspace: it adds a `DESIGN.md` template to
every project that lacks one (0.1 had none) and changes nothing else.

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
      DESIGN.md              # why it looks the way it does (every project has one)
```

Frames are ordered by the number in their file name. To insert or reorder frames, rename the
files; to remove a frame or a project, delete its file or folder. They are plain files, so `git mv`
and `git rm` are the tools, and `ided check` flags whatever still imports a removed package and
review comments left on a renamed frame.

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
| `doc`     | `pages/`     | `<Page>`     | Letter or A4, laid out at 2× and printed at true size; `<Page flow>` runs onto as many pages as its text needs, and `<Thread>` runs one story through boxes on designed pages |
| `graphic` | `artboards/` | `<Artboard>` | square, portrait, story, landscape, og, banner                |
| `web`     | `screens/`   | `<Screen>`   | desktop 1440, tablet 834, mobile 390; grows vertically; list several viewports for a responsive screen checked at each |

Anything else in these folders is an error. Create things with the CLI so they start in shape.

## Commands

| command | |
|---|---|
| `ided init [--name X] [--bare]` | create a workspace at the repository root |
| `ided run [--port] [--no-open]` | start the viewer |
| `ided new <kind> <name> [--title] [--page\|--size\|--viewport]` | create a project (`"Q3 Report"` makes `design/q3-report/`, titled as typed) |
| `ided new library <name>` | create a library of shared components and assets |
| `ided add <project> <name> [--component]` | add the next numbered frame, or a component (always, in a library or the brand) |
| `ided use <project> <library> [--remove]` | declare (or drop) a dependency on a library |
| `ided list [--json]` | projects and frames |
| `ided check [project] [--json] [--no-layout] [--no-render]` | verify everything; exit 1 on errors |
| `ided brand [--json]` | every token in the brand |
| `ided rules` | the primitive reference agents read |
| `ided export <project> [-f pdf\|png\|jpeg] [--frames …] [-o dir]` | export artifacts (PDF by default; PNG for web) |
| `ided export brand [--zip]` | export the brand kit |
| `ided screenshot <project> <frame> [--zoom 2x2] [--page n] [--viewport v]` | one frame to PNG (or full-resolution tiles; `--page` for a flowing doc page), for agents to look at their work |
| `ided screenshot <project> --sheet` | every frame on one labeled contact sheet |
| `ided browser [install\|remove]` | show, download or delete the pinned Chromium used for export |
| `ided comments [project] [--all]` / `resolve <id> -m …` / `reply <id> …` (`--author`, default `agent`) | review loop |
| `ided mcp` | MCP server on stdio |
| `ided setup [--project] [--agent <names…>] [--no-mcp] [--remove]` | install the skills for your agents (user-wide or in this repository) and register the MCP server; `--remove` undoes it |
| `ided ci` | write a GitHub Actions workflow that publishes the brand kit |

## Agents

ided is agent-agnostic. Any coding agent that can run a shell can use the `ided` CLI, and the
skills follow the [Agent Skills](https://agentskills.io) standard, so Claude Code, Codex, Cursor,
GitHub Copilot, Gemini CLI, OpenCode, Cline and the rest read the same files.

```sh
ided setup              # user-wide, for the agents on this machine
ided setup --agent trae # also an agent that keeps its own skills folder
ided setup --project    # this repository: every agent, for everyone who clones it
```

- **User-wide**, ided writes one copy to `~/.agents/skills`, which Codex, Cursor, Copilot, Gemini
  CLI and most other agents read directly, and links it into `~/.claude/skills` when Claude Code
  is installed. Nothing is written for an agent that is not there. Agents that keep their own
  folder (Trae, Junie, Kiro, Windsurf and others) get the skills when you name them with
  `--agent`; ided then runs the standard skills installer ([vercel-labs/skills](https://github.com/vercel-labs/skills),
  pinned, with its telemetry turned off), which knows where each one looks. Setup keeps a receipt
  of every folder and file it creates, so `ided setup --remove` leaves your home folder as it
  found it; a file you added to one of ided's skill folders stays, and so does its folder. It
  also registers the MCP server with Claude Code and Codex when they are installed (`--no-mcp` to
  skip); other MCP clients can run `ided mcp`.
- **Per project**, ided writes the skills to `.agents/skills/` (the shared project location) with
  relative links from `.claude/skills/`, adds `ided mcp` to `.mcp.json`, and keeps a short section in
  `AGENTS.md`, the cross-agent instructions file, so even an agent without the skills knows to run
  `ided rules`. `ided init` adds that section on its own (`--no-agents-md` to skip).
- After an upgrade, the next `ided` command refreshes every copy. Files and folders ided did not
  create are never touched, and a skill you deleted stays deleted.
- Without ided installed, the skills alone install anywhere with `npx skills add trevin-lee/ide-design`.

- **ided**: the mechanics (scaffold, write, `ided check`, screenshot, review comments) and the
  hard rules.
- **ided-design**: how a graphic designer works, from brief to critique. The brief and the
  one-sentence message come first, then a concept found in the subject's own world, ranked
  hierarchy, a structure and a color strategy (with `scripts/roll.mjs` to break the model's
  habit of making the most probable choice), then critique from screenshots against the brief,
  and a subtractive final pass. References cover the defaults generated design falls into, a
  catalog of structures per medium, type and layout, color within a fixed palette, and how to
  write a rationale that convinces.
- **ided-brand**: identity work the way an identity designer does it (positioning, a category
  audit, one brand idea, a mark that passes the 16px and draw-from-memory tests), then the
  design system: scales, surfaces, type, fonts, logo preparation, lockups, colorways and the
  brand kit.

The MCP server exposes `ided_rules`, `ided_list_projects`, `ided_get_brand`, `ided_check`,
`ided_new_project`, `ided_add_frame`, `ided_use_library`, `ided_screenshot` (returns images:
frames, a contact sheet, or zoomed tiles),
`ided_export`, and the comment tools. It runs the same code as the CLI, so both give the same
results; use whichever your agent prefers.

The intended loop: you review in the browser, reading each project's design document beside its
frames, and leave comments on elements; the agent runs `ided comments`, edits the recorded
lines, runs `ided check`, looks at `ided screenshot`, and resolves each comment with a note.
Agents (and the VS Code extension) reply and resolve; reopening or deleting a comment is a
reviewer's call, made in the viewer.

## VS Code

The extension puts the viewer in a VS Code tab, linked to the code: ⌥-click (Alt-click) any element
in a frame to open the line that draws it, and the viewer follows your cursor, outlining the
primitives written on that line. `ided check` runs on save with its results in Problems, and the
viewer's open review comments appear as comment threads on the lines they point at, where you
can reply or resolve them.

In Cursor, VSCodium, Windsurf and other editors that use [Open VSX](https://open-vsx.org/extension/trevin-lee/ide-design),
search for **ide-design** in Extensions. In VS Code, install the release's `.vsix`:

```sh
curl -fsSLO https://github.com/trevin-lee/ide-design/releases/latest/download/ide-design.vsix
code --install-extension ide-design.vsix
```

It uses the `ided` command you already have (0.3.0 or newer) and turns on in any folder with an
`ided.json`. Settings and details: [vscode/README.md](vscode/README.md).

## Design documents

Every project has a `DESIGN.md`: what a designer would present alongside the work. For a
deck, document, graphic or web project its sections are Brief, Message, Concept, Hierarchy,
Decisions, Alternatives and Critique; the brand's are Positioning, Category, Concept, Mark,
Typography, Color, Form, Voice, Usage and Alternatives; a library's are Purpose, Contents and
Rules. `ided new` scaffolds one with a prompt per section (as HTML comments, which never
render). `ided check` fails if the file or a section is missing and warns until every section
is written. The viewer's Design tab shows it next to the frames and updates as it is edited,
and the brand kit includes the brand's.

The skills have agents write the brief, message, concept and hierarchy before any frame, since
those decide the frames, and finish the critique last.

## Brand facts

Names, links, contact details, locations, social handles and abbreviations live in the brand's
`facts`, next to the tokens, and artifacts use them the same way: by name.

```ts
facts: {
  names: { full: "Kiln & Copper", legal: "Kiln and Copper LLC" },
  links: { website: "https://kilnandcopper.com", signup: "https://kilnandcopper.com/classes" },
  contact: { email: "hello@kilnandcopper.com", phone: "+1 828 555 0142" },
  locations: { studio: { street: "12 Clingman Ave", city: "Asheville", region: "NC" } },
  abbreviations: { MW: "megawatt" },
}
```

```tsx
<Text type="body">Sign up at <Fact name="links.signup" /></Text>   // reads "kilnandcopper.com/classes"
```

A URL, email address, phone number or domain typed into an artifact fails `ided check` with a
pointer to the fact to use, so contact details are written once, stay current everywhere, and
cannot be made up by an agent. `ided brand` lists every fact, the viewer's brand page shows them,
and the brand kit exports them as `facts.json`.

## Brand kit

`ided export brand --zip` writes:

```
acme-brand-kit/
  logos/<variant>/<variant>-<colorway>.svg        # mark, wordmark, every lockup × every colorway
  logos/<variant>/<variant>-<colorway>-{128,512}.png
  tokens/tokens.css      # :root custom properties + .brand-type-* classes
  tokens/tailwind.css    # Tailwind v4 @theme that replaces the default palette and scales
  tokens/tokens.json     # Design Tokens Community Group format (2025.10)
  tokens/brand.ts        # typed constant
  facts.json             # names, links, contact, locations, social, abbreviations
  fonts/                 # font files + licenses
  manifest.json, README.md
```

Lockups are composed from `mark.svg` and `wordmark.svg` by rule (geometry is relative to the
wordmark height), so they are identical in the viewer, in artifacts and in the kit. The kit needs
no browser (SVGs are rasterized with resvg), so it runs anywhere.

`tokens.css` and `tailwind.css` load the brand fonts from `../fonts/`, so keep the kit's folders
together. The Tailwind theme replaces the default colors, spacing, radii, shadows, fonts and type
scale, so `bg-blue-500`, `p-4` or `font-bold` don't compile; size tokens become `w-*`, `h-*` and
`size-*`, stroke tokens `border-*` and `outline-*`. Tailwind always compiles arbitrary values
(`p-[23px]`) and bare numbers (`border-2`), which no theme can turn off: keep those out in review or
with a lint rule.

**Always-current brand in deployed sites.** `ided ci` writes `.github/workflows/brand-kit.yml` at
the repository root (running from the workspace's folder when that is deeper). On every change to
`design/brand/` it runs `ided check`, exports the kit, keeps it as a build artifact, and, when a
bucket is set, syncs it to an S3-compatible bucket under both `/<sha>/` and `/latest/`. Sites that
load `…/latest/tokens/tokens.css` or `…/latest/logos/…svg` pick up brand changes on their next page
load. Set these in the repository's Settings → Secrets and variables → Actions:

| name | kind | |
|---|---|---|
| `BRAND_KIT_BUCKET` | variable | the bucket; without it the kit is only kept as an artifact |
| `AWS_REGION` | variable | defaults to `us-east-1` |
| `S3_ENDPOINT` | variable | for S3-compatible stores other than AWS (Cloudflare R2, MinIO, GCS) |
| `AWS_ROLE_ARN` | secret | an IAM role GitHub assumes through OIDC… |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | secrets | …or access keys instead |

The workflow runs the ided version that wrote it, so its results only change when you change it;
`ided check` says when your installed ided is newer. `action.yml` is a composite action for the
check and export steps alone (`uses: trevin-lee/ide-design@v<version>`), for workflows of your own
that publish the kit somewhere else.

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

1. Set `version` in `package.json` and `vscode/package.json` (they must match) and add a matching
   `## <version>` section to `CHANGELOG.md`.
2. `git tag -a v<version> -m "<version>" && git push --follow-tags`.

`.github/workflows/release.yml` then checks that the tag, `package.json` and the changelog agree,
runs the full test suite, and attaches the package to a GitHub release (notes taken from the
changelog): `ide-design-<version>.tgz` for the formula, and `ide-design.tgz`, which
`releases/latest/download/ide-design.tgz` always points at (plus `ided.tgz`, the same file, for
workflows generated before 0.3), and the VS Code extension as `ide-design-<version>.vsix` and
`ide-design.vsix`, after its integration test passes, and publishes that `.vsix` to Open VSX and,
once its Azure identity is set up, the VS Code Marketplace (`publish-extension.yml`, which can
also be run by hand for an existing release). It publishes to npm too when an `NPM_TOKEN`
secret exists. A macOS job then renders the formula with `packaging/homebrew/formula.mjs`,
installs it with real Homebrew, runs `brew test` and `brew audit --strict`, and only then commits
it to `trevin-lee/homebrew-tap` as `ide-design` with the `TAP_DEPLOY_KEY` secret, a deploy key that can write to
the tap and nothing else.

To rehearse a release without publishing anything, run the Release workflow by hand
(Actions → Release → Run workflow): it builds, tests, packs and verifies the formula with real
Homebrew, and skips the release, npm and the tap.

## Development

```sh
npm install
npm run build        # CLI bundle + runtime declarations
npm test             # unit, lint, CLI, MCP, viewer and export tests (build first;
                     # browser tests skip themselves when no Chrome is installed)
npm run typecheck
node dist/cli.js run # inside any workspace

cd vscode            # the VS Code extension
npm install
npm run package      # ide-design.vsix
npm test             # runs it in a downloaded VS Code with its own profile (needs the CLI built)
```

`src/runtime` is the `ided` module (primitives, tokens, JSX types), `src/shared` holds pure
isomorphic logic (brand schema, lockups, tokens, color), `src/app` is the viewer, `src/check` holds the
check layers (`src/runtime/layout.ts` is the layout measurement the viewer and `ided check` share), `src/export` the PDF/PNG and brand-kit exporters, `src/mcp` the MCP server,
`skills/` the agent skills, and `vscode/` the VS Code extension (which only drives the CLI). The app and runtime ship as source because Vite compiles them next to
your files at run time.

## Current limits

- A flowing doc page (`<Page flow>`) has one layout for all its pages: one text column and the
  same furniture. Paragraphs break between lines; other blocks move whole. Pages with a layout of
  their own are separate files. To run text through designed pages, write it once as a story
  and thread it through `<Thread>` boxes.
- The SVG color check reads explicit `fill`, `stroke` and `stop-color` values (hex, `rgb()`, basic
  names). Shapes with no fill at all draw black and are not flagged; `hsl()` and other names are
  reported as unreadable.
- If the pinned Chromium cannot be downloaded, rendering falls back to installed Chrome and warns
  that results then follow that browser's version. `IDED_CHROME_PATH` forces a specific binary;
  `IDED_NO_BROWSER_DOWNLOAD=1` disables the download; `IDED_BROWSERS_PATH` moves the cache.
- There is no pinned build for Linux on ARM; those machines use a system Chromium.
- Pinning removes browser drift, not OS differences: macOS and Linux smooth fonts differently, so
  PNGs differ slightly between them. Treat CI's Linux exports as canonical if that matters.
- macOS and Linux only; Windows paths are untested.
- The starter fonts are the Latin subsets of Inter and JetBrains Mono. Other scripts fall back to system fonts until you add font files.
