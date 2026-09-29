# ide-design for VS Code

The [ide-design](https://github.com/trevin-lee/ide-design) viewer in a VS Code tab, linked to the
code, with `ided check` results in Problems and design review comments on the lines they point at.

It needs the `ided` command (0.3.0 or newer):

```sh
brew install trevin-lee/tap/ide-design
```

Cursor, VSCodium, Windsurf and other editors that use Open VSX find it by searching for
**ide-design** in Extensions. In VS Code, install the `.vsix` from the latest release:

```sh
curl -fsSLO https://github.com/trevin-lee/ide-design/releases/latest/download/ide-design.vsix
code --install-extension ide-design.vsix
```

The extension turns on in any folder that contains an ided workspace (an `ided.json` file).

## Features

- **Viewer.** *ide-design: Open Viewer* (or the preview button on a design file) opens the viewer
  beside your code. It reuses an `ided run` already serving the workspace, or starts one and stops
  it when the tab closes.
- **From design to code.** ⌥-click (Alt-click) any element in a frame to open the line that
  draws it. Source locations in the viewer's Issues and Comments panels open the same way.
- **From code to design.** The viewer shows the frame of the file you are editing and outlines
  the primitives at your cursor.
- **Problems.** `ided check` runs when the workspace opens and whenever a file in `design/` is
  saved: structure, lint, render and SVG color issues appear in Problems with their fix. Type
  errors in open files come from VS Code's own TypeScript, which reads `design/tsconfig.json`.
- **Review comments.** Open comments left in the viewer appear as comment threads on the lines
  they point at. Reply or resolve them here; the viewer, the CLI and agents see the same thread.
  New comments are made in the viewer, by pointing at the design.

## Settings

| Setting | Default | |
| --- | --- | --- |
| `ideDesign.path` | empty | Path to `ided`. Empty looks on `PATH` and in the usual Homebrew and npm locations. |
| `ideDesign.checkOnSave` | `true` | Run `ided check` on open and on save. |
| `ideDesign.followCursor` | `true` | Follow the active file and cursor in the viewer. |
