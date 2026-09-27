# Daily Clock-In Manager (run by the MD)

## What people will see
- **Clock-in button** at the top of the Dashboard (and in the sidebar header on phone): "Clock in" in the morning, "Clock out" when leaving. Shows today's status: On time, Late (by X min), or Not clocked in.
- Optional short note when late ("Traffic at Kireka").

## What the MD gets — Operations → Clock-in
- **Today board**: everyone's status live — on time, late, not yet in, on leave/off day, clocked out, hours worked.
- **Settings the MD controls**:
  - Clock-in on or off for the company
  - Must people clock in before a set time? (e.g. 9:00 AM Kampala) + grace minutes (e.g. 10)
  - Working days (Mon–Fri, Mon–Sat, custom)
  - Who it applies to (everyone, or pick people to exempt — e.g. founders, freelancers)
  - Require clock-out, yes/no
  - Optional: only allow clock-in from the office location (phone location check) — off by default
  - How much it counts in KPI (small weight, default 5%)
- **Excuse / adjust**: MD can mark a day as excused (sick, shoot day, leave) so it doesn't count against the person; every change is logged.
- **Monthly report**: per person on-time %, late days, missed days, average arrival — CSV export.

## KPI effect (small)
- New KPI part "Attendance" = on-time days ÷ required working days in the month (excused days removed).
- Weighted lightly (default 5%, MD can change) so it nudges the score without outweighing real work.
- Shows in My KPI and the KPI desk alongside the other parts. Shoot days a person is crewed on count as present automatically.

## Who can do what
- Everyone: clock in/out for themselves, see their own history.
- MD (and System Admin): settings, today board, excuses, reports. Founders and Ops Manager can view.
- Clients and talent: nothing.

## Technical details
- Tables: `attendance_settings` (single row: enabled, cutoff_time, grace_min, work_days int[], require_clockout, geofence lat/lng/radius, exempt_user_ids, timezone 'Africa/Kampala'), `attendance_records` (user_id, day, clock_in_at, clock_out_at, status on_time/late/excused/absent, late_minutes, note, excused_by, excuse_reason, location). GRANTs + RLS: own rows for staff; `is_md`/system admin write settings/excuses; leadership read.
- RPCs `clock_in(note, lat, lng)` / `clock_out()` compute status server-side from Kampala time so times can't be faked; `excuse_attendance(user, day, reason)` MD-only, audited into activity_log.
- `kpiPay.ts`: add `attendance` component (weight default 5 in kpi_settings.weights), loader counts on-time days vs required days minus excused/shoot days.
- New page `src/pages/app/ops/Attendance.tsx`, sidebar entry under Operations; `ClockInCard` on Dashboard; help text + AGENTS.md rule.
