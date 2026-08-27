# Montserrat everywhere

Right now the site is mostly Montserrat, but two other fonts are still in play:

- **JetBrains Mono** — used by the `.tech` style on all the small uppercase labels (step numbers, tags, "PRODUCTS IN THE SECTOR", nav labels, admin chips, the AI page UI).
- **Archivo Black** — used by the 3D rotating "99" on the Philosophy page.

## What changes

1. `.tech` labels switch to Montserrat (medium weight), keeping the same uppercase + wide letter-spacing so all the small technical labels still read as labels — just no longer monospace.
2. The 3D "99" on Philosophy switches to Montserrat 900, which is the closest heavy block weight.
3. The Google Fonts import drops Archivo Black and JetBrains Mono, loading only Montserrat. Fewer font files = slightly faster page loads.

Nothing else changes — no layout, spacing, colors, or content edits.

## Technical notes

- `src/index.css`: update the `@import` URL to Montserrat only; change `.tech` `font-family` to Montserrat; verify `.display`, `.mono`, `.label` stay Montserrat.
- `src/pages/Philosophy.tsx`: replace the two inline `fontFamily: "'Archivo Black', ..."` values with Montserrat 900.
- Check `tailwind.config` for any leftover font family entries pointing at the removed fonts.
