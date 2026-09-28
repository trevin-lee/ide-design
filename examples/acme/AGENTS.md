# Agent instructions

<!-- ided:start -->
## Design (ided)

Decks, documents, graphics, web mocks and the brand in `design/` are built with
[ided](https://github.com/trevin-lee/ided): token-only React checked like code. Before changing
anything there, run `ided rules` (the primitives and rules) and `ided brand` (every allowed value
and fact), and follow the ided skills in `.agents/skills/` if your agent reads them. Every value
and fact comes from `design/brand/brand.ts`, every project explains itself in its `DESIGN.md`,
and `ided check` must pass.
<!-- ided:end -->
