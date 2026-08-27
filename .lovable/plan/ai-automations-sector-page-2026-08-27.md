# AI & Automations sector page

A new dark-themed sector page at `/ai-automations`, framed as Site 99's AI & Automation arm — with Kazi Intelligent Systems as one product inside it, not the headline. Real motion throughout: an animated light-to-black transition on entry, a live particle-network background, and an interactive business audit tool.

## 1. Navigation
- Add "AI & Automations" to the main nav (desktop inline links, mobile menu overlay, and the numbered link list).
- The existing Services dropdown item `/services#ai-automation` gets repointed to the new page.

## 2. Homepage teaser
- A compact dark panel placed immediately after the hero on the homepage: headline "Site 99 AI & Automations", one line "The AI systems Site 99 builds to make businesses run smarter.", and an "Explore" button.
- Rendered near-black inside the light page so it previews the theme shift; the Explore button triggers the same transition as the nav link.

## 3. Theme transition (real animation)
- A global overlay component: on click of any AI & Automations link, capture the click coordinates, expand a black radial circle from that point over the whole viewport (~750ms, eased), navigate mid-sweep, then fade the overlay out on the new page.
- Built with Framer Motion (already in the project) plus a CSS `clip-path` circle; respects reduced-motion (instant navigation instead).

## 4. `/ai-automations` page (black theme)
Sections top to bottom:

1. **Hero** — "AI & Automations" + "Kazi means work. Systems that make it lighter." + scroll cue. Nothing else.
2. **Business audit tool** (the page's centrepiece, largest section):
   - Step 1: business category buttons (Retail/E-commerce, Services, Events, Education, Hospitality, Other).
   - Step 2: multi-select pain points (Customer replies/support, Scheduling/bookings, Data entry, Invoicing/payments, Social media/content, Reporting).
   - Step 3: team size (Just me, 2–10, 11–50, 50+).
   - Result card: 2–3 automation opportunities from a rule-based mapping table in code (pain point + category + team size modifiers), plus CTA "Want us to build this for you?" that scrolls to the contact form.
   - Monospace step labels, progress bar, slide/fade transitions between steps, no signup.
3. **Product showcase** — a smaller horizontal carousel below the tool: one Kazi Intelligent Systems slide ("Intelligent workflow systems, powered by machine learning and AI." + "Learn more") and 2 blurred non-clickable "More products coming soon." cards.
4. **Positioning strip** — 4 short lines revealed on scroll (fade/slide), no paragraphs.
5. **About** — small understated bio card: Rwihura Eineammani, Lead Engineer, undertaking a Bachelor's degree in Engineering, Robotics and Artificial Intelligence.
6. **Contact / demo** — name, company, email, "What would you like to automate?"; button "Request a Demo"; beside it "or email us directly at info@site99ug.com".

**Animated background**: a canvas particle field (sparse slow dots joined by faint accent lines) running on requestAnimationFrame, capped particle count and paused when off-screen/reduced-motion, fewer particles on mobile.

## 5. Design
- Near-black background, single accent: electric blue. Montserrat for text, JetBrains Mono (already loaded) for labels, step numbers and tags.
- Page-scoped dark tokens so the rest of the site's light theme is untouched.
- Fully responsive, mobile-first — tap targets, single-column audit tool, reduced particle density.

## 6. Backend for the demo form
- New `ai_leads` table (name, company, email, message, created_at) with RLS: anonymous insert allowed, reads restricted to admin/site_editor staff roles, plus the required GRANTs.
- A `send-ai-lead-notification` edge function emails the submission to info@site99ug.com, mirroring the existing access-request notification.
- Note: automated sending still depends on the pending `notify.site99ug.com` DNS verification; until it verifies, submissions are stored safely and the visible "email us directly" mailto link is the guaranteed path.

## 7. SEO
- Unique title/description via the existing `Seo` component, JSON-LD `Service` entry, and `/ai-automations` added to `sitemap.xml`.

## Technical notes
- New files: `src/pages/AIAutomations.tsx`, `src/components/ai/ParticleField.tsx`, `src/components/ai/AuditTool.tsx`, `src/components/ai/ProductCarousel.tsx`, `src/components/ThemeWipeLink.tsx`, `src/components/ai/auditRules.ts`.
- Edited: `src/App.tsx` (route), `src/components/Nav.tsx`, `src/pages/Index.tsx` (teaser), `public/sitemap.xml`.
- Audit logic is pure client-side mapping — no AI call — so results are instant.
