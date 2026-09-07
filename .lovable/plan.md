# Stop the "Checking access…" flash and the reload on tab switch

Both problems come from the same thing: the sign-in check is re-run from scratch by every part of the screen, every time, instead of being worked out once and remembered.

## What's happening now

On a single page the access check runs five separate times — the page guard, the sidebar, the top bar, and the page itself each ask the server "who is this, and what may they see?" independently. Each one starts in a "Checking access…" state, so moving between sections shows that message again even though nothing about the person changed.

Each of those five also listens for sign-in events. When you leave the browser tab and come back, the session token is quietly renewed in the background, which fires that event — so all five ask the server again at once, and the page appears to reload.

## The fix

- Work out who you are and what you may see **once**, when the app opens, and share that answer with every part of the screen.
- Show "Checking access…" only on that very first check. After that, switching sections is instant.
- Ignore background session renewals and window-focus events — the answer only changes when you actually sign in, sign out, or someone changes your access, and the pages already refresh on those.
- Sections keep the records they already loaded when you leave and come back to the browser tab, instead of reloading them.

## Technical notes

- Add `RolesProvider` (React context) in `src/App.tsx` wrapping the routed tree; move the current body of `useMyRoles` into it so there is exactly one `getUser` + `user_roles` + `team_members` fetch and one `onAuthStateChange` subscription for the whole app.
- `useMyRoles()` keeps its exact current return shape and becomes a `useContext` read, so none of the ten call sites change.
- In the single subscription, ignore `TOKEN_REFRESHED` and `INITIAL_SESSION`, and treat `SIGNED_IN` as a no-op when the user id matches the one already held; only `SIGNED_OUT`, `USER_UPDATED` and a genuine user change trigger a refetch. `loading` is set true only on the first load, never on refetches.
- `useMyAssignments` gets the same treatment (folded into the same provider) so it isn't refetched per page either.
- No database or policy changes — access is still enforced server-side by row-level security; this only changes how often the client asks.
