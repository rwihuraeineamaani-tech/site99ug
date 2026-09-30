# Whole-app mobile upgrade

## Goal
Make the public website and every signed-in portal feel deliberate and comfortable on phones, while keeping desktop layouts and all existing permissions and workflows intact.

## 1. Clean opening and sign-in
- Move access checking above the signed-in layout so the sidebar and top bar never appear while access is loading.
- Show only the large red Site 99 logo, centred and gently floating, during access checks across staff, client, resident, and talent entry points.
- Keep the actual sign-in form as the signed-out screen, with no public top navigation or footer and a compact phone-first layout.
- Prevent flashes between sign-in, loading, and the correct role-specific destination.

## 2. App-like signed-in phone shell
- Simplify the phone header to menu, Site 99 identity, notifications, and profile; keep the fuller identity, clock, calendar, and sign-out controls on larger screens.
- Add a fixed phone bottom bar for the most-used destinations: Home, To-Do/Work, Chat, Notifications, and profile; role-specific and department pages remain in the drawer.
- Make the drawer scroll safely, close after navigation, preserve collapsible sections and scroll position, and include settings/sign-out actions.
- Apply safe-area spacing for modern phones and ensure drawers, notifications, chat entry, and bottom actions do not overlap.

## 3. Shared phone patterns
- Tighten page headings and make action areas stack or scroll without clipping.
- Standardise 44px touch targets, 16px form fields, full-width primary actions where useful, and phone-sized dialogs or bottom sheets for focused forms.
- Make tabs, filters, segmented controls, status chips, and secondary actions horizontally scrollable or collapsible instead of wrapping into tall blocks.
- Keep the existing mobile card-row table pattern and extend it to remaining dense records; retain full tables on larger screens.
- Add stable widths and overflow containment so long names, amounts, links, charts, and diagrams never force sideways page scrolling.

## 4. Signed-in screen pass
- Optimise dashboards, role-specific graphs, To-Do, Work, Chat, Calendar, Content Pipeline, Shoot Days, Residents, Client Relations, Strategy, Sales, Legal, Finance, People, Talent, SOPs, Approvals, System Administration, and Settings.
- Keep Calendar on agenda view by default on phones and preserve month/week views for larger screens.
- Make Chat use the available phone height with a safe, reachable message composer.
- Keep financial controls and approval rules unchanged while making PIN prompts, invoices, cashbook entries, and action buttons usable one-handed.
- Preserve role-personalised dashboards and permissions; this work changes presentation and navigation only.

## 5. Client, resident, and talent portals
- Apply the same phone shell, touch targets, compact headings, horizontal tab handling, form treatment, and safe-area behavior.
- Keep each portal’s existing restricted data and navigation unchanged.
- Ensure portal loading also uses only the centred floating logo.

## 6. Public website mobile pass
- Refine the public header, full-screen menu, hero framing, media, typography, section spacing, project/resident rows, forms, event/ticket screens, and footer for narrow and standard phones.
- Reduce expensive decorative motion on phones while retaining the Site 99 visual identity and respecting reduced-motion settings.
- Prevent clipped headlines, oversized logos, menu overflow, accidental horizontal scrolling, and controls hidden behind browser bars.
- Keep all public content, imagery, routes, and desktop presentation intact.

## 7. Verification
- Check the opening logo state, signed-out login, and role landing flows without any navigation flash.
- Test representative public pages and every major signed-in section at 320px, 375px, 428px, tablet, and desktop widths.
- Exercise key phone flows: open/close drawer, switch pages, notifications, chat, calendar item, resident onboarding, content update, approval, Finance PIN, and settings.
- Check dark/light appearance, keyboard opening, safe areas, reduced motion, sideways overflow, runtime errors, and the preview build.

## Technical notes
- Reuse the current `AppLayout`/sidebar, shared page headers, mobile card-row tables, semantic theme tokens, and existing role-aware navigation.
- Place the access-loading gate above app chrome; do not duplicate authentication logic or weaken database permissions.
- Introduce shared mobile layout utilities/components only where they remove repeated fixes; preserve desktop behavior with responsive variants.
- No backend schema or business-rule changes are included.
