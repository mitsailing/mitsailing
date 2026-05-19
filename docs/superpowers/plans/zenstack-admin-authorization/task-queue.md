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
  - Commit: pending.
- [ ] 03 - ZenStack client and Better Auth adapter
  - Packet: `tasks/03-zenstack-better-auth.md`
  - Reasoning: xhigh
- [ ] 04 - Admin access, users, and role assignment
  - Packet: `tasks/04-admin-access-users.md`
  - Reasoning: high
- [ ] 05 - Event authorization policies
  - Packet: `tasks/05-event-policies.md`
  - Reasoning: xhigh
- [ ] 06 - Restricted generated CRUD and EventCategory admin UX
  - Packet: `tasks/06-generated-crud-event-category.md`
  - Reasoning: high
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
