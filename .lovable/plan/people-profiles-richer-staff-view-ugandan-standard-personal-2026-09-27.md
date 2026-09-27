# People profiles: richer staff view + Ugandan-standard personal records

## 1. People page (Management → People) becomes a real staff directory
Each person shows as a card (with list option):
- Photo, name, job title(s), department
- **Online now / last active** (e.g. "Active 12 min ago") from existing presence tracking
- **Chat** button (opens a direct chat) and call/WhatsApp link
- **KPI score** this month + trend, **clock-in** on-time % this month
- Workload: open tasks, late tasks, clients handled, content crew slots
- Filters: department, online, late work, low KPI, contract ending

Clicking a card opens a **person profile** with tabs.

## 2. Who sees what (three levels)
| Level | Who | Sees |
|---|---|---|
| Team view | Heads of department (for their department), Ops Manager | Card info above, work, KPI score, clock-in |
| Management | MD, Founders | + KPI breakdown, pay figures, targets, employment details, documents list |
| HR full file | HR, MD, Founders, System Admin | + ID numbers, NSSF/TIN, bank details, next of kin, medical notes, permits, disciplinary notes |

Everyone always sees and edits their own profile. Private fields are blocked in the database, not just hidden on screen.

## 3. Personal info people fill in (My Settings → My profile)
Standardised to Ugandan recruitment, with a foreign-national path:
- **Personal:** full legal name, preferred name, date of birth, gender, nationality, marital status, photo
- **Contact:** phone(s), personal email, home address (district, sub-county, village/area), emergency contact
- **Identity (Ugandan):** National ID (NIN), NSSF number, URA TIN
- **Identity (foreign nationals):** passport number, issuing country and expiry, work permit class + number + expiry, entry/special pass, Uganda TIN if any
- **Next of kin:** name, relationship, phone, address
- **Bank / mobile money:** bank, branch, account name and number, or MTN/Airtel number
- **Education & skills:** highest qualification, institution, year; languages; skills
- **Employment (HR fills):** start date, contract type (permanent, fixed-term, probation, intern, freelance), probation end, contract end, reporting line, department, work location, notice period
- **Health (optional, HR only):** blood group, allergies/conditions to know about
- **Documents upload:** ID/passport copy, CV, academic papers, LC1 letter, police clearance, signed contract, work permit

A **profile completeness bar** nudges people until required fields are done; HR sees who's incomplete.

## 4. HR tools
- HR "Staff files" view: completeness, missing documents, **expiry alerts** (work permits, passports, fixed-term contracts, probation ending) 60/30/7 days ahead to HR and the MD via notifications
- Private HR notes (warnings, commendations) with date and author
- Export staff register (CSV) for NSSF/URA/Labour office needs

## 5. Integration
- Profile photo and preferred name used everywhere (chat, sidebar, dashboards)
- Bank/mobile money pre-fills staff payment runs in Finance
- Contract end dates feed Operations Deadlines; expiries feed notifications
- HR dashboard gets "incomplete profiles" and "expiring documents" charts

## Technical details
- New tables: `staff_profiles` (1 row per user, personal/contact/education fields), `staff_private` (ID numbers, bank, next of kin, health, permits — HR-level RLS), `staff_employment` (HR-written employment fields, management read), `staff_documents` (storage refs, private bucket `staff-docs`), `staff_notes` (HR-only). All with GRANTs + RLS: owner read/write own rows (except employment/notes), `can_view_staff_private()` security-definer helper for HR/MD/Founder/Admin; heads via `staff_pay.is_head` + same department.
- Nationality drives which identity fields are required (Ugandan vs foreign).
- Expiry alerts: daily cron function writing to the existing notification/push outbox.
- People page rewritten into cards + profile drawer; reuses `loadKpiMonth`, `user_presence`, attendance records, and chat thread creation.
- AGENTS.md rule for the three visibility levels.
