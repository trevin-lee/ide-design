# Changelog

## 0.9.0

- A reply that starts with "-" is sent as text, not read as an option.
- Each problem the extension cannot fix itself is shown once, and it recovers once fixed (for
  example after correcting `ideDesign.path`).
- It starts when `ided init` creates a workspace in a folder that is already open.
- Problems refresh whenever a file in `design/` changes, including edits an agent makes from a
  terminal, not only on save.
- Comment threads say which page or viewport a comment was left on.

## 0.8.0

No changes; the version follows ided's.

## 0.7.0

No changes; the version follows ided's.

## 0.6.0

No changes; the version follows ided's.

## 0.5.0

No changes; the version follows ided's.

## 0.4.0

Problems include the layout check (overflow, ratios, crops) that `ided check` runs from 0.4.0.

## 0.3.1

No changes; the extension's version follows ided's. Installs from Open VSX are documented.

## 0.3.0

First release: the viewer in a tab with ⌥-click to source and cursor following, `ided check` in
Problems, and viewer comments as comment threads with reply and resolve.
