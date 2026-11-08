# Legacy Password Reset Design

## Goal

Protect passwords created on the new website while the nightly legacy sync imports real legacy data, and tell existing users why their old password fails the first time they use the new site.

## Scope

This slice changes the legacy user import, credential state, Better Auth password lifecycle hooks, and the sign-in entry point. It does not add a separate account lifecycle service, a new credential provider, or a user-table migration flag.

## Credential State

Better Auth's `account` table is the source of truth:

- A user with a `credential` account row and non-null `password` has set a password on this site.
- A user without that credential password has not set a password here yet and needs Forgot password / create-password.

Do not add a `User` boolean or timestamp that copies this fact. Legacy import must not create placeholder credential accounts. Better Auth creates a credential account during `/email-otp/reset-password` when one does not exist.

## Legacy Import

The legacy import should continue using temporary tables and bulk SQL. Imported legacy users are inserted as `User` rows only.

Nightly sync must not insert, update, or delete Better Auth credential accounts. Once a user creates a password, the credential account stays owned by Better Auth.

## Login Flow

The login page always shows email and password together and submits through `authClient.signIn.email`.

Before Better Auth checks the password:

- Locked-out users still get the existing lockout response.
- Unknown emails fall through to the normal invalid-credentials result. No sign-up redirect.
- Known users without a credential password get `MUST_SET_PASSWORD`. The form explains that the old password does not work on this site and points them to Forgot password. No reset email is sent automatically, and the rejection does not count as a failed password attempt.
- Known users with a credential password continue with normal password sign-in.

## Retirement

After the go-live window, when imported users have credential passwords (or the remaining cohort is small enough that support handles them), delete the `MUST_SET_PASSWORD` branch from the sign-in before hook and the matching form copy. There is no user column to drop.

## Support Flow

Add a quick support action on the reset/create-password page for users who are not receiving the email. For this slice, send those reports to `ak@callred.com` using the existing transactional email infrastructure or a narrow helper, with no new admin UI.

## Email Copy

Keep Apple Mail OTP autofill simple by avoiding duplicate plaintext code blocks in reset-password OTP emails. The visible email body still contains the code and expiry once.

## Tests

Use TDD for each behavior:

- Legacy import SQL does not create placeholder credential accounts.
- Sign-in blocks known users without a credential password with `MUST_SET_PASSWORD` and does not count that rejection as a failed password attempt.
- Reset page support action sends a report to `ak@callred.com`.
