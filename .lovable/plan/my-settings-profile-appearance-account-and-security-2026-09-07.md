# My settings: profile, appearance, account and security

A new **Settings** area inside the signed-in system, reachable from the top bar (name/initials menu) and the side menu, at `/app/settings`. Staff only. Four tabs.

## Profile
- Your initials avatar, your name and job title, editable and saved to your team record.
- Your email and your roles shown read-only, with a line saying an admin changes roles.
- Saving updates the name shown in the greeting on the board, the team list and anywhere your name appears.

## Appearance
- Dark (default), Light, or Match my device.
- The choice is remembered on your account, so it follows you to any device, and is applied instantly across the whole signed-in system — including the slide-out menu and pop-up panels on a phone.
- The public website is untouched by this.

## Account
- Read-only summary: email, roles, when you joined, and the departments you can reach.
- A "who to ask for more access" line naming leadership.

## Security
- Change password: current password, new password, confirm. Clear success and error messages.
- Change email address: enter the new address; a confirmation link goes to it and the change only takes effect once clicked. Until then the old address keeps working.

## Technical notes

**Database (one migration)**
- Add to `public.team_members`: `theme text not null default 'dark'` with a check of `dark|light|system`.
- New policy: a user may update **their own** row (`user_id = auth.uid()`), plus a `BEFORE UPDATE` trigger that rejects self-edits to `user_id`, `email` and `created_by` — only admins may change those. Admin-manage policy stays as is.
- Add the matching `GRANT UPDATE ON public.team_members TO authenticated` if not already present.

**Frontend**
- `src/pages/app/Settings.tsx` — tabbed page built from the existing deck primitives (`DeckHeader`, `DeckPanel`).
- `src/hooks/useMe.ts` — loads the signed-in user's `team_members` row (name, title, theme) and exposes an update function; used by the shell for the greeting and initials.
- `src/hooks/useTheme.ts` + light token block in `src/index.css`: a `.deck.deck-light` override set for `--paper`, `--ink`, `--rule`, panel and signal tokens. `AppShell` applies `deck` plus, when light, `deck-light` to both the shell root and `document.body` (the body class already exists for portals). `system` follows `prefers-color-scheme`. The choice is cached in `localStorage` so there is no flash before the account preference loads.
- Route `/app/settings` in `src/App.tsx` behind the existing staff gate; link added to the side menu and to a small avatar/initials menu in the top bar next to the clock.
- Password change: `supabase.auth.updateUser({ password, current_password })`. Email change: `supabase.auth.updateUser({ email })`, telling the user to confirm from the new inbox.
