## Goals

1. Surface **Events** in navigation.
2. Make the **Policies** entry always visible on the buyer page (and clearer in admin).
3. Redesign the **Event detail page** into a world-class ticketing experience.

---

## 1. Navigation

**`src/components/Nav.tsx`**
- Add `{ to: "/events", label: "Events", n: "08" }` to the fullscreen menu `links` array (renumber Access to 09).
- Add `Events` to the desktop inline `inlineLinks` (before About) so the top nav reads: `Services ▾ · Events · About`.

## 2. Policy visibility

**`src/pages/EventDetail.tsx`**
- Make the **Policies tab always visible**; when empty, show a friendly placeholder ("Standard Site 99 event terms apply. No refunds after gate open.") instead of hiding the tab.
- Include a small "Policies" quick-link chip near the header CTA row so buyers see it before scrolling tabs.

**`src/pages/EventsAdmin.tsx`**
- The policy textarea exists but is buried in the form. Wrap event-form inputs into labelled sections (Details / Payments / Policies / Organizer / Template / Gallery) with clear headers so the Policy field is discoverable.

## 3. World-class Event detail redesign

Full restructure of `src/pages/EventDetail.tsx`:

**Hero**
- Full-bleed cover with gradient overlay, title in oversized display type, date/venue/age chips floating over the image.
- Sticky "Get tickets" CTA that scrolls to the tickets tab; on mobile it becomes a bottom bar with live total.

**Info strip** (below hero)
- 4-column meta row: Date · Doors · Venue · Age policy — using icons and mono labels.
- Share buttons (copy link, WhatsApp, X) and "Add to calendar" (.ics download generated client-side).

**Tabs** (About / Tickets / Policies / Gallery)
- Tabs become sticky under the header when scrolled.
- Policies always shown.
- Gallery upgraded to a masonry grid with lightbox (reuse existing `ProjectLightbox` pattern).

**Tickets tab**
- Two-column: left = tier cards, right = sticky order summary card (running subtotal, fees note, buyer form, payment method toggle, checkout button).
- Tier cards get: tier name, price, "X left" progress bar, on-sale window, sold-out state, quantity stepper with shake feedback (kept).
- Payment method segmented control shows disabled state with "Closed" label when a method is off.
- Success state (manual TID submitted) shown as a full-width confirmation card with next-step guidance.

**Organizer block**
- Moved into About tab as a distinct card with avatar-style initial, name, and social chips.

**Trust footer**
- Small row: "Secured checkout · MoMo & Airtel · QR ticket by email · Support office@site99ug.com".

**Motion & polish**
- Framer-motion fade-up on sections.
- Consistent `rounded-lg`, `border-border`, semantic tokens only (no hardcoded colors).
- Mobile: single column, sticky bottom CTA, tabs horizontally scrollable (already are).

---

## Out of scope
- No schema changes.
- No changes to edge functions or checkout logic — only presentation and buyer UX.
- Admin form gets grouping/labels only, no new fields.
