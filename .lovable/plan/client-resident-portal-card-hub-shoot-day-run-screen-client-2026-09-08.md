# Client (resident) portal: card hub, shoot day run screen, client money pot

Residents are clients. The client page becomes a set of tappable cards. A card is a summary only — no editing on the card itself. Tapping a card opens that part in full. Money splits stay in Management, contracts stay in Legal; the client page only shows them and links across.

## The client page

Header stays as it is (logo, name, since, status, contact, handler, portal). Below it, a grid of cards:

| Card | What it shows at a glance | What opens |
| --- | --- | --- |
| Accounts | Live handles per platform, weeks waiting to be filled | Full accounts panel |
| Content | Pieces in motion, posted this month | Content list for this client |
| Shoot days | Next day, last day, days wrapped | Shoot days for this client, and the run screen |
| Money pot | Balance left, last top-up | Top-ups and spend, per day and in total |
| Contracts | Active or not, end date | Read-only list, with a link to Legal |
| Brand | Fonts and colours set or not | Brand guidelines in full |
| Strategy | Plan sign-off state, live goals | Existing strategy page |
| Retainer & splits | Retainer figure and who shares it (finance and leadership only) | Link to Management, no editing here |
| Notes | First line of the internal note | Notes in full |

Each opened part is a full view on the same page (`/app/residents/:id/:part`) with a back link to the cards, so it works on a phone at a shoot.

## Shoot day run screen

One screen, reached from the client's Shoot days card and from the Shoot days page — same screen, same behaviour: `/app/shoots/:dayId`.

It holds:

- The essentials at the top: date, call time, location, client, crew, gear, brief status.
- **The shot list.** Every planned piece for the day. For each one the crew records: shot, partly shot, or not shot; a short note when something is missed; and where the footage went (card, drive or a link). The day cannot be wrapped until every piece has an outcome.
- **Spend on the day.** Each spend line records amount, what it was for, and who paid it — the studio or the client. Studio lines can be pushed to the cashbook by finance; client lines draw down the client's money pot.
- A running total for the day: studio spend, client spend, and what is left in the pot.

## The client money pot

Two levels, as agreed:

- **Client pot** — operations add money in (top-up), with method, reference, date and an optional receipt. Balance = money in, minus every client-paid spend line, minus refunds.
- **Per shoot day** — each day shows what it drew from the pot, so a day can be read on its own without losing the overall balance.

Who can do what:

- Add money in or refund: founders, MD, finance, the client's handler, and the client's contact person.
- Log spend on a day: the same people, plus anyone on that day's crew.
- Everyone on staff can see the balance and the history; clients see their own pot in the client portal.

Any spend that would take the pot below zero is still recorded but flagged as over the pot, so nothing is quietly lost.

## Technical notes

Database (one migration):

- `client_funds` — resident_id, direction (`top_up` / `refund`), amount_ugx, received_on, method, reference, note, attachment_path, optional shoot_day_id, added_by, timestamps. Grants, RLS: staff read, write limited to the roles above via existing `is_staff`, `can_see_finance`, `is_resident_handler`, `is_resident_contact` helpers.
- `shoot_spend` — shoot_day_id, resident_id, payer (`studio` / `client`), amount_ugx, category, note, attachment_path, spent_by, spent_on, optional cashbook_entry_id, timestamps. Grants, RLS: staff read, write for the fund roles plus `is_shoot_crew`.
- `shoot_day_items` gains: outcome (`planned` / `shot` / `partly` / `missed`, default `planned`), outcome_note, footage_where, outcome_by, outcome_at.
- `client_pot_balance(_resident_id uuid)` — security definer, returns money in minus client spend.
- `finish_shoot_day` gains a guard: refuse to wrap while any item is still `planned`.

Front end:

- `src/lib/clientMoney.ts` — pot types, loaders, balance maths, top-up and spend writers.
- `src/pages/app/ResidentRecord.tsx` rewritten as the card hub; each part becomes a small component under `src/components/residents/` (accounts, content, shoots, money, contracts, brand, notes) so the shoot-day screen can reuse the money part.
- `src/pages/app/ShootDay.tsx` — the run screen, routed at `/app/shoots/:dayId`; the Shoot days list and the client card both link to it.
- Routes added in `src/App.tsx`; existing per-client Strategy route untouched.
- No changes to Management splits or Legal contracts beyond linking to them.
