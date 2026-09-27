# Architecture rules

- The website editor uses `AdminShell`'s opt-in sidebar layout; other administration pages retain the shared tab layout so their navigation is unchanged.
- Website project client text is display-only; `residents.id` through `resident_projects` is the canonical identity, and only System Administrators resolve missing links.
- Job titles are display identity while `user_roles` holds private permissions; combined positions merge dashboard/sidebar modules and may be focused without changing access.- Client status is derived, not typed: `recompute_resident_lifecycle` sets `residents.status`/`lifecycle_status` from `resident_contracts` dates, onboarding steps and contract invoice payments (triggers + daily cron); people only set contracts to draft/signed/cancelled — so status, finance and KPI bonuses never drift apart.
- Every outgoing payment (except loan payouts) is an approved bill in `invoices`: approving a money request or monthly-run line raises it, paying it marks the source paid — so the payment board, cashbook and filing read one path.
- Staff and portal pages render inside one persistent `AppLayout` route (AppShell becomes a pass-through when nested) so the sidebar never remounts on navigation.
- Talent portal accounts carry only the `user` role and are recognised through `talent_users` (`my_talent_id()`), so talent never gets staff access; confirmed talent bookings raise bills through `raise_bill_for_source('talent_booking')` like every other outgoing payment.
- Client onboarding runs from one 9-step checklist (`start_resident_onboarding`); steps flagged `requires_md_approval` can only be completed through `approve_onboarding_step` (trigger-enforced), and the handover sign-off marks the client onboarded.
- SOPs live in `sops` (+ `sop_versions`, `sop_reads`); only System Admin/Founders write them (RLS), and `publish_sop` snapshots each published version so staff re-confirm reading.
