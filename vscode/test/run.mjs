// Runs the extension's integration test in a separately downloaded VS Code with its own user
// data and extensions folders, against a fresh ided workspace built with this repository's CLI.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";

const here = import.meta.dirname;
const cli = join(here, "..", "..", "dist", "cli.js");
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "ided-vscode-")));
const home = join(tmp, "home");
const root = join(tmp, "ws");
mkdirSync(home);
mkdirSync(root);

// The extension finds ided through ideDesign.path: this build, with a private HOME.
const shim = join(tmp, "ided");
writeFileSync(shim, `#!/bin/sh\nHOME="${home}" exec "${process.execPath}" "${cli}" "$@"\n`);
chmodSync(shim, 0o755);
const ided = (...args) => execFileSync(shim, args, { cwd: root, stdio: "pipe" });
execFileSync("git", ["init", "-q"], { cwd: root });
ided("init", "--here", "--bare", "--no-agents-md");
ided("new", "deck", "d");

writeFileSync(
  join(root, "design/d/slides/01-title.tsx"),
  `import { Slide, Stack, Text } from "ided";

export default function Main() {
  return (
    <Slide surface="paper">
      <Stack gap="16px">
        <Text type="body">Hello</Text>
      </Stack>
    </Slide>
  );
}
`,
);
const now = new Date().toISOString();
writeFileSync(
  join(root, "design/d/comments.json"),
  JSON.stringify({
    comments: [
      {
        id: "c0000test",
        project: "d",
        frame: "01-title",
        target: { src: "design/d/slides/01-title.tsx:7:9", primitive: "Text", ancestors: [], text: "Hello", rect: null },
        body: "Say more than hello.",
        author: "user",
        status: "open",
        createdAt: now,
        replies: [],
      },
    ],
  }),
);
mkdirSync(join(root, ".vscode"));
writeFileSync(join(root, ".vscode", "settings.json"), JSON.stringify({ "ideDesign.path": shim }));

// Started from inside VS Code (a terminal or an agent), this is set and would make the test
// instance run as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE;

await runTests({
  extensionDevelopmentPath: join(here, ".."),
  extensionTestsPath: join(here, "suite.cjs"),
  extensionTestsEnv: { IDED_FIXTURE: root },
  launchArgs: [root, "--disable-extensions", "--user-data-dir", join(tmp, "user-data"), "--extensions-dir", join(tmp, "extensions"), "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust"],
});
