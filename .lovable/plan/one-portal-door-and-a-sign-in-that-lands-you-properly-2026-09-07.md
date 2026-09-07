# One portal door, and a sign-in that lands you properly

## What changes for you

1. **Footer**: the "Resident Portal →" and "Admin Login →" links are replaced by a single **"Portal →"** link.
2. **One door**: that link goes to the single sign-in page. After you sign in, the system checks what you are and sends you to the right place:
   - team member → the studio dashboard
   - client → the client portal
   - resident → the resident portal
   - nobody recognised → a clear "this account has no access yet" message instead of silently dumping you on the home page.
3. **Residents keep their sign-up**: the sign-in page gets a small "New resident? Create an account" toggle so the old resident sign-up still works from the same page.
4. **Old addresses keep working**: `/residents/login` and `/admin/login` both send people to the one sign-in page.

## The reason you get bounced to the home page

After a successful sign-in the app navigates to your dashboard immediately, but the shared "who am I" record is still holding the signed-out state from before. The guard on the dashboard sees a person with no roles yet and, following its rule, sends them to the fallback address — the home page. Nothing is wrong with your account or password; it is a timing gap.

Fix: while the app is re-reading who you are, the guard waits instead of deciding. Two supporting changes make that reliable:
- the shared record marks itself as "loading" again whenever the signed-in person changes, and
- the sign-in page hands over as soon as the session exists, letting the shared record do the routing, rather than racing it.

## Technical notes

- `src/hooks/useMyRoles.ts`: in `useRolesState`, set `setLoading(true)` at the top of `load()` when `currentUser.current` differs from the incoming user (and on sign-out→sign-in), so `RequireRole` shows its wait state instead of evaluating empty roles. Keep the `TOKEN_REFRESHED` / same-user `SIGNED_IN` ignore list so tab switching still doesn't refetch. Handle `SIGNED_OUT` by clearing state.
- `src/components/system/RequireRole.tsx`: also treat "userId present but roles not yet loaded" as loading; only redirect to `landingPath` once a load has completed at least once for that user.
- `src/pages/Login.tsx`: after `signInWithPassword`, call `accept_client_invite` and `accept_resident_invite`, then compute the target from `user_roles` as today, but if the roles read returns nothing, retry once before falling back — and never navigate to `/` silently; show the "no access yet" toast and stay on the page.
- `src/pages/Login.tsx`: add a `signup` mode reusing the resident sign-up call from `ResidentLogin.tsx` (`supabase.auth.signUp` with `emailRedirectTo: ${window.location.origin}/login`), plus the existing forgot-password mode.
- `src/components/Footer.tsx` lines 63–64: replace the two links with one `<Link to="/login">Portal →</Link>`.
- `src/App.tsx`: `/residents/login` becomes `<Navigate to="/login" replace />` (the `/admin/login` redirect already exists); delete `src/pages/ResidentLogin.tsx` and its import.
- `src/pages/ResidentPortal.tsx`: change its three `navigate("/residents/login")` calls to `/login`.
- Public site styling is untouched apart from the single footer link swap.
