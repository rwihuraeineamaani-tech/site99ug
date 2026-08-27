# Turn AI & Automations into its own site-within-the-site

Give the AI sector its own shell, its own navigation, and its own set of deeper pages — so entering `/ai-automations` feels like arriving at a separate product website rather than one long page. Everything stays monochrome, Montserrat, black theme, with the morph transition on the way in and out.

## The AI shell

A shared layout used by every AI page:

- A slim top bar with `SITE 99 / AI` on the left and the AI nav on the right: Overview · Systems · Kazi · About · Contact. Current page is marked with a hairline underline. On mobile it collapses to a compact menu row.
- A quiet `← back to Site 99` link that morphs back to the main site.
- The animated particle field and grid persist across all AI pages, so navigating within the sector feels continuous.
- A shared AI footer: the powered-by Site 99 lockup, info@site99ug.com, and links back to the main site.
- Moving between AI pages fades/slides rather than reloading the theme — the black morph only fires when crossing into or out of the sector.

## New pages

**/ai-automations (Overview)** — stays the entry point: command-center hero, the automation audit, a trimmed teaser of systems and Kazi that link into the deeper pages, and the demo form. Longer sections move to their own pages so this page gets shorter and sharper.

**/ai-automations/systems** — the full catalogue. Each buildable system (school management, inventory, ticketing, CRM, booking, billing, dashboards, chatbots, portals, and the rest) gets a card with a one-line description, what it replaces, and typical build phase. Grouped into Business systems / Digital products / Automation layers, with the existing scroll band at the top.

**/ai-automations/kazi** — a dedicated Kazi Intelligent Systems page: purple Kazi mark (the only purple on the site), the brand-sheet copy, what it does, the faint star motif, `_work made easier_`, powered-by lockup, and a CTA into the demo form. "More products coming soon" cards sit at the bottom.

**/ai-automations/about** — the sector's own about page, separate from the main site's About: what the AI sector is, how we work (a short 4-step process — audit, map, build, maintain), the engineer bio for Rwihura Eineammani expanded slightly, and the positioning lines as scroll reveals.

**/ai-automations/contact** — the demo request form on its own page with the direct email beside it, plus a short "what happens next" list. The audit result CTA and every "Request a demo" button point here.

## Technical notes

- New `src/components/ai/AILayout.tsx` wrapping an `<Outlet />`: `ai-theme` wrapper, `ParticleField`, grid, `AINav`, `AIFooter`. New `src/components/ai/AINav.tsx` and `AIFooter.tsx`.
- `src/App.tsx`: nest the AI routes under a layout route at `/ai-automations` with an index route plus `systems`, `kazi`, `about`, `contact` children. Internal AI links use plain `Link`; entry/exit links keep `WipeLink`.
- New pages under `src/pages/ai/`: `Overview.tsx` (the trimmed current page), `Systems.tsx`, `Kazi.tsx`, `About.tsx`, `Contact.tsx`. Existing components (`AuditTool`, `WorkMap`, `CapabilityScroll`, `ProductCarousel`, `PoweredByLockup`, `SystemLedger`) are reused, not duplicated. The lead form moves into a reusable `AILeadForm` component used by Contact and the overview CTA.
- Each page gets its own `Seo` title/description/path; all five URLs added to `public/sitemap.xml`.
- Page-change transitions handled with `AnimatePresence` keyed on pathname inside the layout.
- No backend or database changes — the same `ai_leads` insert and notification function are reused.
