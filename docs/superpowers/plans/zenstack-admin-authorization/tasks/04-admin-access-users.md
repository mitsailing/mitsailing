# 04 - Admin Access, Users, and Role Assignment

## Goal

Replace CASL/grant-based admin access with app auth context checks and route user
role assignment through guarded appRole actions.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/admin-list-usability.mdc`
- `.cursor/rules/ui-color-tokens.mdc`
- Original plan headings:
  - `Task 7: Replace CASL Route Gates With Auth Context Permission Checks`
  - `Task 8: Remove RolePermissionGrant and Roles Admin Page`
  - `Task 9: Add AppRole Assignment Through ZenStack With Better Auth Role Mirror`

## Scope

- Replace admin layout/nav/header/public-edit checks with app auth context.
- Delete `/admin/roles` endpoint, RolePermissionGrant application code, and stale role-grant tests. Note: Task 08 owns persistence-level cleanup (DB schema/migration files).
- Update user admin list/detail/edit/create/delete flows to use `appRole`.
- Add last-admin protection for demotion, ban, and delete.
- Add Better Auth role mirror rollback handling.
- Apply admin list usability rule to touched admin lists.

## Acceptance

- No live source imports `RolePermissionGrant`, role grants, or roles admin actions.
- User form editable role field is named `appRole`, not Better Auth `role`.
- Every touched admin list row exposes allowed actions without requiring horizontal
  scrolling to reach them.
- Last admin cannot be demoted, banned, or deleted.
