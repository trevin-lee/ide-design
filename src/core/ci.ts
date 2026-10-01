// The brand-kit workflow `ided ci` writes, and the check that it still runs this ided version.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { PKG_VERSION, SKILLS_DIR } from "./paths.ts";
import type { Issue } from "./workspace.ts";

/** The repository root above `dir` (the folder with `.git`), or null outside a repository. */
export function gitRoot(dir: string): string | null {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (dirname(d) === d) return null;
  }
}

/** Where the workflow goes: GitHub only runs workflows in the repository root's `.github/workflows`. */
export function workflowFile(root: string): string {
  return join(gitRoot(root) ?? root, ".github", "workflows", "brand-kit.yml");
}

/** The workflow for a workspace at `root`, run from its folder when that is below the repository root. */
export function brandKitWorkflow(root: string): string {
  const repo = gitRoot(root) ?? root;
  const dir = relative(repo, root).split(sep).join("/");
  let yml = readFileSync(join(SKILLS_DIR, "..", "templates", "brand-kit.yml"), "utf8").replace("{{version}}", PKG_VERSION);
  if (!dir) return yml;
  yml = yml
    .replace('paths: ["design/brand/**", "ided.json"]', `paths: ["${dir}/design/brand/**", "${dir}/ided.json"]`)
    .replace("    runs-on: ubuntu-latest\n", `    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: ${dir}\n`)
    .replace("          path: out\n", `          path: ${dir}/out\n`);
  return yml;
}

function older(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}

/** A warning when the workflow installs an older ided than this one, or still installs "latest". */
export function workflowIssues(root: string): Issue[] {
  const file = workflowFile(root);
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  if (!/^name: Brand kit$/m.test(text)) return [];
  const pinned = /IDED_VERSION:\s*"?([\d.]+)"?/.exec(text)?.[1];
  const where = relative(root, file);
  if (pinned && !older(pinned, PKG_VERSION)) return [];
  return [
    {
      file: where,
      rule: "ci",
      severity: "warning",
      message: pinned ? `The brand-kit workflow runs ided ${pinned}; this is ${PKG_VERSION}.` : "The brand-kit workflow installs whichever ided release is latest, so its results can change without a commit.",
      hint: pinned ? `Set IDED_VERSION to "${PKG_VERSION}" in ${where}, or regenerate it with \`ided ci --force\`.` : "Regenerate it with `ided ci --force`, which pins the version.",
    },
  ];
}
