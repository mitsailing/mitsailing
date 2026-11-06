# Legacy Password Reset Design

## Goal

Protect passwords created on the new website while the nightly legacy sync imports real legacy data, and guide existing users into a create-password flow before the new website goes live.

## Scope

This slice changes the legacy user import, user credential state, Better Auth password lifecycle hooks, and the sign-in entry point. It does not add a separate account lifecycle service or a new credential provider.

## Credential State

`User.newPasswordSetAt` is the set-once marker for the first new-site password:

- Null means the sailor still needs the go-live create-password flow.
- Non-null is the first time they set a password on this site (sign-up or password reset). Later resets and password changes leave that timestamp alone.

Better Auth's `account` credential row still holds the password hash. Legacy import must not create placeholder credential accounts. Better Auth creates a credential account during `/email-otp/reset-password` when one does not exist.

## Legacy Import

The legacy import should continue using temporary tables and bulk SQL. Imported legacy users are inserted as `User` rows only. `new_password_set_at` stays null for those rows.

Nightly sync must not insert, update, or delete Better Auth credential accounts. Once a user creates a password, the credential account stays owned by Better Auth.

## Login Flow

The login page always shows email and password together and submits through `authClient.signIn.email`.

Before Better Auth checks the password:

- Locked-out users still get the existing lockout response. No reset email is sent.
- Unknown emails fall through to the normal invalid-credentials result. No sign-up redirect.
- Known users with `newPasswordSetAt` null get a password-reset OTP and a `PASSWORD_RESET_REQUIRED` response. The form tells them to check email and set a new password.
- Known users with `newPasswordSetAt` set continue with normal password sign-in.

The first successful password reset (or sign-up) writes `newPasswordSetAt` once.

## Support Flow

Add a quick support action on the reset/create-password page for users who are not receiving the email. For this slice, send those reports to `ak@callred.com` using the existing transactional email infrastructure or a narrow helper, with no new admin UI.

## Email Copy

Keep Apple Mail OTP autofill simple by avoiding duplicate plaintext code blocks in reset-password OTP emails. The visible email body still contains the code and expiry once.

## Tests

Use TDD for each behavior:

- Legacy import SQL does not create placeholder credential accounts.
- Sign-in blocks null `newPasswordSetAt` users, sends a reset OTP, and does not count that rejection as a failed password attempt.
- First password reset and sign-up write `newPasswordSetAt` once and do not overwrite it later.
- Reset page support action sends a report to `ak@callred.com`.
