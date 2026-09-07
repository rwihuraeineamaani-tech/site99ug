# Fix: error when creating a team member's account

## What is actually happening

The sign-in service is rejecting the password, not the email. The logs for the failed attempts show:

- the email already had an account, so the system moved on to taking that account over (as designed), then
- setting the password failed with "Password is known to be weak and easy to guess, please choose a different one."

The account creation stops there, and the message that reaches the screen is a generic "something went wrong" instead of the real reason, so it looks like a mystery error.

## What to change

1. **Show the real reason on screen.** Pass the service's own wording through to the form, so the person sees "This password is too easy to guess — pick a stronger one" instead of a generic failure.
2. **Warn before submitting.** Next to the password box, state the rule: at least 8 characters, and it can't be a common or leaked password. Add a "Suggest a strong password" button that fills in a random one that always passes, with a copy button so it can be shared with the new member.
3. **Say clearly when an existing account is being taken over.** If the email already exists, the success message should say the existing account was updated rather than a new one created.
4. **Keep the rest of the flow intact.** Name, title, access levels and client linking stay exactly as they are.

## Technical notes

- `supabase/functions/admin-users/index.ts` (`create` action): return failures with HTTP 200 plus an `error` field so the browser can read the text (currently the 400 makes the browser client surface only "non-2xx status code"). Map the auth service's weak-password and email-exists messages to plain sentences. Return a `reused: true` flag when an existing account was adopted.
- `src/pages/app/Team.tsx` and `src/components/admin/TeamPanel.tsx`: read the returned message, show password guidance under the field, add the generate/copy helper, and vary the success toast on `reused`.
- Redeploy the `admin-users` function after the change.
- Password strength checking (breached-password blocking) stays switched on — it is a security feature; the fix is better guidance, not disabling it.
