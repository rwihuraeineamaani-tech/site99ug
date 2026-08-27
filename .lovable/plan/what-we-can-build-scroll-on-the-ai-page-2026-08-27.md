# "What we can build" scroll on the AI page

Add a continuously scrolling band of buildable systems to `/ai-automations`, sitting between the Products section and the Positioning lines — so after seeing Kazi, a visitor immediately sees the breadth of systems Site 99 can build.

## The band

Two rows scrolling in opposite directions at slow speed, looping seamlessly, pausing on hover so a name can be read. Monochrome to match the page: white text on black, hairline-bordered chips, small dot separators. On mobile the rows stay but scroll slightly faster with smaller type; motion is disabled for users who prefer reduced motion.

Header above it: "What we can build" with a short line — "Custom systems, shipped fast."

## The list

Row A — business systems:
School management systems · Inventory & stock control · Point of sale · Booking & scheduling · CRM & sales pipelines · Invoicing & payments · HR and payroll · Fleet & logistics tracking · Membership & subscriptions · Church / NGO management

Row B — digital products & automation:
Event ticketing platforms · Customer support chatbots · WhatsApp automations · Document & PDF generation · Reporting dashboards · Data entry automation · Client portals · Marketplaces · Learning platforms · Internal admin consoles · Landing pages & campaign sites · API integrations between tools

Below the rows, one quiet line: "Not on the list? We build custom." with a link to the demo form.

## Technical notes

- New `src/components/ai/CapabilityScroll.tsx`: two rows, each rendering its list twice inside a `w-max` flex track animated with a CSS keyframe translate (same seamless-loop technique as the existing `Marquee`), second row reversed. Pause on hover via a `group-hover:[animation-play-state:paused]` style; respect `prefers-reduced-motion` by disabling the animation.
- Keyframes added in `src/index.css` under the existing utilities layer (`ai-scroll-left` / `ai-scroll-right`), scoped so they don't affect the home marquee.
- Item lists live as arrays in the component file so they're easy to extend later.
- Insert the section into `src/pages/AIAutomations.tsx` after the Products section, with the same `border-t border-white/10` and `px-8 md:px-16` rhythm as neighbouring sections.
- The closing line links to `#demo`.

No backend, routing, or existing-section changes.
