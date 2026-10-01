// Edits to a JSON file's text that change one member and keep everything else byte for byte,
// so a user's own config (its formatting, its order, its other entries) stays theirs.

function skipWs(t: string, i: number): number {
  while (i < t.length && /\s/.test(t[i]!)) i++;
  return i;
}

/** Index just past the string starting at `i` (which is a quote). */
function skipString(t: string, i: number): number {
  for (let j = i + 1; j < t.length; j++) {
    if (t[j] === "\\") j++;
    else if (t[j] === '"') return j + 1;
  }
  return t.length;
}

/** Index just past the value starting at or after `i`. */
function skipValue(t: string, i: number): number {
  i = skipWs(t, i);
  const c = t[i];
  if (c === '"') return skipString(t, i);
  if (c === "{" || c === "[") {
    let depth = 0;
    for (let j = i; j < t.length; j++) {
      const ch = t[j];
      if (ch === '"') j = skipString(t, j) - 1;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return t.length;
  }
  let j = i;
  while (j < t.length && !/[,}\]\s]/.test(t[j]!)) j++;
  return j;
}

interface Member {
  /** Start of the key's quote. */
  start: number;
  /** Just past the value. */
  end: number;
  /** Where the value starts. */
  value: number;
}

/** The members of the object whose `{` is at `open`. */
function members(t: string, open: number): { name: string; m: Member }[] {
  const out: { name: string; m: Member }[] = [];
  let i = open + 1;
  for (;;) {
    i = skipWs(t, i);
    if (t[i] !== '"') return out;
    const kEnd = skipString(t, i);
    const name = JSON.parse(t.slice(i, kEnd)) as string;
    const value = skipWs(t, skipWs(t, kEnd) + 1);
    const end = skipValue(t, value);
    out.push({ name, m: { start: i, end, value } });
    i = skipWs(t, end);
    if (t[i] === ",") i++;
  }
}

/** The object at `path` (a chain of member names from the top-level object): its `{` index. */
function objectAt(t: string, path: readonly string[]): number | null {
  let open = skipWs(t, 0);
  if (t[open] !== "{") return null;
  for (const key of path) {
    const found = members(t, open).find((x) => x.name === key);
    if (!found || t[found.m.value] !== "{") return null;
    open = found.m.value;
  }
  return open;
}

/** Removes `key` from the object at `path`, with its comma. Null when it is not there. */
export function removeMember(text: string, path: readonly string[], key: string): string | null {
  const open = objectAt(text, path);
  if (open === null) return null;
  const all = members(text, open);
  const idx = all.findIndex((x) => x.name === key);
  if (idx === -1) return null;
  const { m } = all[idx]!;
  if (idx < all.length - 1) {
    // Up to the next member, so its own indentation stays.
    return text.slice(0, m.start) + text.slice(all[idx + 1]!.m.start);
  }
  if (idx > 0) {
    // The last member: from the end of the previous one, taking its comma.
    return text.slice(0, all[idx - 1]!.m.end) + text.slice(m.end);
  }
  // The only member: leave the object empty.
  const close = skipValue(text, open) - 1;
  return text.slice(0, open + 1) + text.slice(close);
}

/**
 * Adds `key: valueJson` as the last member of the object at `path`, creating the objects on the
 * way if needed, indented like its neighbours. Null when the file is not an object.
 */
export function addMember(text: string, path: readonly string[], key: string, valueJson: string): string | null {
  let open = skipWs(text, 0);
  if (text[open] !== "{") return null;
  let depth = 1;
  for (const [n, segment] of path.entries()) {
    const found = members(text, open).find((x) => x.name === segment);
    if (found && text[found.m.value] === "{") {
      open = found.m.value;
      depth++;
      continue;
    }
    if (found) return null;
    // Build the rest of the path as nested objects with the member inside.
    const rest = [...path.slice(n + 1), key];
    let value = valueJson;
    for (const k of rest.slice(1).reverse()) value = `{ ${JSON.stringify(k)}: ${value} }`;
    return insertLast(text, open, depth, `${JSON.stringify(segment)}: ${rest.length > 1 ? value : `{ ${JSON.stringify(key)}: ${valueJson} }`}`);
  }
  return insertLast(text, open, depth, `${JSON.stringify(key)}: ${valueJson}`);
}

function insertLast(text: string, open: number, depth: number, member: string): string {
  const all = members(text, open);
  const close = skipValue(text, open) - 1;
  if (!all.length) {
    const indent = "  ".repeat(depth);
    return `${text.slice(0, open + 1)}\n${indent}${member}\n${"  ".repeat(depth - 1)}${text.slice(close)}`;
  }
  const last = all[all.length - 1]!.m;
  const lineStart = text.lastIndexOf("\n", last.start) + 1;
  const indent = /^\s*/.exec(text.slice(lineStart, last.start))![0];
  const sameLine = lineStart <= open;
  return `${text.slice(0, last.end)},${sameLine ? " " : `\n${indent}`}${member}${text.slice(last.end)}`;
}
