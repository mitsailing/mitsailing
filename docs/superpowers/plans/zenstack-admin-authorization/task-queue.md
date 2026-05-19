# Task Queue

The conductor updates this file after each worker. Workers should not reorder the
queue.

- [x] 00 - Rules and context cleanup
  - Completed in this planning/control-plane pass.
- [x] 01 - Dependency and ZModel foundation
  - Packet: `tasks/01-zmodel-foundation.md`
  - Reasoning: high
  - Status: completed.
  - Changed files: `.oxfmtrc.jsonc`, `.oxlintrc.json`, `knip.config.ts`,
    `package.json`, `package-lock.json`, `prisma/schema.prisma`,
    `zenstack/schema.zmodel`, `zenstack/schema.ts`, `zenstack/input.ts`,
    `zenstack/models.ts`.
  - Commands run: `npx --no-install zen check --schema zenstack/schema.zmodel`
    failed before install as expected; `npm install ... --legacy-peer-deps`;
    `npx zen check --schema zenstack/schema.zmodel`; `npx zen check`;
    `npx zen generate --schema zenstack/schema.zmodel`; `npx prisma generate`;
    `npm run lint`; `npm run check:types`; `git diff --check`;
    conductor reran `npx zen check --schema zenstack/schema.zmodel`,
    `npx prisma validate --schema prisma/schema.prisma`, and `npm ls kysely
    --depth=4`; dependency-blocker worker reran plain `npm install`, `npm ls
    kysely --depth=4`, `npx zen check --schema zenstack/schema.zmodel`, `npx zen
    generate --schema zenstack/schema.zmodel`, `npx prisma generate`, `npm run
    lint`, `npm run check:types`, and `git diff --check`; conductor final gate:
    plain `npm install`, `npm ls kysely --depth=4`, `npx zen check --schema
    zenstack/schema.zmodel`, `npx zen generate --schema zenstack/schema.zmodel`,
    `npx prisma generate`, `npm run lint`, `npm run check:types`, and `git diff
    --check`; pre-commit `npm run check:deps` initially flagged Task 01's
    generated ZenStack TS and future-task packages as unused, then passed after
    adding narrow Knip ignores.
  - Resolution: pin the ZenStack package family to `3.6.4` for this PR so
    ZenStack, Better Auth, and `@better-auth/kysely-adapter` resolve to
    `kysely@0.28.17` with plain npm install. Upgrade to ZenStack `3.7.x` only
    after Better Auth/Kysely compatibility aligns.
  - Commit: `73ae0bba`.
- [x] 02 - AppRole permission context
  - Packet: `tasks/02-app-role-context.md`
  - Reasoning: high
  - Status: completed; review fixes applied; pending conductor review.
  - Changed files:
    `docs/superpowers/plans/zenstack-admin-authorization/task-queue.md`,
    `zenstack/schema.zmodel`, `zenstack/schema.ts`, `prisma/schema.prisma`,
    `prisma/seed.ts`,
    `prisma/seedMitSailing/steps.ts`, `src/libs/auth/appPermissions.ts`,
    `src/libs/auth/appPermissions.test.ts`, `src/libs/auth/roles.ts`,
    `src/libs/auth/roles.test.ts`, `src/libs/auth/permissions.ts`,
    `src/libs/auth/permissions.test.ts`, `src/libs/auth/dal.ts`,
    `src/libs/auth/dal.test.ts`, `src/libs/auth.ts`,
    `src/libs/auth.test.ts`, `src/libs/auth/adminHeaderLink.ts`,
    `src/libs/auth/adminHeaderLink.test.ts`,
    `src/libs/auth/rolePermissionGrants.ts`,
    `src/libs/admin/adminAreaAccess.ts`,
    `src/libs/admin/adminAreaAccess.test.ts`,
    `src/libs/admin/adminNavigation.ts`,
    `src/libs/admin/events/eventAdminActions.ts`,
    `src/libs/admin/events/eventAdminActions.test.ts`,
    `src/libs/admin/events/eventAdminAuthorization.ts`,
    `src/libs/admin/events/eventAdminAuthorization.test.ts`,
    `src/libs/admin/roles/roleAdminActions.ts`,
    `src/libs/admin/roles/roleAdminActions.test.ts`,
    `src/libs/admin/users/usersAdminHandlers.ts`,
    `src/libs/admin/users/usersAdminHandlers.test.ts`,
    `src/app/[locale]/(marketing)/(site)/admin/page.tsx`,
    `src/app/[locale]/(marketing)/(site)/admin/events/new/page.tsx`,
    `src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx`,
    `src/app/[locale]/(marketing)/(site)/admin/users/page.tsx`,
    `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`,
    `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`,
    `src/components/mit-sailing/SiteShell.tsx`,
    `src/components/mit-sailing/SiteShell.test.ts`,
    `src/components/mit-sailing/admin/PublicAdminEditLink.tsx`,
    `src/components/mit-sailing/admin/PublicAdminEditLink.test.tsx`,
    `src/locales/en.json`.
  - Commands run: `npm run test --
    src/libs/auth/appPermissions.test.ts src/libs/auth/roles.test.ts`
    failed red as expected; targeted auth/admin/event tests passed; `npx zen
    check --schema zenstack/schema.zmodel`; `npx zen generate --schema
    zenstack/schema.zmodel`; `npx prisma generate`; `rg -n
    "EVENTS_CREATE|parseRoles\\(" src tests`; `npm run lint`; `npm run
    check:types`; `npm run check:deps`; `git diff --check`. `npm run lint`
    initially flagged formatting in three touched files and passed after a
    targeted `npx ultracite fix`; `npm run check:deps` initially flagged the
    now-unused role-grant listing export and passed after removing it. Review
    fix pass: `npm run test -- src/libs/admin/users/usersAdminHandlers.test.ts`
    failed red for stale `role` mirror reads, then passed after switching admin
    user rows to `appRole`; full targeted Task 02 suite passed with 105 tests;
    reran `rg -n "EVENTS_CREATE|parseRoles\\(" src tests`, `npx zen check
    --schema zenstack/schema.zmodel`, `npx zen generate --schema
    zenstack/schema.zmodel`, `npx prisma generate`, `npm run lint`, `npm run
    check:types`, `npm run check:deps`, and `git diff --check`.
  - Risks: no database migration was created in this task, so `app_role` still
    needs the migration slice before migrated databases can use the regenerated
    Prisma client, Better Auth session `appRole` additional field, and seed
    updates. Task 02 is not deployable alone against an unmigrated database
    because generated Prisma now expects `user.app_role` before the migration
    slice exists. `User.role` remains as the Better Auth compatibility mirror
    and Task 02 write paths now maintain both `appRole` and `role`. The
    `/admin/roles` permission matrix remains visible but its persisted grants no
    longer drive authorization; Task 04/08 removes that stale surface.
  - Commit: `9690de0d`.
- [x] 03 - ZenStack client and Better Auth adapter
  - Packet: `tasks/03-zenstack-better-auth.md`
  - Reasoning: xhigh
  - Status: completed; review blockers fixed.
  - Changed files: `knip.config.ts`, `package.json`, `package-lock.json`,
    `src/libs/auth.ts`, `src/libs/auth.test.ts`,
    `src/libs/zenstack/auth.ts`, `src/libs/zenstack/auth.test.ts`,
    `src/libs/zenstack/authContext.ts`, `src/libs/zenstack/zod.ts`,
    `src/libs/zenstack/zod.test.ts`,
    `src/libs/admin/catalog/eventCategoriesSchemas.ts`,
    `src/libs/admin/roles/roleAdminActions.ts`,
    `src/libs/admin/roles/roleAdminActions.test.ts`.
  - Commands run: `npm run test --
    src/libs/zenstack/auth.test.ts src/libs/zenstack/zod.test.ts
    src/libs/auth.test.ts src/libs/admin/roles/roleAdminActions.test.ts`
    failed red for the added auth regressions, then passed with 44 tests;
    `npm run lint`; `npm run check:types`; `npm run check:deps`;
    `git diff --check`. Pre-commit reran `ultracite` and `knip`.
  - Review: two high-risk auth findings and one malformed impersonation finding
    were fixed, then final read-only review found no blocking issues.
  - Risks: no full e2e run in this packet. `updateUserRolesAction` updates the
    Better Auth role mirror before `appRole`; if the final `appRole` write fails,
    the adapter-normalized Better Auth admin path still fails closed from
    `appRole`, but the raw mirror may be stale until a later successful write.
    Migration remains prelaunch-only until Task 08 creates/squashes the database
    migration slice.
  - Commit: `887cde49`.
  - Next: Task 04 - Admin access, users, and role assignment.
- [x] 04 - Admin access, users, and role assignment
  - Packet: `tasks/04-admin-access-users.md`
  - Reasoning: high
  - Status: completed; review blockers fixed.
  - Changed files: `package.json`, `package-lock.json`,
    `prisma/schema.prisma`, `prisma/seed.ts`, `zenstack/schema.zmodel`,
    generated `zenstack/*.ts`, admin index/users pages, admin access/nav
    helpers, user admin definitions/schemas/handlers/tests, site shell/header
    admin links/tests, `src/libs/auth/appPermissions.ts`,
    `src/libs/auth/dal.ts`, `src/libs/auth/permissions.ts`,
    `src/libs/auth/server-admin.ts`, `src/libs/admin/users/appRoleActions.ts`,
    `src/locales/en.json`. Deleted `/admin/roles`,
    `AdminRoleUsersInfiniteScroll`, role admin actions/tests, and
    `rolePermissionGrants.ts`.
  - Commands run: TDD red runs for app role actions/user handlers/auth DAL and
    form error mapping; `npx zen generate --schema zenstack/schema.zmodel`;
    `npx prisma generate`; `npm run test` passed before review fixes with 1486
    passing and 1 skipped; after review fixes targeted suite passed with 110
    tests; `npx zen check --schema zenstack/schema.zmodel`; `npm run lint`;
    `npm run check:types`; `npm run check:deps`; `npm run check:i18n`;
    `git diff --check`. Pre-commit reran `ultracite` and `knip`.
  - Review: fixed viable-admin last-admin counting, partial-create rollback,
    and DAL fail-closed auth-context findings. Final read-only review found no
    blocking issues.
  - Risks: last-viable-admin protection is still count-then-mutate rather than
    locked/transactional; a code `TODO:` records that deferred concurrency
    hardening. Historical migration files can still mention
    `role_permission_grants`; Task 08 owns migration cleanup/squash.
  - Commit: `9dfe5c26`.
  - Next: Task 05 - Event authorization policies.
- [x] 05 - Event authorization policies
  - Packet: `tasks/05-event-policies.md`
  - Reasoning: xhigh
  - Status: completed; review blockers fixed.
  - Changed files: `prisma/schema.prisma`,
    `prisma/migrations/20260519000000_drop_event_created_by/migration.sql`,
    `prisma/seedMitSailing/steps.ts`, `zenstack/schema.zmodel`,
    `zenstack/schema.ts`, `src/libs/zenstack/eventPolicies.test.ts`,
    `src/libs/admin/events/eventAdminActions.ts`,
    `src/libs/admin/events/eventAdminActions.test.ts`,
    `src/libs/admin/events/eventAdminAuthorization.ts`,
    `src/libs/admin/events/eventAdminAuthorization.test.ts`,
    `src/libs/admin/events/eventAdminQueries.ts`, `src/libs/auth/dal.ts`,
    `src/libs/auth/permissions.ts`, `src/libs/auth/permissions.test.ts`,
    `src/libs/mit-sailing/eventQueries.ts`,
    `src/data/mit-sailing/eventsSeed.ts`,
    `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`,
    `src/locales/en.json`.
  - Commands run: real ZenStack policy test failed red for missing event
    policies, owner registration update access, mutable answer/comment
    relations, and mismatched comment parent creation, then passed with 11 tests
    after policies were added. `node scripts/migrate-test-db.mjs`;
    `RUN_DATABASE_TESTS=1 TEST_DATABASE_URL=... npx vitest run --project unit
    src/libs/zenstack/eventPolicies.test.ts`; focused auth/admin/event/seed
    tests passed with 22 tests; `npx zen check --schema
    zenstack/schema.zmodel`; `npx zen generate --schema
    zenstack/schema.zmodel`; `npx prisma generate`; `npm run lint`;
    `npm run check:types`; `npm run check:i18n`; `npm run check:deps`;
    `git diff --check`. Pre-commit reran `ultracite` and `knip`.
  - Review: fixed policy review findings for pre-state update semantics by
    using ZenStack v3 `post-update`/`before()` guards; restricted generated
    comment creation to root comments because nested parent-event comparison did
    not block mismatched parent creates.
  - Risks: the new unique index on `(event_id, admin_user_id)` assumes existing
    event admin assignment rows are duplicate-free before migration. Generated
    ZenStack access allows root comment creation only; threaded comment creation
    should stay in an explicit server workflow if product needs replies later.
  - Commit: `b0e0ab74`.
  - Next: Task 06 - Restricted generated CRUD and EventCategory admin UX.
- [ ] 06 - Restricted generated CRUD and EventCategory admin UX
  - Packet: `tasks/06-generated-crud-event-category.md`
  - Reasoning: high
  - Status: completed; review blockers fixed.
  - Changed files: `src/app/api/model/[...path]/route.ts`,
    `src/app/api/model/[...path]/route.test.ts`,
    `src/components/mit-sailing/admin/catalog/AdminCatalogForm.tsx`,
    `src/components/mit-sailing/admin/catalog/AdminCatalogForm.test.tsx`,
    `src/libs/admin/catalog/catalogActions.ts`,
    `src/libs/admin/catalog/catalogServerRegistry.ts`,
    deleted `src/libs/admin/catalog/eventCategoriesHandlers.ts`,
    `src/libs/admin/catalog/eventCategoriesSchemas.ts`,
    `src/libs/admin/catalog/types.ts`,
    `src/libs/admin/catalog/zenstackCatalogHandlers.ts`,
    `src/libs/admin/catalog/zenstackCatalogHandlers.test.ts`,
    `src/libs/zenstack/eventPolicies.test.ts`, `src/libs/zenstack/zod.ts`,
    `src/libs/zenstack/zod.test.ts`, `zenstack/schema.zmodel`,
    `zenstack/schema.ts`.
  - Commands run: DB-backed EventCategory policy test failed red for missing
    EventCategory policies, then passed with 12 tests. Targeted Task 06 suite
    passed with 57 tests:
    `src/libs/admin/catalog/catalogActions.test.ts`,
    `src/libs/admin/catalog/catalogDefinitions.test.ts`,
    `src/libs/admin/catalog/catalogFieldErrors.test.ts`,
    `src/libs/admin/catalog/booleanFormDataParsers.test.ts`,
    `src/components/mit-sailing/admin/catalog/AdminCatalogForm.test.tsx`,
    `src/app/api/model/[...path]/route.test.ts`,
    `src/libs/admin/catalog/zenstackCatalogHandlers.test.ts`,
    `src/libs/zenstack/zod.test.ts`. Also ran `npx zen check --schema
    zenstack/schema.zmodel`, `npx zen generate --schema
    zenstack/schema.zmodel`, `npx prisma generate`, `npm run lint`,
    `npm run check:types`, `npm run check:deps`, and `git diff --check`.
    Pre-commit reran `ultracite` and `knip`. A separate formatter-only commit
    `077d2c01` normalized
    `.agents/skills/zenstack-pr-hardening/agents/openai.yaml` quotes because it
    blocked the required full `npm run lint` gate.
  - Review: fixed generated CRUD review findings by restoring transactional
    EventCategory reorder, mapping expected ZenStack delete failures to
    `foreign_key`/`not_found`, and preventing invalid React Hook Form
    submissions before the server action.
  - Risks: EventCategory catalog list/get/reorder use a server admin auth
    context after page/action permission gates; generated CRUD remains
    allowlisted to `EventCategory` only and requires
    `EVENT_CATEGORIES_MANAGE`.
  - Commit: `793697d6`.
  - Next: Task 07 - Event workflow data access.
- [ ] 07 - Event workflow data access
  - Packet: `tasks/07-event-workflow.md`
  - Reasoning: high
- [ ] 08 - Remove stale auth stack and squash prelaunch migrations
  - Packet: `tasks/08-removal-migrations.md`
  - Reasoning: high
  - Cleanup context: commit `077e634c` (`feat: add CASL event permission
    model`) is the stale pre-ZenStack boundary. The cleanup pass should remove
    the old CASL/RolePermissionGrant stack that commit introduced after the
    appRole/ZenStack replacements are in place: `@casl/*` deps, CASL ability
    helpers/tests, `/admin/roles`, role permission grant code/model/seed/migration
    artifacts, `ROLES_ASSIGN`, `ROLES_MANAGE_PERMISSIONS`, and any remaining
    `accessibleBy`, `ForbiddenError`, `AuthAction`, `AuthSubject`, or
    `createAuthAbility` live-source usage. The `/admin/roles` cleanup includes
    deleting the long all-users role assignment list on the permission page, not
    porting it into the new appRole flow.
- [ ] 09 - Full verification and review-bot preflight
  - Packet: `tasks/09-verification.md`
  - Reasoning: xhigh
- [ ] 10 - PR hardening and post-review fixes
  - Packet: `tasks/10-pr-hardening.md`
  - Reasoning: xhigh
