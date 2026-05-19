# 08 - Remove Stale Auth Stack and Squash Prelaunch Migrations

## Goal

Remove the replaced authorization stack and clean prelaunch migration history
without hiding analyzer findings.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- Original plan headings:
  - `Task 15: Remove CASL Packages and Stale Authorization Code`
  - `Task 16: Migration History Cleanup`

## Scope

- Remove CASL packages and `@better-auth/prisma-adapter`.
- Delete stale CASL tests after equivalent appRole/ZenStack tests exist.
- Confirm migration-squash preconditions before editing migration history.
- Remove RolePermissionGrant and event `created_by` migration artifacts.

## Acceptance

- `rg -n "@better-auth/prisma-adapter|@casl|CASL|accessibleBy|ForbiddenError|parseRoles\\(" src tests package.json`
  returns no live matches.
- Migration search finds no RolePermissionGrant table and no Event `created_by`
  relation/index.
- No app-owned source files are excluded from analyzers just to hide findings.
