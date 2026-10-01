# Shared

Shared pieces for Acme's campaign work: components and images that more than one project uses,
kept out of the brand because they belong to campaigns, not to the identity.

## Purpose

Anything a second project would otherwise copy: a card for short announcements, campaign
photography. It exists so two projects that show the same thing show it the same way. Pieces
that every medium uses (the corner mark) stay in the brand; pieces only one project needs stay
in that project.

## Contents

- `Card`: a title and one or two lines of body on a surface, for grouped short items. Use it
  only when the items really are a set of equals; a single statement does not need a card.
- `photos/hero.png`: the campaign's lead image. Crop it with intent (`ratio`, `fit="cover"`)
  rather than showing it whole at small sizes.

## Rules

- Components take token-typed props, never raw values, so a caller cannot restyle them.
- A component earns a place here once a second project needs it, not before.
- Images are named for what they show, in kebab-case, and grouped in folders by subject.
