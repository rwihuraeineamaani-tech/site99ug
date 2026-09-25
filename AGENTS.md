# Architecture rules

- The website editor uses `AdminShell`'s opt-in sidebar layout; other administration pages retain the shared tab layout so their navigation is unchanged.
- Website project client text is display-only; `residents.id` through `resident_projects` is the canonical identity, and only System Administrators resolve missing links.