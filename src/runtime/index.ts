// The `ided` module: the only import an artifact is allowed to make.

export {
  Slide,
  Page,
  Artboard,
  Screen,
  Stack,
  Row,
  Grid,
  Box,
  Place,
  Text,
  Em,
  FrameNumber,
  Fact,
  Equation,
  List,
  Logo,
  Image,
  Divider,
} from "./primitives.tsx";

export type {
  RootProps,
  StackProps,
  RowProps,
  GridProps,
  BoxProps,
  PlaceProps,
  TextProps,
  EmProps,
  FrameNumberProps,
  FactProps,
  EquationProps,
  ListProps,
  LogoProps,
  ImageProps,
  DividerProps,
} from "./primitives.tsx";

export type {
  Register,
  ColorToken,
  SurfaceToken,
  SpaceToken,
  RadiusToken,
  StrokeToken,
  SizeToken,
  ShadowToken,
  TypeToken,
  LogoSizeToken,
  ColorwayToken,
  LogoVariant,
  Fraction,
  Extent,
  Ratio,
  Anchor,
  Align,
  Justify,
  Columns,
  ImageAsset,
  FactName,
} from "./tokens.ts";

export { defineBrand } from "../shared/brand-schema.ts";
export type { BrandInput } from "../shared/brand-schema.ts";
export type { BrandFacts, Location, FactFormat } from "../shared/brand-facts.ts";

/** Type for a component's `children` prop. */
export type Children = import("react").ReactNode;
