# Legacy Password Reset Design

## Goal

Protect passwords created on the new website while the nightly legacy sync imports real legacy data, and guide existing users into a create-password flow before the new website goes live.

## Scope

This slice changes the legacy user import, user credential state, Better Auth password lifecycle hooks, and the sign-in entry point. It does not add a separate account lifecycle service or a new credential provider.

## Credential State

Use Better Auth's existing `account` table as the source of truth:

- A user with a `credential` account row and non-null `password` has created a new-site password.
- A user without that credential row has not created a new-site password and should go through create-password.

Do not duplicate this with a `User` boolean. A separate field is only justified later for a different lifecycle, such as forcing a reset for users who already have valid credentials.

## Legacy Import

The legacy import should continue using temporary tables and bulk SQL. Imported legacy users are inserted as `User` rows only.

The import must not create placeholder credential accounts. Better Auth 1.6.13 creates a credential account during `/reset-password` and `/email-otp/reset-password` when one does not exist, so placeholder hashes only create ambiguity.

Nightly sync must not insert, update, or delete Better Auth credential accounts. Once a user creates a password, the credential account stays owned by Better Auth.

## Login Flow

The login page becomes email-first:

- Unknown email: route to sign-up with the entered email context where possible.
- Known user without a credential password: request a password reset OTP and route to `/reset-password` with create-password copy.
- Known user with a credential password: reveal the password field and submit through `authClient.signIn.email`.

The lookup should be a server action, not a public API route, to keep the database query server-only and avoid adding another auth route beside Better Auth.

## Support Flow

Add a quick support action on the reset/create-password page for users who are not receiving the email. For this slice, send those reports to `ak@callred.com` using the existing transactional email infrastructure or a narrow helper, with no new admin UI.

## Email Copy

Keep Apple Mail OTP autofill simple by avoiding duplicate plaintext code blocks in reset-password OTP emails. The visible email body still contains the code and expiry once.

## Tests

Use TDD for each behavior:

- Legacy import SQL does not create placeholder credential accounts.
- Login email lookup branches on Better Auth credential account existence.
- Login email-first branching handles unknown, reset-required, and active users.
- Reset page support action sends a report to `ak@callred.com`.
