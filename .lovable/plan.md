# Make the work portal feel alive

Right now every control inside the signed-in area is the same flat, sharp-cornered rectangle in red or grey. Nothing reacts when you touch it and nothing tells you at a glance what kind of thing you're looking at. This pass gives the portal a modern, playful-but-professional feel without touching the public site.

## What changes

**Buttons feel physical**
- Softer, rounder shape (pill for the small action buttons, gently rounded for the big ones).
- A real press: they lift slightly on hover and sink on click, with a soft shadow underneath.
- Clear ranks: a solid red primary, a bold black one for secondary actions, a quiet outline, and a soft-tinted "ghost" that fills with colour on hover.
- Icons nudge on hover so the button feels responsive.

**Colour comes back**
- A working palette beyond red and grey: violet, teal, amber, blue and pink used consistently for statuses and content types.
- Each pipeline stage gets its own colour — Idea, Approved, Scheduled, Editing, Posted, Archived, Rejected — so the board reads instantly.
- Status chips become soft coloured pills instead of grey outlines.

**Board and lists feel like a work tool**
- Cards get a coloured left edge matching their stage, rounder corners, and lift while being dragged.
- Columns show a coloured header with a live count.
- Drop targets highlight while you drag over them.
- Table rows get a hover tint and rounded ends.

**Navigation and filters**
- Sidebar items become rounded pills; the active one gets a filled tint plus a small red marker.
- Search box and dropdown filters get the rounded, soft-filled treatment and a visible focus ring.
- The board/list switcher becomes a sliding pill toggle.

**Empty states** get a friendly line of copy and a coloured icon rather than bare text.

## Scope

Applies to the signed-in portal (dashboard, content, department pages, team, events) and the shared controls they use. The public site keeps its editorial look; only the shared button component is upgraded, which improves both without changing the public layouts.

## Technical notes

- Add accent tokens (`--accent-violet`, `--accent-teal`, `--accent-amber`, `--accent-blue`, `--accent-pink`) plus soft/foreground pairs to `src/index.css`, mapped in `tailwind.config.ts`.
- Extend `src/components/ui/button.tsx` with `soft`, `ink`, and `accent` variants, larger radius, `active:translate-y-px`, shadow, and `transition-all`; keep existing variant names working.
- Rework `StatusChip.tsx` to tone-based soft pills; export a stage → tone map used by `Content.tsx` for both board and list.
- Update `Content.tsx` card/column styling and drag-over state, `DataTable.tsx` row hover/radius, `FilterBar.tsx` inputs, `Segmented.tsx` sliding indicator, `AppShell.tsx` nav item styling.
- No database, routing, or permission changes.
