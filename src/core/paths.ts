import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).name === "ided") return dir;
      } catch {
        // keep looking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Could not locate the ided package root.");
    dir = parent;
  }
}

export const PKG_ROOT = findPackageRoot();
export const PKG_VERSION: string = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version;

export const pkgPath = (...parts: string[]) => join(PKG_ROOT, ...parts);

export const APP_DIR = pkgPath("src", "app");
export const RUNTIME_ENTRY = pkgPath("src", "runtime", "index.ts");
export const RUNTIME_DIR = pkgPath("src", "runtime");
export const SKILLS_DIR = pkgPath("skills");
/** Declaration files emitted at build time; artifacts type-check against these. */
export const TYPES_DIR = pkgPath("dist", "types");

export const WORKSPACE_MARKER = "ided.json";
export const DESIGN_DIR = "design";
export const GENERATED_DIR = ".ided";

const requireFromPackage = createRequire(join(PKG_ROOT, "package.json"));

/**
 * Directory of an installed dependency. Resolved the way Node does, because
 * npm may nest dependencies (global installs) or hoist them (npx, workspaces).
 */
export function dependencyDir(name: string): string {
  return dirname(requireFromPackage.resolve(`${name}/package.json`));
}
