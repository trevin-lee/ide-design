// Brand facts: what every artifact repeats (names, links, contact details,
// places, handles, abbreviations). They live in brand.ts next to the tokens and
// are used the same way: by name, through <Fact>, never typed by hand. Change
// the website once and every flyer, slide and post follows; an artifact cannot
// invent a URL because the checker rejects typed ones.

export interface Location {
  /** What the place is, e.g. "Studio". */
  readonly label?: string;
  readonly street?: string;
  readonly city: string;
  /** State, province or region. */
  readonly region?: string;
  readonly postal?: string;
  readonly country?: string;
  /** A short note for visitors, e.g. "Enter from the alley". */
  readonly note?: string;
}

export interface BrandFacts {
  /** full, short, legal, abbreviation, or any other form of the name. */
  readonly names?: Readonly<Record<string, string>>;
  /** Full https URLs: website, signup, docs… */
  readonly links?: Readonly<Record<string, string>>;
  /** Email addresses and phone numbers. */
  readonly contact?: Readonly<Record<string, string>>;
  /** "@handle" or profile URLs, keyed by platform. */
  readonly social?: Readonly<Record<string, string>>;
  readonly locations?: Readonly<Record<string, Location>>;
  /** Abbreviation → what it stands for: { MW: "megawatt" }. */
  readonly abbreviations?: Readonly<Record<string, string>>;
}

export const FACT_GROUPS = ["names", "links", "contact", "social", "locations", "abbreviations"] as const;
export type FactGroup = (typeof FACT_GROUPS)[number];

export type FactFormat = "short" | "long" | "both" | "display" | "full" | "line" | "city" | "street";

/** Which formats each group accepts, and its default. */
export const FACT_FORMATS: Record<FactGroup, { default: FactFormat; allowed: readonly FactFormat[] }> = {
  names: { default: "full", allowed: ["full"] },
  links: { default: "display", allowed: ["display", "full"] },
  contact: { default: "full", allowed: ["full"] },
  social: { default: "full", allowed: ["full"] },
  locations: { default: "line", allowed: ["line", "city", "street", "full"] },
  abbreviations: { default: "short", allowed: ["short", "long", "both"] },
};

const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (s: string) => (s.match(/\d/g) ?? []).length;
const PHONE_RE = /^\+?[\d\s().-]+$/;
const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface FactIssue {
  path: string;
  message: string;
}

export function validateBrandFacts(facts: unknown): FactIssue[] {
  const issues: FactIssue[] = [];
  if (facts === undefined) return issues;
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return [{ path: "facts", message: "facts is an object of groups: " + FACT_GROUPS.join(", ") + "." }];
  const d = facts as Record<string, unknown>;
  for (const group of Object.keys(d)) {
    if (!(FACT_GROUPS as readonly string[]).includes(group)) {
      issues.push({ path: `facts.${group}`, message: `Unknown facts group "${group}". Groups: ${FACT_GROUPS.join(", ")}.` });
      continue;
    }
    const entries = d[group];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      issues.push({ path: `facts.${group}`, message: `facts.${group} is an object of named entries.` });
      continue;
    }
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      const path = `facts.${group}.${key}`;
      const keyOk = group === "abbreviations" ? /^[^\s.][^\s]*$/.test(key) : KEY_RE.test(key);
      if (!keyOk) issues.push({ path, message: group === "abbreviations" ? "Abbreviations have no spaces and do not start with a dot." : "Keys are lowercase kebab-case." });
      if (group === "locations") {
        const loc = value as Location | null;
        if (!loc || typeof loc !== "object" || typeof loc.city !== "string" || !loc.city.trim()) {
          issues.push({ path, message: "A location needs at least a city: { street?, city, region?, postal?, country?, label?, note? }." });
        }
        continue;
      }
      if (typeof value !== "string" || !value.trim()) {
        issues.push({ path, message: "Must be a non-empty string." });
        continue;
      }
      if (group === "links" && !URL_RE.test(value)) issues.push({ path, message: `"${value}" is not a full URL. Links start with https://.` });
      if (group === "contact" && !EMAIL_RE.test(value) && !(PHONE_RE.test(value) && digits(value) >= 7)) {
        issues.push({ path, message: `"${value}" is neither an email address nor a phone number.` });
      }
      if (group === "social" && !value.startsWith("@") && !URL_RE.test(value)) issues.push({ path, message: `"${value}" should be an @handle or a profile URL.` });
    }
  }
  return issues;
}

/** Every fact as "group.key", for listings and error hints. */
export function factNames(facts: BrandFacts | undefined): string[] {
  if (!facts) return [];
  return FACT_GROUPS.flatMap((g) => Object.keys(facts[g] ?? {}).map((k) => `${g}.${k}`));
}

export function splitFact(name: string): { group: string; key: string } {
  const i = name.indexOf(".");
  return i === -1 ? { group: name, key: "" } : { group: name.slice(0, i), key: name.slice(i + 1) };
}

function formatLocation(loc: Location, format: FactFormat): string {
  const cityLine = [loc.city, [loc.region, loc.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  switch (format) {
    case "city":
      return [loc.city, loc.region].filter(Boolean).join(", ");
    case "street":
      return loc.street ?? cityLine;
    case "full":
      return [loc.label, loc.street, cityLine, loc.country].filter(Boolean).join(", ");
    default:
      return [loc.street, cityLine].filter(Boolean).join(", ");
  }
}

/** How a link reads in print: no protocol, no "www.", no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/** The text a fact renders as, or undefined if it does not exist. */
export function formatFact(facts: BrandFacts | undefined, name: string, format?: FactFormat): string | undefined {
  const { group, key } = splitFact(name);
  const entries = facts?.[group as FactGroup] as Record<string, unknown> | undefined;
  if (!entries || !(key in entries)) return undefined;
  const value = entries[key];
  const f = format ?? FACT_FORMATS[group as FactGroup].default;
  switch (group as FactGroup) {
    case "links":
      return f === "full" ? (value as string) : displayUrl(value as string);
    case "locations":
      return formatLocation(value as Location, f);
    case "abbreviations":
      return f === "long" ? (value as string) : f === "both" ? `${value as string} (${key})` : key;
    default:
      return value as string;
  }
}
