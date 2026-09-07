# Staff management, client assignment and retainer splits

Turn the team page into a proper HR desk: add a person, give them a login, set what they can reach, give them a title — then assign them to clients as contact or handler, and split each client's monthly retainer between the people on it, with the balance landing on Site 99.

## 1. Adding a person

One form: name, email, preset password, job title (free text, e.g. "Head of Production"), and the access levels they need. Saving creates the account immediately — you share the password with them directly, and they can change it once inside.

On each person's row: their title under their name, their access levels, the clients they're on, and buttons to edit access, edit title, reset password or remove them.

## 2. Clients: one contact, many handlers

Each client (resident) gets an assignment panel, editable by management and founders:

- Exactly one contact person — required, replacing the current single pick.
- Any number of handlers — added and removed freely, at least one recommended but not forced.
- Saving is blocked if a contact isn't set, and a client can't be left with two contacts.

Everything that today reads "the contact" or "the handler" (approvals, shoot scheduling, posting, weekly account numbers, the "Waiting on you" list) keeps working, now reading the new assignments — any of the handlers can act on the handler steps.

## 3. Retainer and shares

On the client, management records a planned monthly retainer amount (UGX). Below it, each assigned person gets a line with either a fixed amount or a percentage of the retainer — chosen per person.

The panel always shows, live:

```text
Monthly retainer          1,500,000
  Aine — contact            300,000
  Brian — handler          15%  225,000
  Cissy — handler           200,000
Site 99 balance             775,000
```

The balance can't go negative — the panel warns and blocks saving if the shares exceed the retainer.

## 4. Who sees the money

- Founders, Managing Director and Finance/Ops see every client's retainer and every share, and are the only ones who can change them.
- Everyone else sees only their own line — what they personally earn on the clients they're on — as a small "Your monthly retainer share" strip on their dashboard. They never see the retainer total or anyone else's share.

## Technical notes

- `team_members` gains `title text`; `useMyRoles` prefers it over the role label for the top-bar title; `admin-users` accepts and updates it on create and on a new `set_profile` action.
- New table `client_assignments` (`resident_id`, `user_id`, `kind` = `contact` | `handler`, `share_amount_ugx int`, `share_percent numeric`, timestamps + update trigger). Unique partial index enforces one contact per resident; unique `(resident_id, user_id)` prevents duplicates. GRANTs, RLS on, policies: leadership/finance full write; a staff member may read only rows where `user_id = auth.uid()`; leadership/finance read all.
- `residents` gains `retainer_ugx int`. Readable by leadership/finance only — exposed through a security-definer function rather than a direct column read, so the existing resident policies keep staff out of the figure.
- `residents.contact_user_id` / `handler_user_id` stay in place and are kept in sync from the assignments (contact, and the first handler) so `content_stage_guard`, `can_touch_resident_accounts`, `my_pending_account_weeks` and `resident_options` need no rewrite; handler checks in those functions are widened to "any assignment of kind handler".
- UI: `src/components/admin/TeamPanel.tsx` (title field, per-member client list), a new assignment + retainer panel on `src/pages/app/Clients.tsx`, the resident form in `src/pages/Admin.tsx` switched to the new assignment source, and a personal-share strip on `src/pages/app/Dashboard.tsx`.
- Content, shoots and metrics handler checks updated to accept any handler on the client.
