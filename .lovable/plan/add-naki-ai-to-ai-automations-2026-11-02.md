# Add Naki Ai to AI & Automations

## What you'll see
- A new **Naki** item in the AI & Automations menu and footer, next to Kazi.
- A Naki page (`/ai-automations/naki`) introducing Naki as Kazi's AI companion: what it does (ask, write, plan, learn, saved conversations), a short "how it works" strip, and a big **Open Naki** button that opens nakiai.site99ug.com in a new tab.
- A small "Meet Naki" card on the Kazi page linking to the new page.
- Copy follows house style: no dashes, specific lines, no filler.

## Technical details
- New `src/pages/ai/Naki.tsx` in the same style as `Kazi.tsx` (Seo, motion, existing tokens).
- Route `naki` added beside `kazi` in `src/App.tsx`; links added in `AINav.tsx` and `AIFooter.tsx`.
- External link `https://nakiai.site99ug.com` with `target="_blank" rel="noopener"`. No backend changes.
- Verify in the browser at mobile and desktop widths.
