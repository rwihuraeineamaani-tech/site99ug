# AI & Automations — monochrome rebuild

Strip the electric-blue accent and the marketing chrome so the page reads as a single, high-end black-and-white system, and make the entry transition a true full-page morph.

## 1. Pure black & white
- Replace the `--ai-accent` blue with white: accent becomes white / greys / hairlines only. No colour anywhere on the page.
- Accent usage is re-expressed as contrast, not hue:
  - Primary buttons: solid white with black text; hover inverts to outlined white.
  - Active states in the audit tool: white border + white fill at low opacity, white text.
  - Labels, step numbers, tags: mono type in graded whites (`white/40`, `white/60`).
  - Result cards, product cards, form focus rings: white hairlines instead of blue.
- Particle field switches to white dots and white hairlines at very low opacity — sparse, slow, quiet.
- Remove the blue radial glow behind the hero; replace with a soft white vignette/haze.
- Selection colour, JSON-LD-adjacent styling and the theme-wipe gradient all go monochrome (black wipe with a faint white grain).

## 2. Remove the header logo / nav chrome
- The page no longer renders the site `Nav`. In its place, a minimal fixed header: a small mono wordmark-free back control (`← Site 99`) on the left, nothing else, fading in only after the first scroll.
- Keeps the page feeling like a standalone system rather than a page of the marketing site.

## 3. Full-page morph
- Rework the transition so it is a full-page morph rather than a circle wipe from the cursor:
  - The outgoing page scales down slightly and fades to black while a black plane rises to cover the full viewport.
  - The incoming AI page enters with a matched counter-scale + fade so the two feel like one continuous surface flip.
  - ~800ms, single eased curve, reduced-motion falls back to an instant navigate.
- The same morph plays on exit back to the light site so the return is symmetrical.

## 4. Restraint pass on the layout
- Tighten type scale and spacing: fewer decorative flourishes, larger silence between sections, hairline dividers only.
- Product carousel and bio card lose their tinted panels — flat black with hairline borders.
- Keep all existing content, copy, audit logic and the lead form/backend behaviour unchanged.

## Technical notes
- Files touched: `src/index.css` (AI theme tokens → monochrome), `src/pages/AIAutomations.tsx`, `src/components/ThemeWipe.tsx`, `src/components/ai/ParticleField.tsx`, `AuditTool.tsx`, `ProductCarousel.tsx`.
- `--ai-accent` stays as a token but is redefined to `0 0% 100%`, so no class renames are needed and the rest of the site is untouched.
- No backend, routing or form-logic changes.
