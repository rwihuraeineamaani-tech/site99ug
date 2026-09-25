# KPI and pay system for management

A monthly pay and performance desk. Management (HR, MD, Operations Manager, Founders, Finance) set targets, weights and pay rules. Each person sees their own targets, score and expected earnings.

## 1. One Handler per client
- Each client has one **Handler**, who is also the contact person. Existing clients keep their current contact as the Handler. Extra handlers are removed, and the change is recorded in the access history.
- Every screen that says "contact" or "handler" (approvals, shoots, posting, weekly numbers, To-Do) now points to that one Handler.
- The data allowance goes to the Handler, because they run the client's social media.

## 2. Pay setup (management)
- **Base salary** for each person (UGX).
- **Head of department** flag, plus a head bonus amount. It is paid only when that head's targets are hit.
- **Rules**, editable by management: hit bonus +30%, head bonus +15%, miss penalty -30% (all of base salary), contract-end target bonus 10% of the full contract value, renewal +5%.
- **Allowances each month, typed by hand:** data allowance (Handlers only) and transport. The transport screen shows each person's shoot-day count next to the amount field.

## 3. Targets and KPI score
- Monthly targets per person: posted content, shoots, client numbers, work completed, a minimum KPI score, and custom targets.
- Heads of department: targets set by the MD or Operations Manager, then approved by Founders before they count.
- **KPI score** is a weighted mix of parts. Management sets the weight of each part (for example, work completed 30%):
  - Work assigned and completed: counts up
  - Work assigned and overdue or not done: counts down
  - To-Do tasks done
  - Content posted and shoots completed
  - Client numbers filled on time
  - Approvals handled on time
- **Target hit = every target met** (your choice). That means +30% of base salary, plus 15% for heads. If any target is missed, it is -30% of base salary.

## 4. Client contract bonus
When a client reaches its end-of-contract targets, the Handler earns 10% of the full contract value. If the client renews, they earn a further 5% (15% in total). Management confirms each case before it is paid.

## 5. Where people see it
- **My KPI tab** (every staff member): targets and progress, live score, "expected earnings" (based on where they are now) and "possible earnings" (if every target is hit), with a line-by-line breakdown.
- **How KPIs work tab**: explains every part in plain words, its current weight, and how to raise your score.
- **KPI desk** (management only): all staff with their scores, target status and expected pay; editing targets, weights, rules and allowances; Founder approval of head targets; closing the month, which locks the figures.
- Only management sees other people's pay. Everyone else sees only their own.

## Technical notes
- New tables (with GRANTs, RLS and updated_at triggers): `staff_pay` (user_id, base_salary_ugx, is_head, head_bonus_ugx, department), `kpi_settings` (single row: bonus/penalty percentages, component weights), `kpi_targets` (user_id, month, metric, target_value, approval_state, approved_by), `kpi_allowances` (user_id, month, data_ugx, transport_ugx, shoot_days), `kpi_contract_bonuses` (resident_id, user_id, contract_id, kind end/renewal, percent, amount, confirmed_by), `kpi_month_close` (month, snapshot jsonb, closed_by).
- Access: `is_kpi_manager()` covers founder, managing_director, operations_manager, hr and finance_ops, and has full access. Staff can read only their own rows. Only founders can approve head targets, enforced by a trigger.
- The single Handler is enforced by a unique (resident_id) index on handler rows in `client_assignments`. The migration drops non-contact rows and re-labels the contact as handler. The kind check and helper functions accept 'handler' only, and `residents.contact_user_id` and `residents.handler_user_id` are kept equal.
- `src/lib/kpiPay.ts` holds pure score and pay maths, reusing `leadershipTasks`, todo, content, shoot and metrics sources, with vitest tests.
- New pages: `/app/kpi` (My KPI and How it works) and `/app/kpi/desk` (management), plus sidebar entries. Assignment UI in Clients, Admin and TeamPanel is simplified to one Handler picker.
