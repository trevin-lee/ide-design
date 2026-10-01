import type { CSSProperties } from "react";
import { brand, svgs, type WsProject } from "virtual:ided/workspace";
import { AssetGrid, ComponentList } from "./library.tsx";
import { factNames, formatFact } from "../shared/brand-facts.ts";
import { colorValue, isSurface, logoFiles, surfaceNames, typeMetrics, type BrandInput } from "../shared/brand-schema.ts";
import { contrast } from "../shared/color.ts";
import { colorwayHex, composeLogo, logoVariants } from "../shared/lockup.ts";

function LogoArt(props: { b: BrandInput; variant: string; colorway: string; height: number }) {
  let html = "";
  let aspect = 1;
  try {
    ({ svg: html, aspect } = composeLogo(props.b, svgs, props.variant, colorwayHex(props.b, props.colorway), props.height));
  } catch (e) {
    return <span className="bb-error">{(e as Error).message}</span>;
  }
  // Shown at its design height, scaled down (never clipped) when the tile is narrower.
  return (
    <span
      className="bb-logo"
      style={{ width: aspect * props.height, maxWidth: "calc(100% - 24px)", aspectRatio: String(aspect), height: "auto" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The surface a colorway is meant for: declared by the surface, else the most legible. */
function surfaceFor(b: BrandInput, colorway: string): string {
  const surfaces = surfaceNames(b);
  const declared = surfaces.find((s) => {
    const def = b.color[s];
    return isSurface(def) && def.logo === colorway;
  });
  if (declared) return declared;
  const ink = colorwayHex(b, colorway).wordmark.to[0]!;
  return [...surfaces].sort((x, y) => contrast(ink, colorValue(b, y)!) - contrast(ink, colorValue(b, x)!))[0]!;
}

function Section(props: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bb-section">
      <header className="bb-section-head">
        <h2>{props.title}</h2>
        {props.note && <p>{props.note}</p>}
      </header>
      {props.children}
    </section>
  );
}

export function BrandBoard(props: { project: WsProject }) {
  if (!brand) {
    return (
      <div className="canvas empty-state">
        <div>
          <p className="empty-title">Brand did not load</p>
          <p className="empty-body">
            Check <code>design/brand/brand.ts</code>, then run <code>ided check</code>.
          </p>
        </div>
      </div>
    );
  }
  const b = brand;
  const surfaces = surfaceNames(b);
  const fg = Object.keys(b.color).filter((k) => !isSurface(b.color[k]));
  const colorways = Object.keys(b.logo.colorways);
  const heroSurface = surfaces.includes("ink") ? "ink" : surfaces[0]!;
  const heroDef = b.color[heroSurface];
  const heroColorway = (isSurface(heroDef) && heroDef.logo) || colorways[0]!;
  const lockup = Object.keys(b.logo.lockups)[0] ?? "wordmark";
  const maxSpace = Math.max(...Object.values(b.space));

  return (
    <div className="canvas brand-canvas">
      <div className="brand-board">
        <div className="bb-hero" style={{ background: colorValue(b, heroSurface), color: isSurface(heroDef) ? colorValue(b, heroDef.on) : undefined }}>
          <LogoArt b={b} variant={lockup} colorway={heroColorway} height={72} />
          <div className="bb-hero-meta">
            <span>{b.name}</span>
            <span>
              {b.unit}px grid · {Object.keys(b.color).length} colors · {Object.keys(b.type).length} type styles · {Object.keys(b.space).length} spaces
            </span>
          </div>
        </div>

        <Section title="Logo" note="Composed from mark.svg and wordmark.svg. Lockup geometry is relative to the wordmark height, so it holds at every size.">
          <div className="bb-logo-grid" style={{ gridTemplateColumns: `140px repeat(${colorways.length}, minmax(0, 1fr))` }}>
            <div />
            {colorways.map((c) => (
              <div key={c} className="bb-col-head">
                {c}
              </div>
            ))}
            {logoVariants(b).map((v) => (
              <div key={v} style={{ display: "contents" }}>
                <div className="bb-row-head">{v}</div>
                {colorways.map((c) => (
                  <div key={c} className="bb-logo-tile" style={{ background: colorValue(b, surfaceFor(b, c)) }}>
                    <LogoArt b={b} variant={v} colorway={c} height={v === "mark" ? 56 : v === "wordmark" ? 28 : 40} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Color" note="Surfaces can be backgrounds and carry their own text and logo colors. Foreground colors are for text and rules only.">
          <div className="bb-surfaces">
            {surfaces.map((s) => {
              const def = b.color[s];
              if (!isSurface(def)) return null;
              const on = colorValue(b, def.on)!;
              return (
                <div key={s} className="bb-surface" style={{ background: def.value, color: on }}>
                  <span className="bb-aa">Aa</span>
                  <div className="bb-swatch-meta">
                    <strong>{s}</strong>
                    <span>{def.value.toUpperCase()}</span>
                    <span>
                      text {def.on} · {contrast(def.value, on).toFixed(1)}:1
                    </span>
                    {def.logo && <span>logo {def.logo}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bb-foregrounds">
            {fg.map((k) => {
              const hex = colorValue(b, k)!;
              return (
                <div key={k} className="bb-fg">
                  <span className="bb-chip" style={{ background: hex }} />
                  <strong>{k}</strong>
                  <span>{hex.toUpperCase()}</span>
                  <span className="bb-ratios">
                    {surfaces.map((s) => {
                      const r = contrast(hex, colorValue(b, s)!);
                      return (
                        <span key={s} className={r >= 4.5 ? "ok" : r >= 3 ? "large" : "bad"} title={`on ${s}`}>
                          {s} {r.toFixed(1)}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Type" note={`Line heights snap to the ${b.unit}px grid. Sizes are design px; doc pages render at 2×.`}>
          <div className="bb-type">
            {Object.keys(b.type).map((k) => {
              const m = typeMetrics(b, k)!;
              const style: CSSProperties = {
                fontFamily: m.family,
                fontSize: m.size,
                lineHeight: `${m.lineHeight}px`,
                fontWeight: m.weight,
                letterSpacing: `${m.tracking}em`,
                textTransform: m.upper ? "uppercase" : undefined,
              };
              return (
                <div key={k} className="bb-type-row">
                  <div className="bb-type-meta">
                    <strong>{k}</strong>
                    <span>
                      {m.size}/{m.lineHeight} · {m.weight}
                      {m.tracking ? ` · ${m.tracking}em` : ""}
                    </span>
                    <span>{b.type[k]!.font}</span>
                  </div>
                  <div className="bb-type-sample" style={style}>
                    {m.size >= 80 ? b.name : `${b.name} sets every value from one file.`}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div className="bb-two">
          <Section title="Space">
            <div className="bb-space">
              {Object.entries(b.space).map(([k, v]) => (
                <div key={k} className="bb-space-row">
                  <strong>{k}</strong>
                  <span className="bb-bar" style={{ width: `${(v / maxSpace) * 100}%`, minWidth: 2 }} />
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Radius, stroke, size and shadow" note='Nested boxes use radius="concentric": parent radius minus padding.'>
            <div className="bb-radius">
              {Object.entries(b.radius).map(([k, v]) => (
                <div key={k} className="bb-radius-item">
                  <span className="bb-radius-shape" style={{ borderRadius: v }} />
                  <strong>{k}</strong>
                  <span>{v}px</span>
                </div>
              ))}
            </div>
            <div className="bb-mini-table">
              {Object.entries(b.stroke).map(([k, v]) => (
                <span key={k}>
                  stroke <strong>{k}</strong> {v}px
                </span>
              ))}
              {Object.entries(b.size ?? {}).map(([k, v]) => (
                <span key={k}>
                  size <strong>{k}</strong> {v}px
                </span>
              ))}
              {Object.entries(b.logo.sizes).map(([k, v]) => (
                <span key={k}>
                  logo <strong>{k}</strong> {v}px
                </span>
              ))}
              {Object.entries(b.margin).map(([k, v]) => (
                <span key={k}>
                  margin <strong>{k}</strong> {v} ({b.space[v]}px)
                </span>
              ))}
            </div>
            {b.shadow && Object.keys(b.shadow).length > 0 && (
              <div className="bb-radius">
                {Object.entries(b.shadow).map(([k, v]) => (
                  <div key={k} className="bb-radius-item">
                    <span className="bb-radius-shape" style={{ borderRadius: Object.values(b.radius)[1] ?? 8, boxShadow: v, background: "#fff" }} />
                    <strong>{k}</strong>
                    <span>shadow</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section title="Facts" note='Used in artifacts as <Fact name="…" /> and never typed by hand. Edit them in the facts section of brand.ts.'>
          {factNames(b.facts).length ? (
            <div className="bb-facts">
              {factNames(b.facts).map((f) => (
                <div key={f} className="bb-fact">
                  <code>{f}</code>
                  <span>{formatFact(b.facts, f, "full")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="lib-empty">No facts yet. Add names, links, contact details, locations, social handles and abbreviations to brand.ts.</p>
          )}
        </Section>

        <Section title="Components" note="Every project can import these without declaring anything. Add one with ided add brand <name>.">
          <ComponentList project={props.project} />
        </Section>

        <Section title="Assets" note="Shared images. Every project can import these: @brand/assets/<file>.">
          <AssetGrid project={props.project} exclude={logoFiles(b)} />
        </Section>
      </div>
    </div>
  );
}
