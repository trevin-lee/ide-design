// JSX types for artifacts (`jsxImportSource: "ided"`). Identical to React at
// runtime, but with no intrinsic elements: `<div>`, `<span>` and `<svg>` are
// type errors. An artifact is built from ided primitives and components only.

import type * as React from "react";

export { jsx, jsxs, Fragment } from "react/jsx-runtime";

export declare namespace JSX {
  type ElementType = React.JSXElementConstructor<any>;
  type Element = React.JSX.Element;
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  // Deliberately empty.
  interface IntrinsicElements {}
}
