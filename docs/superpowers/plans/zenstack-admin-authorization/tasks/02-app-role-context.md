# 02 - AppRole Permission Context

## Goal

Make `User.appRole` the application authorization source and replace multi-role
parsing with a small single-role permission map.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- Original plan heading: `Task 4: Add AppRole and Single-Role Permission Helpers`

## Scope

- Add `appRole` to ZModel `User`; keep Better Auth `role` as compatibility mirror.
- Create `src/libs/auth/appPermissions.ts` and tests.
- Simplify `src/libs/auth/roles.ts` to single-role normalization.
- Remove `EVENTS_CREATE`; use `EVENTS_MANAGE`.

## Acceptance

- Unknown, blank, comma-separated, or malformed roles fail closed to `user`.
- Admin receives all app permissions.
- Staff roles receive only explicit permissions in the map.
- `rg -n "EVENTS_CREATE|parseRoles\\(" src tests` returns no live source matches.
