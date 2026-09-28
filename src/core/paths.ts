import { existsSync, readFileSync, realpathSync } from "node:fs";
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

/**
 * A path to write into files that outlive this process (editor tsconfig, skill
 * links). Homebrew runs a package from <prefix>/Cellar/<name>/<version>/, which
 * is deleted on upgrade; <prefix>/opt/<name> always points at the current one.
 */
export function stablePath(path: string): string {
  const m = /^(.*)\/Cellar\/([^/]+)\/([^/]+)(\/.*)?$/.exec(path);
  if (!m) return path;
  const [, prefix, name, version, rest = ""] = m;
  const opt = join(prefix!, "opt", name!);
  try {
    if (realpathSync(opt) === realpathSync(join(prefix!, "Cellar", name!, version!))) return opt + rest;
  } catch {
    // no opt link: not a Homebrew keg after all
  }
  return path;
}

export const STABLE_PKG_ROOT = stablePath(PKG_ROOT);
/** npx runs packages from a cache that can be cleared at any time, so nothing should point into it. */
export const EPHEMERAL_INSTALL = /[\\/]_npx[\\/]/.test(PKG_ROOT);

export const APP_DIR = pkgPath("src", "app");
export const RUNTIME_ENTRY = pkgPath("src", "runtime", "index.ts");
export const RUNTIME_DIR = pkgPath("src", "runtime");
export const SKILLS_DIR = pkgPath("skills");
/** Declaration files emitted at build time; the workspace tsconfig points here, so it must survive upgrades. */
export const TYPES_DIR = join(STABLE_PKG_ROOT, "dist", "types");

/** Every release attaches the package under this stable name. */
export const LATEST_TARBALL_URL = "https://github.com/trevin-lee/ided/releases/latest/download/ided.tgz";

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
