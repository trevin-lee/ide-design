// Token types. A workspace registers its brand once (design/.ided/register.d.ts):
//
//   declare module "ided" { interface Register { brand: typeof brand } }
//
// after which every token prop is a closed union of the brand's token names,
// so `gap="16px"` or `color="#f00"` is a compile error, not a code review.

import type { BrandInput } from "../shared/brand-schema.ts";

export interface Register {}

export type RegisteredBrand = Register extends { brand: infer B extends BrandInput } ? B : BrandInput;

type Keys<T> = Extract<keyof T, string>;
type Group<K extends string> = RegisteredBrand extends { readonly [P in K]?: infer V } ? (V extends object ? V : {}) : {};
type LogoGroup<K extends string> = RegisteredBrand["logo"] extends { readonly [P in K]: infer V } ? V : {};

export type ColorToken = Keys<Group<"color">>;
/** Colors declared as `{ value, on }`: the only colors that can be backgrounds. */
export type SurfaceToken = {
  [K in Keys<Group<"color">>]: Group<"color">[K] extends { readonly on: string } ? K : never;
}[Keys<Group<"color">>];
export type SpaceToken = Keys<Group<"space">>;
export type RadiusToken = Keys<Group<"radius">>;
export type StrokeToken = Keys<Group<"stroke">>;
export type SizeToken = Keys<Group<"size">>;
export type ShadowToken = Keys<Group<"shadow">>;
export type TypeToken = Keys<Group<"type">>;
export type LogoSizeToken = Keys<LogoGroup<"sizes">>;
export type ColorwayToken = Keys<LogoGroup<"colorways">>;
export type LogoVariant = "mark" | "wordmark" | Keys<LogoGroup<"lockups">>;

type DataOf = RegisteredBrand extends { readonly data?: infer D } ? NonNullable<D> : {};
/** Every fact in the brand's data, as "group.key": "links.website", "locations.studio". */
export type FactName = {
  [G in Keys<DataOf>]: `${G}.${Keys<NonNullable<DataOf[G]>>}`;
}[Keys<DataOf>];

/** Relative extents. Fractions account for the parent's gap, so 1/2 + 1/2 always fills exactly. */
export type Fraction = "1/2" | "1/3" | "2/3" | "1/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5";
export type Extent = "auto" | "full" | Fraction | SizeToken;
export type Ratio = "1:1" | "4:3" | "3:2" | "16:9" | "21:9" | "3:4" | "2:3" | "9:16";
export type Anchor = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
export type Align = "start" | "center" | "end" | "stretch";
export type Justify = "start" | "center" | "end" | "between";
export type Columns = 1 | 2 | 3 | 4 | 5 | 6 | 12;

export const FRACTIONS: readonly Fraction[] = ["1/2", "1/3", "2/3", "1/4", "3/4", "1/5", "2/5", "3/5", "4/5"];
export const RATIOS: readonly Ratio[] = ["1:1", "4:3", "3:2", "16:9", "21:9", "3:4", "2:3", "9:16"];
export const ANCHORS: readonly Anchor[] = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"];
export const ALIGNS: readonly Align[] = ["start", "center", "end", "stretch"];
export const JUSTIFIES: readonly Justify[] = ["start", "center", "end", "between"];
export const COLUMNS: readonly Columns[] = [1, 2, 3, 4, 5, 6, 12];

/**
 * An image imported from a package's assets/. Only an import produces one, so
 * `<Image src="team.jpg">` does not type-check and a missing file cannot resolve.
 */
export type ImageAsset = string & { readonly __idedAsset: "image" };
