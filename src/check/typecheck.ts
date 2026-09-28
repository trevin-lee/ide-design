// Strict TypeScript over the workspace, with the brand registered so every
// token prop is a closed union. Diagnostics are reported only for workspace
// files and annotated with hints written for whoever has to fix them.

import { statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { DESIGN_DIR, GENERATED_DIR } from "../core/paths.ts";
import type { Issue } from "../core/workspace.ts";

function hintFor(d: ts.Diagnostic, message: string): string | undefined {
  if (d.code === 2339 && /IntrinsicElements/.test(message)) return "HTML elements do not exist in ided. Use Stack/Row/Grid/Box/Text/Logo/Image/Divider.";
  if ((d.code === 2322 || d.code === 2820) && /ImageAsset/.test(message)) {
    return 'Images are imported, not named: import hero from "@<package>/assets/hero.jpg"; then <Image src={hero} … />.';
  }
  if (d.code === 2322 || d.code === 2820) {
    if (/Token|"none"|"auto"|"full"|Fraction/.test(message) || /is not assignable to type '"/.test(message)) {
      return "Token props accept brand token names only. Run `ided brand` to list them.";
    }
    if (/does not exist on type 'IntrinsicAttributes/.test(message)) return "That prop is not part of this primitive. There is no style or className; see `ided rules`.";
  }
  if (d.code === 2307) {
    if (/\/assets\//.test(message)) return "No such asset. Check the file name in that package's assets/ folder (`ided list` shows every asset).";
    return 'Artifacts import "ided" and package paths: "@<package>/components/<name>", "@<package>/assets/<file>".';
  }
  if (d.code === 2741) return "A required prop is missing.";
  return undefined;
}

/**
 * Parsed files survive between checks (keyed by path and mtime), and each
 * program is built from the previous one, so a live check after one edit only
 * re-parses the edited file. Library and React declarations are parsed once.
 */
const parsed = new Map<string, { mtimeMs: number; sf: ts.SourceFile }>();
const previous = new Map<string, ts.Program>();

function cachingHost(options: ts.CompilerOptions): ts.CompilerHost {
  const host = ts.createCompilerHost(options, true);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    let mtimeMs = -1;
    try {
      mtimeMs = statSync(fileName).mtimeMs;
    } catch {
      return read(fileName, languageVersion, onError, shouldCreate);
    }
    const hit = parsed.get(fileName);
    if (hit && hit.mtimeMs === mtimeMs && !shouldCreate) return hit.sf;
    const sf = read(fileName, languageVersion, onError, shouldCreate);
    if (sf) parsed.set(fileName, { mtimeMs, sf });
    return sf;
  };
  return host;
}

export function typecheck(root: string, onlyFiles?: Set<string>): Issue[] {
  const configPath = join(root, DESIGN_DIR, GENERATED_DIR, "tsconfig.json");
  const host: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    },
  };
  const config = ts.getParsedCommandLineOfConfigFile(configPath, undefined, host);
  if (!config) throw new Error(`Could not read ${configPath}`);
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
    host: cachingHost(config.options),
    oldProgram: previous.get(root),
  });
  previous.set(root, program);
  const designDir = join(root, DESIGN_DIR);
  const generated = join(designDir, GENERATED_DIR);
  const diags = ts.getPreEmitDiagnostics(program);
  const issues: Issue[] = [];
  for (const d of diags) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file) {
      issues.push({ file: DESIGN_DIR, rule: `ts${d.code}`, message, severity: "error" });
      continue;
    }
    const file = d.file.fileName;
    if (!file.startsWith(designDir) || file.startsWith(generated)) continue;
    if (onlyFiles && !onlyFiles.has(file)) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    issues.push({
      file: relative(root, file),
      line: line + 1,
      column: character + 1,
      rule: `ts${d.code}`,
      message: message.split("\n").slice(0, 3).join(" "),
      severity: d.category === ts.DiagnosticCategory.Warning ? "warning" : "error",
      hint: hintFor(d, message),
    });
  }
  return issues;
}
