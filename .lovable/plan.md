# Command Center hero for /ai-automations

Rebuild the AI page hero as a control-room panel that fills the frame and proves capability instead of describing it. Monochrome and Montserrat stay locked; copy stays the same.

## Structure (matches the chosen direction)

A bordered hairline panel filling the viewport, with three zones stacked top to bottom:

**Top** — a short rule beside the eyebrow `SITE 99 SECTOR`, then the headline `AI & AUTOMATIONS` set heavy and tight, breaking onto two lines.

**Middle — the system ledger** (the credibility builder). Label: `SYSTEM ARCHITECTURE ONLINE:`. Below it, hairline-separated rows of systems we build — School management, Inventory control, Ticketing engine, CRM & logistics, Booking engine, Billing automation — each with a status pill on the right. One row cycles to `ACTIVE` with a pulse while the others read `READY`, the active row advancing every couple of seconds so the panel reads as live. Hovering or tapping a row makes it the active one and brightens it.

**Bottom** — the line "Kazi means work. Systems that make it lighter.", then a centered `SCROLL TO AUDIT` cue with an animated running line that scrolls to the audit tool on click.

**Background** — a faint 40px coordinate grid plus a slow scanning line sweeping the panel, layered over the existing white particle field (kept, dimmed slightly so the grid reads).

## Behavior

- Ledger cycling pauses on hover/touch so a row can be read.
- Cursor/touch subtly shifts the grid and particle layer for parallax on desktop; disabled on mobile for performance.
- All motion respects reduced-motion: static grid, no scan line, no cycling.
- Mobile-first: panel fits within the small viewport, headline scales down, ledger rows stay legible, no horizontal overflow.

## Technical notes

- Rewrite the hero `<section>` in `src/pages/AIAutomations.tsx` to the panel layout; the back link, particle field, and every section below stay untouched.
- New `src/components/ai/SystemLedger.tsx`: array of system names, `useState` + interval for the active index, pause on pointer enter, click/tap to set active, Motion for the pulse and row transitions.
- Grid and scan-line keyframes added to `src/index.css` under the existing AI-scoped utilities (`ai-grid`, `ai-scan`), with a `prefers-reduced-motion` off-switch.
- Scroll cue keeps its existing anchor to the audit section.
- No backend, routing, or copy changes.
