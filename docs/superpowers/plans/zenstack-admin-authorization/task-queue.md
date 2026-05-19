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
  - Commit: `85a854b1`.
- [ ] 02 - AppRole permission context
  - Packet: `tasks/02-app-role-context.md`
  - Reasoning: high
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
- [ ] 09 - Full verification and review-bot preflight
  - Packet: `tasks/09-verification.md`
  - Reasoning: xhigh
