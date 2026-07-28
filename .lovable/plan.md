## 1. Team accounts with selective access

Add four new roles alongside `admin`: **event_manager**, **scanner**, **viewer**, **site_editor**.

**Database**
- Extend the `app_role` enum with the four new values.
- Add a small `team_members` table (user_id, email, display name, created_by) so the console can list accounts — `auth.users` isn't directly readable from the app.
- Add a helper `has_any_role(_user_id, _roles[])` for policies, and update existing policies so:
  - events / tiers: admin or event_manager can write; everyone else read
  - orders / tickets: admin + event_manager write, viewer read-only, scanner limited to scan validation
  - projects / residents / announcements: admin + site_editor
- Grants on the new table for `authenticated` + `service_role`.

**Server**
- New edge function `admin-users` (service role, JWT validated in code, caller must be admin) with actions: `create` (email + password you set, email auto-confirmed), `set_roles`, `reset_password`, `delete`. Roles are validated against an allow-list so nobody can self-escalate.

**UI — new "Team" tab in the admin console**
- Table of members: email, roles as pills, created date.
- "New member" form: email, name, password, role checkboxes.
- Per-row: edit roles, reset password, remove.
- Route guards updated: `/admin/events` opens for admin/event_manager/viewer (viewer sees read-only — no confirm, no trash, no edit), `/admin/scan` for admin/event_manager/scanner, `/admin` for admin/site_editor. Sidebar items hide based on role.

## 2. Nav bar fix on public events pages

The fixed header's logo is `h-24 / md:h-36` plus padding (~136–184px tall), while `/events` starts content at `pt-28` (112px) and `/events/:slug` at `pt-24`. The logo and Menu button sit over the page title.

Fix: introduce a shared header-height spacing token and apply it to the public pages that start with text right under the nav (`Events`, `EventDetail`), so content clears the header at every breakpoint. Also shrink the logo slightly once scrolled so the header doesn't dominate the event hero.

## 3. Suggestions to upgrade the site

Ranked; none of these are in the plan above — tell me which you want next.

1. **Buyer self-service**: a "Find my tickets" page (email + order ref) so people can re-download tickets without emailing you.
2. **Finish email verification** for `notify.site99ug.com` — automatic ticket delivery stays broken until the DNS records are added; everything else is already built.
3. **Events list upgrade**: past/upcoming split, city + date filters, "sold out" and "few left" badges, and event JSON-LD so Google shows dates and prices in search results.
4. **Analytics**: sales-over-time chart, revenue by tier, and check-in rate on the admin dashboard.
5. **Performance/SEO**: convert the hero and gallery images to WebP with width-based srcsets — the JPGs are the heaviest thing on mobile.
6. **Discount / promo codes** and complimentary ticket issuing from the console.
7. **Waitlist capture** when a tier sells out.

## Technical notes
- Enum values must be committed before use, so this ships as two migrations (enum first, then policies).
- Password creation uses the service role inside the edge function only; no admin key ever reaches the browser.
- Viewer read-only is enforced in RLS as well as UI, not just by hiding buttons.
