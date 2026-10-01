# Agent instructions

<!-- ided:start -->
## Design (ided)

Decks, documents, graphics, web mocks and the brand in `design/` are built with
[ide-design](https://github.com/trevin-lee/ide-design) (`ided`): token-only React checked like code. Before changing
anything there, run `ided rules` (the primitives and rules) and `ided brand` (every allowed value
and fact). If your agent has the ided skills (`ided setup` installs them), follow them. Every
value and fact comes from `design/brand/brand.ts`, every project explains itself in its
`DESIGN.md`, and `ided check` must pass.
<!-- ided:end -->
