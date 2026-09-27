# Architecture rules

- The website editor uses `AdminShell`'s opt-in sidebar layout; other administration pages retain the shared tab layout so their navigation is unchanged.
- Website project client text is display-only; `residents.id` through `resident_projects` is the canonical identity, and only System Administrators resolve missing links.
- Job titles are display identity while `user_roles` holds private permissions; combined positions merge dashboard/sidebar modules and may be focused without changing access.- Client status is derived, not typed: `recompute_resident_lifecycle` sets `residents.status`/`lifecycle_status` from `resident_contracts` dates, onboarding steps and contract invoice payments (triggers + daily cron); people only set contracts to draft/signed/cancelled — so status, finance and KPI bonuses never drift apart.
