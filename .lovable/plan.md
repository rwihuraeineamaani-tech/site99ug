# Deepen the Automation Audit with work maps

Turn the 3-question audit into a short diagnostic that ends in a visual **work map** — a before/after picture of how the visitor's work flows today versus how it would run automated — plus estimated hours reclaimed and a phased build roadmap. Still no signup, still under a minute.

## New question flow (5 quick steps)

1. What does your business do? (existing categories, unchanged)
2. What takes up the most manual time? (existing multi-select, unchanged)
3. Roughly how many hours a week go into those tasks? (Under 5 / 5-15 / 15-40 / 40+)
4. What do you run it on today? (multi-select: WhatsApp, Spreadsheets, Paper / notebooks, Email, Existing software, Nothing yet)
5. Team size (existing, unchanged)

Progress indicator updates to 5 steps; a Back control is added so people can correct an answer.

## Result screen

**Reclaim estimate** — a single large ticking number: estimated hours per week recovered, derived from the hours band and how many pain points are selected, shown alongside "≈ X hours/week back" and a monthly equivalent. Framed as an estimate, not a promise.

**The work map** — for each selected pain point, one horizontal lane showing the flow:

```text
MANUAL TODAY      Enquiry ──▶ You read it ──▶ You reply ──▶ You log it
AUTOMATED         Enquiry ──▶ [ AI Support Desk ] ──▶ Logged + escalated
```

Each lane draws in on scroll/appearance: nodes fade in left to right, the automated row highlighted in white while the manual row sits dimmed, with the manual steps that disappear struck through. Built with divs, hairline connectors, and Motion staggering — no diagram library. On mobile the lanes stack vertically instead of flowing horizontally.

**Opportunity cards** — the existing suggestion cards stay, now showing up to 4 and each carrying an effort tag (Quick win / Core build / Deeper system).

**Build roadmap** — a compact 3-phase strip: Phase 01 quick wins, Phase 02 core system, Phase 03 intelligence layer, each with the specific items from their answers slotted in.

**CTA** — unchanged, plus a "Copy my audit" button that copies the result as plain text so the visitor can share it internally.

## Technical notes

- `src/components/ai/auditRules.ts`: add `HOURS_BANDS` and `TOOLS` constants, extend each suggestion with `effort`, `phase`, and a `flow: { manual: string[]; automated: string[] }` used to draw the map. Add `estimateHours(band, pains, team)` and `buildRoadmap(...)`. Existing maps and `buildAudit` keep their shape; `buildAudit` takes the new answers and returns up to 4 suggestions.
- New `src/components/ai/WorkMap.tsx`: renders the manual/automated lanes for a suggestion list, Motion staggered reveal, responsive stacking, respects reduced motion.
- `src/components/ai/AuditTool.tsx`: state extended for hours and tools, 5-step navigation with Back, progress fraction updated, result screen composed of reclaim number (count-up), `WorkMap`, cards, roadmap strip, CTA and copy button.
- Styling stays monochrome (white on black, squared hairline borders, Montserrat + `.tech` labels) and section placement on `/ai-automations` is unchanged. No backend changes.
