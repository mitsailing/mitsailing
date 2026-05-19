# ZenStack Admin Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **AI control plane:** Start with `docs/superpowers/plans/zenstack-admin-authorization/README.md`, not this full file. This document remains the detailed reference; the folder contains the sequential conductor, queue, context map, and small worker packets that keep agent context low.

**Goal:** Replace the CASL/RolePermissionGrant authorization path with ZenStack access policies, a ZenStack auth context based on `User.appRole`, and generated/protected CRUD for event/catalog data while following ZenStack's Better Auth integration recipe for authentication storage, account administration, impersonation, sessions, email verification, and account-admin logging.

**Architecture:** ZModel becomes the source of truth for app data shape, Better Auth's generated auth tables, access policies, and validation. ZenStack v3 provides the database client, Better Auth uses `@zenstackhq/better-auth` as its database adapter, app code uses `PolicyPlugin` and `$setAuth`, and the Next.js adapter exposes policy-aware Query-as-a-Service endpoints only for an explicit model allowlist. Better Auth remains the authentication/account-admin package, but MIT Sailing authorization reads `User.appRole`, not Better Auth's compatibility `User.role`.

**Tech Stack:** TypeScript, Next.js App Router, Better Auth, ZenStack v3 (`@zenstackhq/cli`, `@zenstackhq/orm`, `@zenstackhq/plugin-policy`, `@zenstackhq/server`, `@zenstackhq/better-auth`, `@zenstackhq/zod`), React Hook Form, `@hookform/resolvers/zod`, Prisma 7 for generated schema/client compatibility and untouched existing modules, PostgreSQL, Vitest, Playwright.

---

## Docs Reviewed

- ZenStack v3 Welcome: https://zenstack.dev/docs
- ZModel/Data Modeling: https://zenstack.dev/docs/modeling
- ORM client and Kysely/Postgres dialect: https://zenstack.dev/docs/orm/client
- Access policies: https://zenstack.dev/docs/orm/access-control and https://zenstack.dev/docs/orm/access-control/write-policies
- Querying with access control and limitations: https://zenstack.dev/docs/orm/access-control/query
- Field-level policies: https://zenstack.dev/docs/orm/access-control/field-level
- Input validation: https://zenstack.dev/docs/orm/validation
- Query-as-a-Service: https://zenstack.dev/docs/service
- Next.js adapter: https://zenstack.dev/docs/reference/server-adapters/next
- `@core/prisma` plugin: https://zenstack.dev/docs/reference/plugins/prisma
- CLI: https://zenstack.dev/docs/reference/cli
- Better Auth integration recipe: https://zenstack.dev/docs/recipe/auth-integration/better-auth
- ZenStack Studio: https://zenstack.dev/docs/studio
- Zod utility: https://zenstack.dev/docs/utilities/zod
- React Hook Form: https://react-hook-form.com
- React Hook Form Zod resolver: https://github.com/react-hook-form/resolvers
- CodeRabbit path instructions and path filters: https://docs.coderabbit.ai/configuration/path-instructions
- CodeRabbit configuration reference: https://docs.coderabbit.ai/reference/configuration
- Bemi Prisma integration: https://docs.bemi.io/orms/prisma
- Bemi self-managed PostgreSQL setup: https://docs.bemi.io/hosting/self-managed
- Bemi data-change tracking alternatives: https://docs.bemi.io/alternatives

Important doc conclusions:

- ZenStack v3 does not depend on Prisma at runtime. It uses a Prisma-superset ZModel and a Prisma-compatible query API, implemented on Kysely. This PR should not remove Prisma from unrelated app modules; it replaces the CASL/Better Auth adapter/event/category paths in scope first.
- `@core/prisma` is a ZModel plugin that generates a Prisma schema. In this app, keep it for Prisma schema/tool compatibility while moving Better Auth storage to ZenStack's own adapter.
- This repo's Prisma 7 generated client path is part of the app contract. Keep the `generator client { provider = 'prisma-client'; output = '../src/generated/prisma' }` block in ZModel and verify `npx prisma generate` after `npx zen generate`.
- Access control uses `@zenstackhq/plugin-policy`, `@@allow`, `@@deny`, `auth()`, and runtime `$setAuth`.
- Without `$setAuth`, `auth()` is `null`. Any policy that reads `auth().appRole` requires the app to provide that field in the ZenStack auth context.
- Policy-enforced reads filter invisible rows; single-row updates/deletes on rows not allowed by policy behave as not found. Raw SQL is not policy-enforced.
- The Next.js adapter installs generated CRUD APIs. It should be mounted behind `/api/model/[...path]` and restricted to allowed models so user account mutations do not bypass Better Auth admin logging. Current docs show RPC examples; use REST only after verifying installed package types and payload contract.
- ZenStack's Better Auth recipe recommends `@zenstackhq/better-auth`, `zenstackAdapter(db, { provider: 'postgresql' })`, and Better Auth CLI schema generation to populate Better Auth models into ZModel. This repo currently uses `better-auth@1.6.x`; do not install or run an unpinned `@better-auth/cli` if npm resolves it to an older Better Auth line. Treat CLI generation as a compatibility check only after confirming the CLI version matches the installed Better Auth major/minor line.
- Better Auth's admin plugin adds `role`, `banned`, `banReason`, and `banExpires` fields to `user`, adds `impersonatedBy` to `session`, defaults new users to role `user`, and stores multiple roles as comma-separated strings. This app intentionally does not use Better Auth multi-role authorization; `role` is only a lowercase compatibility mirror.
- The recipe's Organization plugin section is intentionally out of scope. This app is single-tenant; do not add organization, tenant, membership, active organization, or organization role fields.
- ZenStack Studio can run locally with `npx zenstack studio` and should be used as a manual verification aid, not as a production dependency.
- `@zenstackhq/zod` can derive Zod schemas from ZModel and should replace duplicated form validation only after the first policy/client integration is green. Current docs show `createSchemaFactory`, `makeEnumSchema`, `makeModelCreateSchema`, and `makeModelSchema`; use the installed package's typed API and avoid hand-written duplicate schemas.
- React Hook Form with `zodResolver` should be used for converted React forms so generated ZenStack Zod schemas validate UI input without custom client-side validation glue.
- CodeRabbit supports path instructions, path filters, custom checks, generated-code exclusions, and simplify finishing touches. Use these to focus review on real authorization/data bugs, not generated churn.
- Bemi can capture database changes from PostgreSQL WAL and supports app context through ORM integrations. Bemi Prisma adds context for Prisma writes, but this PR moves runtime writes toward ZenStack v3/Kysely, so Bemi must be proven against ZenStack writes before replacing custom CMS/catalog history.
- Bemi can support admin-visible history and rollback by querying captured `changes` rows with `before`, `after`, `context`, and `committed_at`; it is not automatically a drop-in replacement for the current CMS/catalog revision UI because restore behavior still needs app-specific authorization, snapshot mapping, and UI wiring.

## Plan Stress-Test Findings Fixed

This plan was reviewed with `grill-me` pressure testing, repo scans, Context7 ZenStack/Better Auth docs, and one independent reviewer sub-agent. The review found and fixed these plan issues:

1. ZModel `AppRole` enum casing conflicted with existing lowercase `Role` values.
2. Better Auth CLI was originally ordered before the ZenStack adapter existed.
3. Generated ZenStack schema imports used `@/zenstack/schema`, but `@/*` maps to `src/*`.
4. The Next.js adapter was called restricted while only blocking `User` mutations.
5. Better Auth non-admin role mapping still had overpowered account-admin permissions.
6. Directly updating Better Auth `role` would bypass Better Auth admin/audit behavior.
7. Event creation policy allowed roles that could not create their own `EventAdmin` row safely.
8. Prisma generator output for `src/generated/prisma` was not explicitly protected.
9. Zod utility examples used likely-undocumented factory options.
10. Policy tests allowed mocks, which could false-pass without exercising ZenStack policies.
11. Next.js route verification targeted `src/proxy.test.ts` instead of route-handler tests.
12. EventCategory handler instructions referenced an undefined `authContextFromActor`.
13. Dependency and CLI commands needed explicit migration-command allowance.
14. Migration squashing needed an explicit shared-environment precondition.
15. `PublicAdminEditLink` and user pages still depended on `RolePermissionGrant`.
16. Migration searches for `created_by` were too broad and would catch unrelated newsletter/catalog history.
17. ZModel policies relied on uncertain scalar-list permission syntax instead of stable role checks.
18. Event workflow generated CRUD risked bypassing registration capacity/payment/business rules.
19. Server-only ZenStack auth helpers would poison client imports used by the site header.
20. Better Auth role mirror updates needed request/admin context for audit logging.
21. Last-admin protection trusted caller-provided current role instead of database state.
22. Next.js adapter handler style and route tests needed to match the exact documented API contract.
23. Generated schema re-export shape needed to handle default vs named exports.
24. Tests importing server-only modules needed explicit `server-only` mocks.
25. Shell commands with route groups and dynamic segments needed quoted paths for zsh.
26. Migration-squash preconditions needed to include Better Auth baseline and role-grant migration, not only event migrations.
27. Better Auth audit logging was conflated with domain audit history; it only covers auth/account-admin behavior.
28. Bemi could reduce custom CMS/catalog history code, but adding Bemi Prisma inside the ZenStack PR would create a second runtime/data-capture migration axis.
29. CodeRabbit risk controls were implicit; the plan needed explicit top-10 churn reducers and review gates.
30. `User.appRole` was added to the database but not guaranteed to appear in Better Auth session user data.
31. Banned or email-unverified users could still be converted into a ZenStack auth context if a stale session existed.
32. The generated ZenStack API route did not explicitly fail closed for impersonated, banned, or unverified sessions.
33. ZModel `AuthContext.appRole` was typed as `String`, weakening policy checks against the `AppRole` enum.
34. App role assignment could leave `User.appRole` and Better Auth `User.role` inconsistent if the mirror update failed.
35. The generated API allowlist parsed `request.nextUrl.pathname` manually instead of using route params.
36. `User` ZModel update policy was broad enough to permit accidental auth-plugin field updates through ZenStack.
37. `EventRegistration` create policy did not require the related event to be readable/published.
38. Roles admin React components/tests could remain orphaned after deleting `/admin/roles`.
39. Seed/bootstrap steps did not explicitly verify every privileged seeded user gets `appRole` and Better Auth `role` mirror values.
40. Auth-context tests were not updated for the stricter email-verified requirement and would have failed after the helper returned `null`.
41. Some test snippets used `vi.mock` without importing `vi`, which would have created immediate test failures during execution.
42. The plan still referenced `Permission.EVENTS_CREATE` even though the simplified permission map intentionally removes it.
43. `CurrentUser` and admin CMS media routes still used Better Auth `role` for admin checks instead of `appRole`.
44. Better Auth `appRole` session exposure did not explicitly map to the `app_role` database column.
45. The Better Auth no-admin role was named in prose but not defined in the implementation snippet.
46. The ZenStack Next.js adapter snippet used RPC-style defaults while the intended first commodity CRUD surface is REST-style `EventCategory`.
47. The generated API allowlist used a likely-wrong default segment for `EventCategory`; the route should use explicit `modelNameMapping`.
48. The Zod task correctly used ZenStack's Zod package, but its snippet used deprecated `makeModelCreateSchema`/`makeModelUpdateSchema` methods instead of the current typed `makeModelSchema` options.
49. The root generated `zenstack/schema.ts` artifact was not explicitly included in commits, which could leave imports broken in a fresh checkout.
50. Catalog handler tests used raw string permissions/roles that would widen to `string[]` and fail strict TypeScript.
51. Policy tests described “events.manage” authorization even though ZModel policies only understand roles and event-admin relations.
52. Admin user creation could set Better Auth `role` without setting `User.appRole`, creating a privileged-looking user with no app permissions.
53. Last-admin protection for ban/delete/demotion still needed to read `appRole`, not Better Auth's compatibility `role`.
54. User admin update payloads could still send `role` through Better Auth `adminUpdateUser` instead of routing role changes through the app-role mirror helper.
55. Event child models such as dates, questions, fees, answers, and comments had no policies, so relation reads/writes could be denied or accidentally require raw-client workarounds.
56. `EventRegistration` allowed users to update their whole registration row, which could bypass approval/cancellation workflow rules.
57. `EventRegistrationAnswer` policy needed to ensure the answered question belongs to the same event as the registration.
58. `zenStackClientForAuth` accepted only `undefined`, but auth-context helpers now return `null` for banned/unverified users.
59. EventCategory ZenStack CRUD still parsed with the old custom schema instead of the new ZenStack Zod schema.
60. Client header admin-link logic still needed to read `session.user.appRole`, `emailVerified`, and `banned`, not Better Auth `role`.
61. Catalog mutation context only carried user ids, so ZenStack-backed handlers had no typed way to receive `authContext`.
62. Admin user rows/forms still needed to rename the editable role field to `appRole` so UI code does not keep posting Better Auth `role`.
63. The new-agent handoff prompt did not include the latest REST mapping, generated schema artifact, appRole-only user admin, and registration-policy constraints.
64. The old `@better-auth/prisma-adapter` package would become unused after switching Better Auth to the ZenStack adapter.
65. Task 1 said to create one GitHub issue per task but listed fewer issue titles than the implementation plan has tasks.
66. The plan's Prisma wording could be misread as removing Prisma from untouched modules instead of only replacing the CASL/Better Auth/event/category paths in scope.
67. Role inheritance helpers would add code for a tiny fixed permission matrix; explicit role grants are easier to inspect and maintain for this PR.
68. Better Auth client session typing did not mention `inferAdditionalFields`, so `appRole`/`banned`/`emailVerified` could remain `unknown` in client header code.
69. The Better Auth role mirror helper did not pin the docs-backed `auth.api.setRole({ headers, body: { userId, role } })` API shape.
70. Event/catalog mutation error mapping still assumed Prisma error classes even after writes move to ZenStack/Kysely.
71. Better Auth `appRole` additional field used a loose `string` type instead of Better Auth's enum-array/default-value support.
72. The role-assignment task allowed a direct DB mirror update fallback, which would bypass Better Auth admin logging and add custom audit code.
73. The role mirror rollback path did not define behavior when the rollback `setRole` call itself fails.
74. Public event registration actions still needed to fail closed for banned or email-unverified users, not only admin routes.
75. `EventAdmin` read policy exposed event admin assignments anywhere a public event was readable.
76. Better Auth enum-field config should reuse a typed exported role-values tuple instead of relying on widened `Object.values(Role)`.
77. ZenStack REST adapter tests need JSON:API-style request bodies/headers, not guessed plain JSON mutation payloads.
78. EventCategory form data still needs typed coercion before passing values into generated ZenStack Zod schemas.
79. Converted React forms should use React Hook Form plus `zodResolver` instead of hand-rolled client validation and state management.
80. ZenStack Zod schemas used by React Hook Form need a client-safe export path; client components cannot import a module with `server-only`.
81. React Hook Form conversion must preserve next-intl error copy instead of leaking generic generated Zod messages into the UI.
82. `AdminCatalogForm` is shared by complex CMS editors, so React Hook Form should be applied to EventCategory first without rewriting every catalog form path.
83. EventCategory React Hook Form needs edit-mode `defaultValues` and server field-error mapping, not just create-mode client validation.
84. React Hook Form integration must not accidentally bypass or disable the existing Next.js Server Action submit path.
85. ZModel `AuthContext` still included `permissions String[]` even though policies only need `id` and `appRole`.
86. `zenStackClientForAuth` should project the UI auth context down to `{ id, appRole }` before `$setAuth`.
87. The preinstall `npx zen check` command could fetch an unrelated/latest CLI instead of proving the repo lacks the local ZenStack tool.
88. Some test snippets duplicated imports or referenced `Role`/`Permission` without importing them, creating avoidable first-run failures.
89. The Better Auth adapter replacement snippet used `zenStackRawClient` without explicitly adding the import.
90. `parseRoles` deletion also requires updating `src/libs/auth/roles.test.ts`; otherwise the old multi-role tests keep failing after the intended simplification.
91. Role-mirror tests needed to cover initial Better Auth `setRole` failure so `appRole` cannot change when the compatibility mirror was never updated.
92. ZenStack's Prisma plugin can fall back to `prisma-client-js` unless the ZModel carries this repo's Prisma 7 `generator client` block.
93. The plan overstated REST handler docs; current Next adapter docs show RPC, while installed package types export `RestApiHandler`.
94. REST route tests needed the JSON:API request content type and `data.attributes` payload shape pinned to avoid guessed test bodies.
95. EventRegistration policy tests contradicted the no-broad-user-update rule by asking users to update their whole registration row.
96. EventCategory create validation incorrectly required `displayOrder`, even though the existing handler computes create order server-side.
97. Prisma 7 compatibility must remain a hard gate because ZenStack 3.7's CLI depends on Prisma 6 internally while this repo uses Prisma 7.
98. Latest ZenStack docs say Prisma client generators can be removed because ZenStack runtime does not use Prisma Client; this repo must keep the generator only for untouched existing Prisma modules and tooling.
99. Latest ZenStack Zod docs show `makeModelCreateSchema`, so the plan should say to follow installed package types/docs instead of treating docs-backed APIs as simply wrong.
100. EventCategory ZenStack create still needs app-added `id`, `createdAt`, and server-computed `displayOrder`; generated form schemas should validate only submitted fields.

## CodeRabbit Churn Reduction Strategy

Use these 10 practices in this PR to reduce CodeRabbit bug volume by reducing custom code, tightening scope, and making review intent explicit:

1. **Package-first for commodity systems:** use maintained packages for auth, authorization, validation, generated CRUD, and future audit history instead of hand-rolled infrastructure.
2. **One source of truth:** put data shape and row policies in ZModel; keep `User.appRole` as the app authorization source; keep Better Auth `role` only as a mirror.
3. **Delete stale code in the same slice:** remove CASL, RolePermissionGrant, role grants cache, roles admin UI, and stale tests when their replacement lands.
4. **Generate instead of custom-build:** use ZenStack generated schema, policy client, Next.js adapter, and Zod schemas for commodity CRUD and validation.
5. **Allowlist risky surfaces:** expose only explicitly allowed generated CRUD models; block auth/account/workflow models from generic endpoints.
6. **Characterization tests before deletion:** write focused tests for role normalization, admin gates, policies, role assignment, event admin behavior, and catalog CRUD before replacing code.
7. **Small issue-sized implementation slices:** execute one task/issue at a time with one sub-agent, review diffs, then run the task's verification commands before continuing.
8. **CodeRabbit-aware configuration:** keep `.coderabbit.yaml` path instructions focused on this migration; add path instructions for `zenstack/**`, `src/libs/zenstack/**`, and generated schema outputs if CodeRabbit starts flagging generated or doc-proven patterns.
9. **Preflight static searches:** run the CodeRabbit preflight `rg` searches for stale auth, casts, direct env reads, TODO/TBD, CASL, and RolePermissionGrant before pushing.
10. **Avoid multi-axis migrations:** do not combine ZenStack authorization migration with unrelated audit-history replacement. Add Bemi only if this PR directly needs domain audit/history behavior to finish its authorization or CRUD scope.

## Audit History and Bemi Non-Scope

Current audit/history split:

- Better Auth `auditLog(...)` covers authentication and account-admin events such as sign-in, ban/unban, impersonation, password/session operations, and other Better Auth plugin activity.
- Better Auth audit logging does **not** cover domain history for events, CMS pages, catalog rows, pavilion reservations, or custom app models.
- Domain history currently lives in custom `UserAudit` infrastructure used by `src/libs/mit-sailing/cmsHistory.ts`, `src/libs/mit-sailing/catalogHistory.ts`, and pavilion reservation admin actions.

Bemi decision for this PR:

- Do **not** integrate `@bemi-db/prisma` directly inside the ZenStack authorization PR.
- Do not create a Bemi issue as part of this PR unless implementation discovers that this PR must touch domain audit/history code to finish.
- Do not remove `UserAudit`, `cmsHistory`, `catalogHistory`, or restore UI in this PR.
- Do not expand this PR to replace CMS/catalog history or rollback behavior.

Why:

- Bemi is promising for the exact goal: admin history, rollback, and deletion of custom audit code.
- Bemi Prisma's documented app-context integration is Prisma-based; ZenStack v3 runtime is Kysely-based. Database-level WAL capture can still see row changes, but app context and restore UX must be proven for ZenStack writes.
- The current CMS/catalog restore behavior is not just logging. It builds domain snapshots, compares revisions, lists admin history, shows diffs, restores CMS blocks/rows, records restore actions, and enforces admin permissions.
- This ZenStack PR does not need CMS/catalog rollback replacement to replace CASL and simplify permissions.
- Adding Bemi now would create a second complex migration inside this PR and likely increase CodeRabbit review findings.

Bemi may be reconsidered in this PR only if all of these become true:

- a required task in this PR touches `UserAudit`, `cmsHistory`, `catalogHistory`, or restore UI in a non-trivial way;
- Bemi can replace that touched code with less code in the same PR;
- Bemi works with the final ZenStack write path, including actor/request context;
- the change does not delay CASL removal or widen generic CRUD exposure;
- the license, deployment, WAL, destination DB, retention, and rollback requirements are documented before install.

## Execution Model

Use the control plane in `docs/superpowers/plans/zenstack-admin-authorization/`. The conductor coordinates decisions, reviews diffs, runs verification, and keeps context small. Each task packet should be executed by one fresh worker with only the packet text, cited rule paths, and discovered source files. Workers do not run in parallel for this migration.

All workers must apply `.cursor/rules/package-first-simple.mdc`: before building custom infrastructure, check existing repo patterns and production-ready packages. Stop and ask on Slack `mitsailing` / `ak` if the worker is about to build a custom package-like subsystem where an existing maintained package or local abstraction may be simpler.

Optional GitHub coordination before coding:

- Create milestone: `ZenStack authorization migration`
- Create one issue per task below.
- Link the implementation PR to the milestone.
- Put the task body into each issue so sub-agents can read the issue instead of receiving a huge prompt.

Do not paste `.cursor/rules/*.mdc` bodies into sub-agent prompts. Cite the relevant rule paths only:

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/nextjs-node-server-2026.mdc`
- `.cursor/rules/e2e-verification.mdc`
- `.cursor/rules/dates-us-eastern.mdc`

Docs and execution requirements:

- Use Context7 before relying on library, framework, CLI, SDK, or adapter behavior. This especially applies to ZenStack, Better Auth, Prisma, Next.js, Zod, Kysely, and package installation commands.
- Do not rely on model memory for package APIs; most agent memory will be stale for this migration.
- Use `executing-plans` if executing this plan inline rather than sub-agent-driven.
- Use the available reasoning/design skill when a task exposes an architectural decision not already settled in this plan. If no exact `reasoning` skill is installed, use `grill-me` for design-decision pressure testing and stop before widening scope.
- Repo command restrictions apply to `npm run` scripts. This migration also requires direct setup commands because it changes dependencies and code generation. Allowed setup commands for this plan are: `npm install`, `npm uninstall`, `npm view`, `npx --no-install zen check`, `npx zen check`, `npx zen generate`, `npx zenstack studio`, `npx prisma generate`, a version-verified Better Auth CLI generation command, `rg`, `git`, and GitHub issue/milestone commands. Do not add new `npm run` scripts.

## Final Target

- CASL packages and CASL code are removed.
- `RolePermissionGrant` table, seed, cache, permission matrix UI, and `/admin/roles` page are removed.
- `User.appRole` is the MIT Sailing authorization source of truth.
- `User.role` remains only as a Better Auth admin plugin compatibility mirror.
- Better Auth keeps account-admin operations and logging: ban/unban, remove user, set password, session admin, impersonation, email verification.
- Better Auth uses ZenStack as its database provider through `@zenstackhq/better-auth`; the old Prisma adapter is removed after the recipe is working.
- Better Auth admin roles are narrowed so only `Role.ADMIN` has account-admin plugin permissions. Staff authorization comes from `User.appRole` and ZenStack policies, not from Better Auth admin-plugin permissions.
- ZenStack owns app/domain data authorization: events, event admins, event registrations, event categories, generic catalog data, and app role assignment.
- `Event.created_by` is removed. `EventAdmin` is the event-scoped management relation.
- Admin header button, admin layout access, admin nav, page gates, and ZenStack `$setAuth` all use the same auth context.
- Generated Next.js CRUD endpoints are mounted with ZenStack's Next.js adapter and restricted by an explicit model allowlist. Auth/account models and workflow-heavy models are not exposed through generic CRUD.

## File Structure

Create:

- `zenstack/schema.zmodel`: ZModel source of truth with `plugin policy`, `plugin prisma`, `AppRole`, `type AuthContext @@auth`, app models, policies, and validation.
- `zenstack/schema.ts`: generated ZenStack schema metadata produced by `npx zen generate`; commit it when generated so fresh checkouts can import the runtime schema without a prebuild workaround.
- `src/libs/zenstack/schema.ts`: local re-export for the generated ZenStack schema so application imports stay under `@/`.
- `src/libs/zenstack/client.ts`: raw ZenStack client, policy client, and app-bound client helpers.
- `src/libs/zenstack/auth.ts`: server-only Better Auth session to ZenStack auth context adapter.
- `src/libs/auth/appAuthContext.ts`: client-safe pure role-to-permissions auth context helper used by header/nav visibility code and wrapped by ZenStack server helpers.
- `src/libs/zenstack/zod.ts`: `@zenstackhq/zod` schema factory used by future form/schema migrations.
- `src/libs/zenstack/zod-client.ts` or equivalent client-safe schema export if `src/libs/zenstack/zod.ts` remains server-only; React Hook Form client components must not import `server-only`.
- `src/app/api/model/[...path]/route.ts`: Next.js adapter route using `NextRequestHandler`, the verified ZenStack API handler style, and an explicit model allowlist before dispatch.
- `src/libs/auth/appPermissions.ts`: code-defined permission vocabulary, `ROLE_PERMISSIONS`, `getAppRolePermissions`, `hasPermission`, `hasAnyPermission`, `isAdminAppRole`.
- `src/libs/auth/appPermissions.test.ts`: tests for app role normalization, permissions, admin-only role assignment, and unknown-role fail-closed behavior.
- `src/libs/auth/server-admin.ts`: tiny server-only wrapper for Better Auth admin operations that must keep Better Auth audit/logging behavior.
- `src/libs/admin/users/appRoleActions.ts`: explicitly guarded app role assignment with last-admin protection and Better Auth role mirror update.
- `src/libs/admin/users/appRoleActions.test.ts`: app role assignment and last-admin tests.
- `src/libs/admin/catalog/zenstackCatalogHandlers.ts`: generic handler factory for simple ZenStack-backed catalog resources.
- `src/libs/admin/catalog/zenstackCatalogHandlers.test.ts`: generated/protected CRUD handler tests for `event_categories`.
- `src/libs/admin/events/zenstackEventAccess.test.ts`: event, event admin, and event registration policy tests.

Modify:

- `package.json` and `package-lock.json`: add ZenStack packages and package config for schema path/output if needed.
- `prisma/schema.prisma`: generated from ZModel through `@core/prisma`.
- `prisma/migrations/**/migration.sql`: squash/replace pre-live event/domain migration history touched by this PR.
- `prisma/seed.ts`, `prisma/seedMitSailing/steps.ts`, `src/data/mit-sailing/eventsSeed.ts`: remove role grant seed and `Event.created_by`; add `appRole`; ensure event creators are represented in `EventAdmin` seed rows.
- seed user fixtures: set both `appRole` and Better Auth `role` mirror for all privileged seeded users; default both fields to `user`.
- `src/libs/auth.ts`: replace `prismaAdapter` with `zenstackAdapter`, keep Better Auth admin plugin for impersonation/logging, and configure roles from the compatibility mirror only.
- `src/libs/auth-client.ts`: add Better Auth `inferAdditionalFields` typing for `appRole`, `banned`, and `emailVerified` if the client cannot infer the server `auth` type directly.
- `src/libs/auth/dal.ts`: replace CASL `requirePermission`/`requireAnyPermission` implementation with app auth context checks.
- `src/app/api/admin/cms-media/route.ts`, `src/app/api/admin/cms-media/uploads/route.ts`, `src/app/api/admin/cms-media/uploads/[id]/route.ts`, `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`: replace `currentUser.role === Role.ADMIN` with `currentUser.appRole === Role.ADMIN` or a shared app permission check.
- `src/libs/auth/adminHeaderLink.ts`: use auth context and `Permission.ADMIN_VIEW`.
- `src/components/mit-sailing/admin/PublicAdminEditLink.tsx`: replace role grant loading with app auth context permission checks.
- `src/libs/admin/adminAreaAccess.ts`: use auth context and no CASL/grant loading.
- `src/libs/admin/adminNavigation.ts`: filter nav with `hasAnyPermission`; remove `/admin/roles`.
- `src/app/[locale]/(marketing)/(site)/admin/layout.tsx`: keep existing admin layout shell, but receive nav from new access helper.
- `src/app/[locale]/(marketing)/(site)/admin/page.tsx`: replace ability checks with auth context helpers.
- `src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx`: delete.
- `src/libs/admin/roles/roleAdminActions.ts`: delete.
- `src/libs/auth/permissions.ts`: replace CASL-specific module with app permission constants or delete after moving constants to `appPermissions.ts`.
- `src/libs/auth/rolePermissionGrants.ts`: delete.
- `src/libs/auth/roles.ts`: single-role normalization only; no comma parsing.
- `src/libs/admin/users/usersAdminHandlers.ts`: read/write `appRole`; keep Better Auth admin API for ban/delete/password; use `appRoleActions` for role assignment.
- `src/libs/admin/catalog/types.ts`: add required `authContext: ZenStackAuthContext` to `CatalogMutationContext` so generated/protected mutating handlers can use ZenStack without ambiguous actor shapes.
- `src/libs/admin/catalog/catalogActions.ts`: pass `session.authContext` from `requirePermission` into catalog mutation context.
- EventCategory admin form component path used by the existing generic catalog form: use React Hook Form with `zodResolver(eventCategoryCreateSchema/eventCategoryUpdateSchema)` for the first converted ZenStack-backed form.
- `src/libs/admin/users/userAdminDefinitions.ts`: display/edit `appRole`, not `role`; keep banned/emailVerified fields.
- `src/app/[locale]/(marketing)/(site)/admin/users/page.tsx`: read `appRole`; do not load RolePermissionGrant.
- `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`: read/edit `appRole`; do not load RolePermissionGrant.
- `src/libs/admin/events/eventAdminAuthorization.ts`: remove CASL and use ZenStack protected queries.
- `src/libs/admin/events/eventAdminActions.ts`: use ZenStack protected client for Event/EventAdmin/EventDate/Question/Fee writes where practical; keep business workflow logic.
- `src/libs/admin/events/eventAdminQueries.ts`: remove `createdBy`, use `EventAdmin` and ZenStack read policy.
- `src/libs/mit-sailing/eventQueries.ts`: use ZenStack protected client for viewer event-registration state.
- `src/libs/mit-sailing/eventRegistrationActions.ts`: use ZenStack protected client for registration ownership.
- `src/libs/admin/catalog/catalogServerRegistry.ts`: route `event_categories` first through `zenstackCatalogHandlers`.
- `src/libs/admin/catalog/eventCategoriesHandlers.ts`: delete after registry switches to ZenStack generic handler.
- `src/locales/en.json`: remove role-permission matrix copy and `Created by` event metadata copy if no longer used; keep role labels.

Remove dependencies after replacement:

- `@better-auth/prisma-adapter`
- `@casl/ability`
- `@casl/prisma`

## Task 1: Create GitHub Milestone and Issues

**Files:**
- No code files.

- [ ] **Step 1: Create milestone**

Create a GitHub milestone named:

```txt
ZenStack authorization migration
```

Description:

```txt
Replace CASL/RolePermissionGrant with ZenStack access policies, add appRole auth context, preserve Better Auth account-admin logging, and move generic/event CRUD through protected ZenStack clients.
```

Expected: milestone exists and can be linked to the current PR.

- [ ] **Step 2: Create issue for each implementation task**

Create issues titled:

```txt
01 - Create ZenStack authorization milestone and issues
02 - Install ZenStack tooling and schema shell
03 - Port auth and app models into ZModel
04 - Add appRole permission context
05 - Add ZenStack client and Better Auth adapter
06 - Add ZenStack Zod validation and Studio verification
07 - Refactor admin access, nav, header, and CMS media gates
08 - Remove RolePermissionGrant and roles admin page
09 - Add appRole assignment and Better Auth role mirror
10 - Replace event created_by with EventAdmin
11 - Encode event and registration access policies
12 - Mount restricted ZenStack Next.js adapter
13 - Move EventCategory catalog CRUD to ZenStack
14 - Move event backend workflow to ZenStack protected client
15 - Remove CASL and replaced auth adapter dependencies
16 - Squash prelaunch auth/event migration history
17 - Run verification and CodeRabbit risk pass
```

Expected: each issue links to the milestone and contains the relevant task section from this plan.

- [ ] **Step 3: Link PR to milestone**

Set the implementation PR milestone to `ZenStack authorization migration`.

Expected: PR appears in the milestone progress view.

## Task 2: Install ZenStack v3, Better Auth Adapter, and Zod Utility

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `zenstack/schema.zmodel`

- [ ] **Step 1: Write the first schema check target**

Create `zenstack/schema.zmodel` with only datasource, plugins, `AppRole`, and auth type:

```zmodel
datasource db {
    provider = 'postgresql'
}

plugin policy {
    provider = '@zenstackhq/plugin-policy'
}

plugin prisma {
    provider = '@core/prisma'
    output = '../prisma/schema.prisma'
}

generator client {
    provider = 'prisma-client'
    output = '../src/generated/prisma'
}

enum AppRole {
    user
    volunteer
    volunteer_instructor
    dock_staff
    dock_master
    admin
}

type AuthContext {
    id      String
    appRole AppRole

    @@auth
}
```

- [ ] **Step 2: Run schema check before installing**

Run:

```bash
npx --no-install zen check --schema zenstack/schema.zmodel
```

Expected: FAIL because the local ZenStack v3 CLI is not installed. Use `--no-install` here so `npx` does not fetch a global/latest package and hide the missing dependency.

- [ ] **Step 3: Install packages**

Run:

```bash
npm install @zenstackhq/orm@3.7.0 @zenstackhq/plugin-policy@3.7.0 @zenstackhq/server@3.7.0 @zenstackhq/better-auth@3.7.0 @zenstackhq/zod@3.7.0
npm install react-hook-form @hookform/resolvers
npm install --save-dev @zenstackhq/cli@3.7.0
```

Expected: `package.json` and `package-lock.json` include ZenStack runtime packages, ZenStack Better Auth adapter, ZenStack Zod utility, React Hook Form, Zod resolver, and ZenStack CLI.

Do not install unpinned `@better-auth/cli` in this step. Before any Better Auth CLI use, run `npm view @better-auth/cli version dependencies --json` and confirm the resolved CLI depends on the same Better Auth major/minor line as the repo's installed `better-auth` package. If no compatible CLI exists, skip CLI generation and verify the Better Auth ZModel tables manually against current Better Auth docs and installed package types.

- [ ] **Step 4: Run schema check after installing**

Run:

```bash
npx zen check --schema zenstack/schema.zmodel
```

Expected: PASS.

Important: keep `AppRole` enum values lowercase to match the existing `Role` constants and Better Auth's `user.role` mirror. In ZModel policies compare enum values as identifiers such as `auth().appRole == admin`, not as string literals. Do not introduce uppercase enum values unless the task also updates every app role comparison and storage default.

Keep ZModel `AuthContext` minimal. It should contain only fields used by ZModel policies (`id`, `appRole`). TypeScript app auth context can still carry a `permissions` array for nav/page helpers, but do not add `permissions String[]` to ZModel unless a later PR proves scalar-list policy syntax through `zen check` and policy tests.

- [ ] **Step 5: Add package config for ZenStack schema path**

In `package.json`, add:

```json
"zenstack": {
  "schema": "zenstack/schema.zmodel"
}
```

Expected: `npx zen check` can find the schema without a `--schema` argument.

- [ ] **Step 6: Protect Prisma generator output**

Before moving models into ZModel, confirm the current generated Prisma client contract:

```bash
rg -n 'generator client|provider = "prisma-client"|output   = "../src/generated/prisma"' prisma/schema.prisma
```

Expected: current schema uses Prisma 7's `prisma-client` generator and outputs to `../src/generated/prisma`.

When configuring the `@core/prisma` plugin, keep the repo's Prisma client generator block in `zenstack/schema.zmodel`:

```zmodel
generator client {
    provider = 'prisma-client'
    output = '../src/generated/prisma'
}
```

ZenStack docs say Prisma client generators can be removed because ZenStack runtime does not use Prisma Client. That generic advice does not apply to this repo yet: untouched modules still import `@/generated/prisma`, and local Prisma tooling still needs the Prisma 7 output path. ZenStack 3.7 can otherwise emit Prisma's older/default `prisma-client-js` generator shape. If `npx zen generate` cannot preserve this Prisma 7 generator block, stop and document the smallest supported ZenStack configuration before proceeding; do not silently break imports from `@/generated/prisma`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json zenstack/schema.zmodel
git commit -m "build: add ZenStack and Better Auth schema tooling"
```

## Task 3: Port Auth Models Into ZModel and Move Prisma Schema Source to ZModel

**Files:**
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Do not run Better Auth CLI against the old Prisma adapter**

The current app still uses:

```ts
database: prismaAdapter(prisma, { provider: 'postgresql' }),
```

Do not run `npx @better-auth/cli generate` against this old configuration and treat the result as final, because it targets Prisma schema generation. First port the current Better Auth tables from `prisma/schema.prisma` into `zenstack/schema.zmodel` manually: `User`, `Session`, `Account`, `Verification`, lockout/audit models, admin plugin columns, and app-specific user fields.

- [ ] **Step 2: Record the deferred Better Auth CLI verification**

Do not run the CLI yet. Add a task note for Task 5: after `src/libs/auth.ts` uses `zenstackAdapter`, first verify the CLI version:

```bash
npm view @better-auth/cli version dependencies --json
```

Only if the resolved CLI is compatible with this repo's installed `better-auth` version, install the pinned compatible CLI and run:

```bash
npx @better-auth/cli generate
```

Expected: any generated model differences are reviewed against `zenstack/schema.zmodel`. Patch ZModel if Better Auth requires a missing auth/admin field. Do not let the CLI overwrite the app schema blindly. If no compatible CLI is available, skip this command and document the manual comparison against Better Auth docs and installed package types in the task notes.

- [ ] **Step 3: Copy remaining app Prisma models into ZModel**

Move the remaining current `prisma/schema.prisma` model definitions into `zenstack/schema.zmodel` below the Better Auth models. Preserve:

```zmodel
@@map(...)
@map(...)
@db.Text
@default(...)
@updatedAt
@relation(...)
```

Keep this repo's Prisma 7 generator block in ZModel so the `@core/prisma` plugin emits the same client output path:

```zmodel
generator client {
    provider = 'prisma-client'
    output = '../src/generated/prisma'
}
```

Expected: `zenstack/schema.zmodel` contains the full app schema.

- [ ] **Step 4: Update seed role defaults and mirrors**

Before generating migrations, update seed fixtures so every user has:

```ts
appRole: Role.USER,
role: Role.USER,
```

unless the seed intentionally grants a privileged app role. For privileged seeded users, set both fields to the same single role.

Expected: admin/bootstrap users are not accidentally downgraded by missing `appRole`, and non-admin users do not have blank Better Auth `role` values.

- [ ] **Step 5: Generate Prisma schema from ZModel**

Run:

```bash
npx zen generate --schema zenstack/schema.zmodel
npx prisma generate
```

Expected: `prisma/schema.prisma` is regenerated by the `@core/prisma` plugin, still includes the Prisma 7 `generator client` output to `../src/generated/prisma`, and root Prisma client generation succeeds. Treat Prisma 7 compatibility as a hard gate before coding against generated types.

- [ ] **Step 6: Confirm generated ZenStack schema artifact**

Confirm `npx zen generate` produced the runtime schema metadata file used by `src/libs/zenstack/schema.ts`:

```bash
rg --files zenstack | rg '^zenstack/schema\\.ts$'
```

Expected: `zenstack/schema.ts` exists and is committed with the task that first imports it. Do not rely on an uncommitted local generated artifact, and do not add a custom build workaround unless the generated output path is different in the installed ZenStack version.

- [ ] **Step 7: Confirm generated Prisma still supports Better Auth**

Run:

```bash
rg -n 'model User|model Session|model Account|role|banned|ban_reason|impersonated_by' prisma/schema.prisma
```

Expected: generated schema still includes Better Auth tables and compatibility fields.

- [ ] **Step 8: Verify types**

Run:

```bash
SKIP_ENV_VALIDATION=true npm run check:types
```

Expected: generated schema does not create missing imports or missing generated Prisma client types. If typecheck fails, the failure must be directly attributable to still-pending migration tasks and documented in the task notes before proceeding.

- [ ] **Step 9: Commit**

```bash
git add zenstack/schema.zmodel zenstack/schema.ts prisma/schema.prisma prisma/seed.ts prisma/seedMitSailing src/data/mit-sailing
git commit -m "build: generate auth and Prisma schemas from ZModel"
```

## Task 4: Add AppRole and Single-Role Permission Helpers

**Files:**
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`
- Modify: `src/libs/auth/roles.ts`
- Modify: `src/libs/auth/roles.test.ts`
- Create: `src/libs/auth/appPermissions.ts`
- Create: `src/libs/auth/appPermissions.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/libs/auth/appPermissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  Permission,
  getAppRolePermissions,
  hasAnyPermission,
  hasPermission,
  isAdminAppRole,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';

describe('app permissions', () => {
  it('fails closed to user for blank and unknown roles', () => {
    expect(normalizeAppRole('')).toBe(Role.USER);
    expect(normalizeAppRole(null)).toBe(Role.USER);
    expect(normalizeAppRole('admin,dock_staff')).toBe(Role.USER);
    expect(normalizeAppRole('unknown')).toBe(Role.USER);
  });

  it('grants admin every permission', () => {
    const permissions = getAppRolePermissions(Role.ADMIN);

    expect(isAdminAppRole(Role.ADMIN)).toBe(true);
    expect(hasPermission(permissions, Permission.USERS_DELETE)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(true);
  });

  it('allows dock staff into operational admin without role assignment', () => {
    const permissions = getAppRolePermissions(Role.DOCK_STAFF);

    expect(hasPermission(permissions, Permission.ADMIN_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(true);
    expect(isAdminAppRole(Role.DOCK_STAFF)).toBe(false);
  });

  it('checks any permission', () => {
    const permissions = getAppRolePermissions(Role.VOLUNTEER_INSTRUCTOR);

    expect(
      hasAnyPermission(permissions, [
        Permission.EVENTS_MANAGE,
        Permission.RATINGS_ASSIGN,
      ])
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- src/libs/auth/appPermissions.test.ts
```

Expected: FAIL because `appPermissions.ts` does not exist.

- [ ] **Step 3: Add `appRole` to ZModel User**

In `zenstack/schema.zmodel`, update `model User`:

```zmodel
model User {
    id      String  @id
    appRole AppRole @default(user) @map('app_role')
    role    String  @default('user')

    // keep existing fields unchanged
}
```

Do not remove `role`; Better Auth admin plugin still needs the compatibility mirror.

- [ ] **Step 4: Implement single-role helpers**

Create `src/libs/auth/appPermissions.ts`:

```ts
import { Role, isRole } from '@/libs/auth/roles';

export const Permission = {
  ADMIN_VIEW: 'admin.view',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  EVENTS_MANAGE: 'events.manage',
  PAVILION_RESERVATIONS_MANAGE: 'pavilionReservations.manage',
  NEWSLETTER_MANAGE: 'newsletter.manage',
  DONATION_FUNDS_MANAGE: 'donationFunds.manage',
  EVENT_CATEGORIES_MANAGE: 'eventCategories.manage',
  CLASS_CATEGORIES_MANAGE: 'classCategories.manage',
  FLEET_MANAGE: 'fleet.manage',
  SAILING_CLASSES_MANAGE: 'sailingClasses.manage',
  SAILING_RATINGS_MANAGE: 'sailingRatings.manage',
  SAILING_RATING_RULES_MANAGE: 'sailingRatingRules.manage',
  SITE_ALERTS_MANAGE: 'siteAlerts.manage',
  CMS_VIEW: 'cms.view',
  CMS_EDIT: 'cms.edit',
  CMS_DELETE: 'cms.delete',
  RATINGS_ASSIGN: 'ratings.assign',
  CARDS_REVIEW: 'cards.review',
  CARDS_APPROVE: 'cards.approve',
  CARDS_ASSIGN_NUMBER: 'cards.assignNumber',
  CARDS_PRINT: 'cards.print',
  CARDS_EXPIRE: 'cards.expire',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_OVERRIDE: 'payments.override',
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_SYNC: 'warehouse.sync',
  ELIGIBILITY_VERIFY_GYM_MEMBERSHIP: 'eligibility.verifyGymMembership',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission) as readonly Permission[];

const ROLE_PERMISSIONS = {
  [Role.USER]: [],
  [Role.VOLUNTEER]: [],
  [Role.VOLUNTEER_INSTRUCTOR]: [
    Permission.ADMIN_VIEW,
    Permission.RATINGS_ASSIGN,
  ],
  [Role.DOCK_STAFF]: [
    Permission.ADMIN_VIEW,
    Permission.USERS_VIEW,
    Permission.EVENTS_MANAGE,
    Permission.CARDS_REVIEW,
    Permission.CARDS_APPROVE,
    Permission.CARDS_ASSIGN_NUMBER,
    Permission.CARDS_PRINT,
  ],
  [Role.DOCK_MASTER]: [
    Permission.ADMIN_VIEW,
    Permission.USERS_VIEW,
    Permission.EVENTS_MANAGE,
    Permission.CARDS_REVIEW,
    Permission.CARDS_APPROVE,
    Permission.CARDS_ASSIGN_NUMBER,
    Permission.CARDS_PRINT,
    Permission.CARDS_EXPIRE,
    Permission.PAYMENTS_VIEW,
    Permission.WAREHOUSE_VIEW,
    Permission.WAREHOUSE_SYNC,
    Permission.ELIGIBILITY_VERIFY_GYM_MEMBERSHIP,
  ],
  [Role.ADMIN]: ALL_PERMISSIONS,
} as const satisfies Record<Role, readonly Permission[]>;

export function normalizeAppRole(value: unknown): Role {
  return isRole(value) ? value : Role.USER;
}

export function getAppRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  permissions: readonly Permission[],
  permission: Permission
): boolean {
  return permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly Permission[],
  required: readonly Permission[]
): boolean {
  return required.some((permission) => permissions.includes(permission));
}

export function isAdminAppRole(role: Role): boolean {
  return role === Role.ADMIN;
}
```

Do not add role inheritance helpers in this PR. The explicit map is shorter to debug and keeps each role's grants visible. Keep `Role.ADMIN` as all permissions.

- [ ] **Step 5: Simplify roles**

In `src/libs/auth/roles.ts`, remove comma parsing and keep only single-role normalization:

```ts
export const ROLE_VALUES = [
  Role.USER,
  Role.VOLUNTEER,
  Role.VOLUNTEER_INSTRUCTOR,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
  Role.ADMIN,
] as const;

export function normalizeRole(role: unknown): Role {
  return isRole(role) ? role : Role.USER;
}
```

Delete `parseRoles`. Export `ROLE_VALUES` so Better Auth additional-field config, client additional-field inference, tests, and role selects reuse one typed value list.

Update `src/libs/auth/roles.test.ts` in the same step:

- delete `parseRoles` tests;
- delete multi-role admin-wins expectations;
- assert `normalizeRole('admin,dock_staff')` returns `Role.USER`;
- assert `ROLE_VALUES` contains exactly the six supported single roles.

- [ ] **Step 6: Remove `EVENTS_CREATE` references**

This PR intentionally uses `Permission.EVENTS_MANAGE` for event create/update/admin workflows so there is one event-management permission path. Remove `Permission.EVENTS_CREATE` from code and tests, and replace any guard like:

```ts
await requireAnyPermission(
  [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
  locale
);
```

with:

```ts
await requirePermission(Permission.EVENTS_MANAGE, locale);
```

Expected: `Permission.EVENTS_CREATE` does not exist in `appPermissions.ts`, admin navigation, admin event pages, event admin actions, or tests.

- [ ] **Step 7: Generate schemas and run tests**

Run:

```bash
npx zen generate --schema zenstack/schema.zmodel
npm run test -- src/libs/auth/appPermissions.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add zenstack/schema.zmodel prisma/schema.prisma src/libs/auth/roles.ts src/libs/auth/roles.test.ts src/libs/auth/appPermissions.ts src/libs/auth/appPermissions.test.ts
git commit -m "refactor: add app role permission context"
```

## Task 5: Add ZenStack Client and Auth Context

**Files:**
- Create: `src/libs/zenstack/client.ts`
- Create: `src/libs/zenstack/auth.ts`
- Create: `src/libs/zenstack/schema.ts`
- Modify: `src/libs/auth/appAuthContext.ts`
- Modify: `src/libs/auth.ts`
- Modify: `src/libs/auth-client.ts`
- Test: `src/libs/zenstack/auth.test.ts`
- Modify: `src/libs/auth/dal.ts`

- [ ] **Step 1: Write failing auth context tests**

Create `src/libs/zenstack/auth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { Permission } from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';
import { authContextFromUser } from '@/libs/zenstack/auth';

describe('authContextFromUser', () => {
  it('uses appRole as the source of truth', () => {
    const context = authContextFromUser({
      appRole: Role.DOCK_STAFF,
      banned: false,
      emailVerified: true,
      id: 'user-1',
      role: Role.USER,
    });

    expect(context).toEqual({
      appRole: Role.DOCK_STAFF,
      id: 'user-1',
      permissions: expect.arrayContaining([
        Permission.ADMIN_VIEW,
        Permission.EVENTS_MANAGE,
      ]),
    });
  });

  it('fails closed to user for unknown appRole', () => {
    const context = authContextFromUser({
      appRole: 'unknown',
      banned: false,
      emailVerified: true,
      id: 'user-1',
      role: Role.ADMIN,
    });

    expect(context?.appRole).toBe(Role.USER);
    expect(context?.permissions).toEqual([]);
  });

  it('returns null for banned or unverified users', () => {
    expect(
      authContextFromUser({
        appRole: Role.ADMIN,
        banned: true,
        emailVerified: true,
        id: 'user-1',
      })
    ).toBeNull();

    expect(
      authContextFromUser({
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: false,
        id: 'user-1',
      })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- src/libs/zenstack/auth.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement client-safe app auth context helper**

Create `src/libs/auth/appAuthContext.ts` without `import 'server-only'`:

```ts
import type { Permission } from '@/libs/auth/appPermissions';
import {
  getAppRolePermissions,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import type { Role } from '@/libs/auth/roles';

export type AppAuthContext = {
  id: string;
  appRole: Role;
  permissions: readonly Permission[];
};

export function appAuthContextFromUser(user: {
  appRole?: unknown;
  banned?: unknown;
  emailVerified?: unknown;
  id: string;
  role?: unknown;
}): AppAuthContext | null {
  if (user.banned === true || user.emailVerified !== true) {
    return null;
  }

  const appRole = normalizeAppRole(user.appRole);
  return {
    appRole,
    id: user.id,
    permissions: getAppRolePermissions(appRole),
  };
}
```

Use this pure helper from `adminHeaderLink.ts`, `PublicAdminEditLink.tsx`, admin nav/access helpers, and tests that may be imported by client components. Do not import `src/libs/zenstack/auth.ts` into code that can reach a client bundle.

- [ ] **Step 4: Implement ZenStack auth context adapter**

Create `src/libs/zenstack/auth.ts`:

```ts
import 'server-only';
import {
  appAuthContextFromUser,
  type AppAuthContext,
} from '@/libs/auth/appAuthContext';

export type ZenStackAuthContext = AppAuthContext;

export function authContextFromUser(user: {
  appRole?: unknown;
  banned?: unknown;
  emailVerified?: unknown;
  id: string;
  role?: unknown;
}): ZenStackAuthContext | null {
  return appAuthContextFromUser(user);
}
```

- [ ] **Step 5: Add generated schema re-export**

After `npx zen generate --schema zenstack/schema.zmodel`, locate the generated schema module:

```bash
rg --files | rg '(^|/)schema\\.ts$|zenstack'
```

Create `src/libs/zenstack/schema.ts` as the single app import point. If ZenStack generated `zenstack/schema.ts` at the repo root, re-export it with a relative import from this file. Do not import `@/zenstack/schema`, because `@/*` maps to `./src/*` in this repo.

Choose the re-export shape based on the generated file:

```ts
export { schema } from '../../../zenstack/schema';
export type { SchemaType } from '../../../zenstack/schema';
```

or, if the generated module has a default export only:

```ts
export { default as schema } from '../../../zenstack/schema';
export type { SchemaType } from '../../../zenstack/schema';
```

Expected: app code imports generated ZenStack metadata from `@/libs/zenstack/schema`.

- [ ] **Step 6: Implement ZenStack client**

Create `src/libs/zenstack/client.ts`:

```ts
import 'server-only';
import { ZenStackClient } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import { schema } from '@/libs/zenstack/schema';
import type { ZenStackAuthContext } from '@/libs/zenstack/auth';

const globalForZenStack = globalThis as typeof globalThis & {
  zenStackPool?: Pool;
  zenStackClient?: ZenStackClient<typeof schema>;
};

const pool =
  globalForZenStack.zenStackPool ??
  new Pool({
    connectionString: Env.DATABASE_URL,
  });

if (Env.NODE_ENV !== 'production') {
  globalForZenStack.zenStackPool = pool;
}

export const zenStackRawClient =
  globalForZenStack.zenStackClient ??
  new ZenStackClient(schema, {
    dialect: new PostgresDialect({ pool }),
  });

if (Env.NODE_ENV !== 'production') {
  globalForZenStack.zenStackClient = zenStackRawClient;
}

export const zenStackPolicyClient = zenStackRawClient.$use(
  new PolicyPlugin()
);

export function zenStackClientForAuth(
  authContext?: ZenStackAuthContext | null
) {
  return zenStackPolicyClient.$setAuth(
    authContext
      ? { appRole: authContext.appRole, id: authContext.id }
      : undefined
  );
}
```

- [ ] **Step 7: Switch Better Auth to ZenStack adapter**

In `src/libs/auth.ts`, replace:

```ts
import { prismaAdapter } from '@better-auth/prisma-adapter';
```

with:

```ts
import { zenstackAdapter } from '@zenstackhq/better-auth';
import { zenStackRawClient } from '@/libs/zenstack/client';
```

Replace:

```ts
database: prismaAdapter(prisma, { provider: 'postgresql' }),
```

with:

```ts
database: zenstackAdapter(zenStackRawClient, {
  provider: 'postgresql',
}),
```

Keep the existing `prisma` import only where the auth hooks still use direct Prisma calls for email verification cleanup, lockout counts, and newsletter setup. Do not use the Better Auth Prisma adapter after this task.

- [ ] **Step 8: Expose `appRole` in Better Auth session user data**

Configure Better Auth user fields so `session.user.appRole`, `session.user.emailVerified`, and `session.user.banned` are available anywhere the app builds an auth context. Use Better Auth's documented `user.additionalFields` / synthetic-user support as needed, with `appRole` set to `input: false`.

The `appRole` field must map to the existing app-owned database column:

```ts
import { ROLE_VALUES, Role } from '@/libs/auth/roles';

user: {
  additionalFields: {
    appRole: {
      type: ROLE_VALUES,
      required: false,
      defaultValue: Role.USER,
      input: false,
      fieldName: 'app_role',
    },
    // keep existing unconfirmedEmail field unchanged
  },
}
```

If Better Auth's current docs require a different shape for including a custom column in `session.user`, use that documented shape, but preserve these requirements: database column `app_role`, no client input, default app role `user`, app role constrained to known `Role` values where the package supports it, and session user includes `appRole`, `emailVerified`, and `banned`.

Expected:

- new users default to `appRole: Role.USER`;
- session user data includes `appRole`, `emailVerified`, and `banned`;
- app auth context returns `null` for banned or unverified users;
- Better Auth `role` remains only a compatibility mirror.

Update `src/libs/auth-client.ts` if needed so client code can read these session fields without casts. Better Auth docs support `inferAdditionalFields`:

```ts
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { ROLE_VALUES } from '@/libs/auth/roles';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        appRole: { type: ROLE_VALUES },
        banned: { type: 'boolean' },
        emailVerified: { type: 'boolean' },
      },
    }),
  ],
});
```

If the current Better Auth version infers these fields from the server `auth` type without this plugin, prefer the documented lighter option, but do not leave client header code relying on `as` casts for these fields.

- [ ] **Step 9: Narrow Better Auth admin plugin permissions**

Replace the current non-admin Better Auth `authStaffRole` mapping with a no-account-admin role. Only `Role.ADMIN` should be able to call Better Auth admin plugin operations such as `ban`, `impersonate`, `delete`, `set-password`, and `set-role`.

Create the no-op role explicitly:

```ts
const authNoAdminRole = authAdminAccessControl.newRole({
  session: [],
  user: [],
});
```

Expected:

```ts
roles: {
  [Role.USER]: authNoAdminRole,
  [Role.VOLUNTEER]: authNoAdminRole,
  [Role.VOLUNTEER_INSTRUCTOR]: authNoAdminRole,
  [Role.DOCK_STAFF]: authNoAdminRole,
  [Role.DOCK_MASTER]: authNoAdminRole,
  [Role.ADMIN]: authAdminRole,
}
```

Staff admin UI access remains controlled by `User.appRole` and app permissions, not by Better Auth plugin roles.

- [ ] **Step 10: Run version-verified Better Auth CLI verification**

Now that Better Auth uses `zenstackAdapter`, verify the CLI line before installing or running it:

```bash
npm view @better-auth/cli version dependencies --json
```

If the resolved CLI depends on an older Better Auth line than this repo's installed `better-auth`, do not install or run it. In that case, compare `zenstack/schema.zmodel` manually against Better Auth current docs and installed package types, document the skipped CLI with the resolved version, and continue only if the ZModel contains every required Better Auth/admin plugin field.

If a compatible CLI exists, install that pinned version and run:

```bash
npx @better-auth/cli generate
```

Expected: review any generated schema differences and patch `zenstack/schema.zmodel` if Better Auth requires a missing auth/admin field. Do not let the CLI blindly overwrite unrelated app model definitions.

- [ ] **Step 11: Run test and typecheck**

Run:

```bash
npm run test -- src/libs/zenstack/auth.test.ts
SKIP_ENV_VALIDATION=true npm run check:types
```

Expected: auth test passes; typecheck may expose exact ZenStack client, generated schema path, or `zenstackAdapter` type import details. Fix only the ZenStack/Better Auth adapter typing needed for package compatibility.

- [ ] **Step 12: Commit**

```bash
git add zenstack/schema.ts src/libs/zenstack/client.ts src/libs/zenstack/auth.ts src/libs/zenstack/schema.ts src/libs/zenstack/auth.test.ts src/libs/auth/appAuthContext.ts src/libs/auth.ts src/libs/auth-client.ts
git commit -m "feat: use ZenStack for Better Auth storage"
```

## Task 6: Add ZenStack Zod Factory and Local Studio Verification

**Files:**
- Create: `src/libs/zenstack/zod.ts`
- Create: `src/libs/zenstack/zod-client.ts` if client forms cannot import the server module safely
- Create: `src/libs/zenstack/zod.test.ts`

- [ ] **Step 1: Write failing Zod factory test**

Create `src/libs/zenstack/zod.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { appRoleSchema, eventCategoryCreateSchema } from '@/libs/zenstack/zod';

describe('ZenStack Zod schemas', () => {
  it('validates app roles from ZModel enum', () => {
    expect(appRoleSchema.safeParse('admin').success).toBe(true);
    expect(appRoleSchema.safeParse('unknown').success).toBe(false);
  });

  it('validates event category create shape', () => {
    expect(
      eventCategoryCreateSchema.safeParse({
        isVisible: true,
        name: 'Regattas',
      }).success
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- src/libs/zenstack/zod.test.ts
```

Expected: FAIL because `src/libs/zenstack/zod.ts` does not exist.

- [ ] **Step 3: Implement Zod schema factory**

Create `src/libs/zenstack/zod.ts`:

```ts
import { createSchemaFactory } from '@zenstackhq/zod';
import { schema } from '@/libs/zenstack/schema';

const zodFactory = createSchemaFactory(schema);

export const appRoleSchema = zodFactory.makeEnumSchema('AppRole');

const eventCategoryFormFields = {
  isVisible: true,
  name: true,
} as const;

export const eventCategoryCreateSchema =
  zodFactory
    .makeModelSchema('EventCategory', {
      select: eventCategoryFormFields,
      optionality: 'defaults',
    })
    .strict();

export const eventCategoryUpdateSchema =
  zodFactory
    .makeModelSchema('EventCategory', {
      select: eventCategoryFormFields,
      optionality: 'all',
    })
    .strict();
```

Use ZenStack's documented `@zenstackhq/zod` integration. Current docs show `createSchemaFactory`, `makeEnumSchema`, `makeModelCreateSchema`, and `makeModelSchema`. The installed `@zenstackhq/zod@3.7.0` types also expose `makeModelSchema(model, { select, omit, include, optionality })`, which is useful here because regular EventCategory form validation intentionally omits persistence/order fields. Before committing, verify the exact installed type signatures and use the smallest docs/type-supported API surface rather than duplicating schemas by hand.

Use these generated schemas first for EventCategory. Do not rewrite every existing Zod form schema in this task.

Do not require `displayOrder`, `id`, `createdAt`, or `accentClassName` for EventCategory form validation in this PR. The existing EventCategory admin form exposes only `name` and `isVisible`; including `accentClassName` in the parsed update payload would clear existing accent values because the form does not post that field. The existing create path computes the next display order server-side and adds `id` plus `createdAt` in the handler; keep that behavior to avoid adding ordering or persistence fields to the form. Reorder remains handled by the catalog reorder action, not the create/update form schema.

Keep this schema module client-safe unless package types prove the generated `schema` import is server-only. React Hook Form client components need to import the same Zod schemas. If the generated schema import pulls in server-only code, split exports:

- `src/libs/zenstack/zod.ts`: server-side schemas and tests;
- `src/libs/zenstack/zod-client.ts`: client-safe EventCategory form schemas derived from generated ZModel metadata or a minimal package-supported client export.

Do not duplicate hand-written validation if ZenStack's Zod package can provide a client-safe schema.

- [ ] **Step 4: Add local Studio note to package metadata**

Do not add an `npm run` script because repo instructions restrict `npm run` usage. Local Studio starts with:

```bash
npx zenstack studio
```

Expected: ZenStack Studio can be launched locally for database exploration after schema generation and local DB setup. Use it only for manual verification; do not make tests depend on Studio.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- src/libs/zenstack/zod.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/libs/zenstack/zod.ts src/libs/zenstack/zod.test.ts
git commit -m "feat: add ZenStack Zod schema factory"
```

## Task 7: Replace CASL Route Gates With Auth Context Permission Checks

**Files:**
- Modify: `src/libs/auth/dal.ts`
- Modify: `src/libs/auth/adminHeaderLink.ts`
- Modify: `src/components/mit-sailing/admin/PublicAdminEditLink.tsx`
- Modify: `src/libs/admin/adminAreaAccess.ts`
- Modify: `src/libs/admin/adminNavigation.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/page.tsx`
- Modify: `src/app/api/admin/cms-media/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/[id]/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`
- Test: related existing tests

- [ ] **Step 1: Update tests to describe auth-context gates**

Update `src/libs/auth/dal.test.ts` so permission tests mock a session user with `appRole`:

```ts
user: {
  appRole: Role.DOCK_STAFF,
  banned: false,
  email: 'staff@example.com',
  emailVerified: true,
  id: 'staff-1',
  name: 'Staff',
  role: Role.USER,
}
```

Assert:

```ts
await expect(requirePermission(Permission.ADMIN_VIEW, 'en')).resolves.toMatchObject({
  user: { id: 'staff-1' },
});
```

Assert an impersonated session redirects:

```ts
session: { impersonatedBy: 'admin-1' }
```

- [ ] **Step 2: Run red tests**

Run:

```bash
npm run test -- src/libs/auth/dal.test.ts src/libs/auth/adminHeaderLink.test.ts src/libs/admin/adminAreaAccess.test.ts
```

Expected: FAIL because implementation still uses CASL and `session.user.role`.

- [ ] **Step 3: Replace `requireAnyPermission`**

In `src/libs/auth/dal.ts`, import app permission helpers and `authContextFromUser`. Replace CASL/grant logic with:

```ts
const authContext = authContextFromUser(session.user);
if (!authContext) {
  redirect(homeHref);
}
if (!hasAnyPermission(authContext.permissions, permissions)) {
  redirect(homeHref);
}
```

Keep:

```ts
if (session.session.impersonatedBy) {
  redirect(homeHref);
}
```

Return the session with the verified auth context attached so downstream server actions do not recompute auth context or fall back to Better Auth `role`:

```ts
export type AuthorizedAuthSession = NonNullable<AuthSession> & {
  authContext: ZenStackAuthContext;
};

return { ...session, authContext };
```

Update `requirePermission` and `requireAdmin` to return `AuthorizedAuthSession`. Existing call sites can still read `session.user.id`, while catalog/event/admin handlers can pass `session.authContext` to ZenStack clients.

- [ ] **Step 4: Replace admin nav filtering**

In `src/libs/admin/adminNavigation.ts`, replace `adminNavItemsForAbility` with:

```ts
export function adminNavItemsForPermissions(
  permissions: readonly Permission[]
): AdminNavItem[] {
  return ADMIN_SITE_NAV_ITEMS.filter((item) =>
    hasAnyPermission(permissions, item.permissions)
  );
}
```

Remove the `/admin/roles` nav item.

- [ ] **Step 5: Replace admin area access**

In `src/libs/admin/adminAreaAccess.ts`, return:

```ts
export type AdminAreaAccess = {
  authContext: ZenStackAuthContext;
  appRole: Role;
  navItems: AdminNavItem[];
  session: NonNullable<AuthSession>;
};
```

Build nav from `adminNavItemsForPermissions(authContext.permissions)`. If the auth context helper returns `null` because the user is banned, unverified, missing, or malformed, redirect before rendering admin UI.

- [ ] **Step 6: Replace admin header button gate**

In `src/libs/auth/adminHeaderLink.ts`, show the admin link only when:

```ts
hasPermission(authContext.permissions, Permission.ADMIN_VIEW)
```

For client-visible header helpers, build the client-safe auth context from:

```ts
{
  appRole: user?.appRole,
  banned: user?.banned,
  emailVerified: user?.emailVerified,
  id: user?.id,
}
```

and treat a `null` auth context as not visible. Do not read `user.role` for the header link.

- [ ] **Step 7: Replace public edit link grant loading**

In `src/components/mit-sailing/admin/PublicAdminEditLink.tsx`, delete `listRolePermissionGrants()` usage. Build the auth context from the current session user and show edit links through app permission helpers. Keep the same public/admin UX; only the authorization source changes.

Expected: no `RolePermissionGrant` dependency remains in public edit links.

- [ ] **Step 8: Replace current-user role checks**

In `src/libs/auth/dal.ts`, add `appRole` to `CurrentUser` and derive it from `normalizeAppRole(user.appRole)`. Keep `role` only if existing profile/auth UI still displays Better Auth compatibility state; do not use it for authorization.

Update CMS media admin API routes to authorize against `currentUser.appRole === Role.ADMIN` or `hasPermission(getAppRolePermissions(currentUser.appRole), Permission.CMS_EDIT)`, not `currentUser.role === Role.ADMIN`:

```txt
src/app/api/admin/cms-media/route.ts
src/app/api/admin/cms-media/uploads/route.ts
src/app/api/admin/cms-media/uploads/[id]/route.ts
src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts
```

Expected: no admin route authorizes from Better Auth `role` after this task.

- [ ] **Step 9: Replace stale event-create permission guards**

Replace any remaining `Permission.EVENTS_CREATE` page or action guards with `Permission.EVENTS_MANAGE`. This includes admin event create pages and event admin action tests.

Expected:

```bash
rg -n "EVENTS_CREATE" src tests
```

returns no matches.

- [ ] **Step 10: Run focused tests**

Run:

```bash
npm run test -- src/libs/auth/dal.test.ts src/libs/auth/adminHeaderLink.test.ts src/libs/admin/adminAreaAccess.test.ts src/components/mit-sailing/admin/PublicAdminEditLink.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/libs/auth/dal.ts src/libs/auth/adminHeaderLink.ts src/components/mit-sailing/admin/PublicAdminEditLink.tsx src/libs/admin/adminAreaAccess.ts src/libs/admin/adminNavigation.ts 'src/app/[locale]/(marketing)/(site)/admin/page.tsx' src/app/api/admin/cms-media
git commit -m "refactor: gate admin access with ZenStack auth context"
```

## Task 8: Remove RolePermissionGrant and Roles Admin Page

**Files:**
- Delete: `src/libs/auth/rolePermissionGrants.ts`
- Delete: `src/libs/admin/roles/roleAdminActions.ts`
- Delete: `src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx`
- Delete: `src/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll.tsx`
- Delete: `src/libs/admin/roles/roleAdminActions.test.ts`
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/locales/en.json`
- Modify tests

- [ ] **Step 1: Write deletion characterization search**

Run:

```bash
rg -n "RolePermissionGrant|rolePermissionGrant|role_permission_grants|ROLES_MANAGE_PERMISSIONS|roles.managePermissions|/admin/roles|roleAdminActions|listRolePermissionGrants" src prisma tests package.json
```

Expected: many matches before deletion.

- [ ] **Step 2: Remove model and seed**

Delete `model RolePermissionGrant` from `zenstack/schema.zmodel`.

In `prisma/seed.ts`, delete the `permissionGrantsForSeed()` import and the `prisma.rolePermissionGrant.createMany` block.

- [ ] **Step 3: Delete roles page and actions**

Delete:

```txt
src/libs/auth/rolePermissionGrants.ts
src/libs/admin/roles/roleAdminActions.ts
src/app/[locale]/(marketing)/(site)/admin/roles/page.tsx
src/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll.tsx
src/libs/admin/roles/roleAdminActions.test.ts
```

- [ ] **Step 4: Remove permission constants**

Remove `ROLES_ASSIGN` and `ROLES_MANAGE_PERMISSIONS` from `Permission`. Role assignment is admin-only through `appRole === Role.ADMIN`, not through a configurable permission string.

- [ ] **Step 5: Generate and search**

Run:

```bash
npx zen generate --schema zenstack/schema.zmodel
rg -n "RolePermissionGrant|rolePermissionGrant|role_permission_grants|ROLES_MANAGE_PERMISSIONS|roles.managePermissions|/admin/roles|roleAdminActions|listRolePermissionGrants" src prisma tests package.json
```

Expected: no source references remain. Do not include `docs` in this command, because this implementation plan intentionally contains historical references while it is still being executed.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- src/libs/auth/appPermissions.test.ts src/libs/admin/adminAreaAccess.test.ts 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
```

Expected: PASS after tests are updated to single-role and no roles page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove role permission grants"
```

## Task 9: Add AppRole Assignment Through ZenStack With Better Auth Role Mirror

**Files:**
- Create: `src/libs/admin/users/appRoleActions.ts`
- Create: `src/libs/admin/users/appRoleActions.test.ts`
- Modify: `src/libs/admin/users/usersAdminHandlers.ts`
- Modify: `src/libs/admin/users/usersAdminSchemas.ts`
- Modify: `src/libs/admin/users/userAdminDefinitions.ts`

- [ ] **Step 1: Write failing last-admin tests**

Create `src/libs/admin/users/appRoleActions.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  setRole: vi.fn(),
  countAdmins: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/libs/zenstack/client', () => ({
  zenStackRawClient: {
    user: {
      count: mocks.countAdmins,
      findUnique: mocks.findUnique,
      update: mocks.updateUser,
    },
  },
}));

vi.mock('@/libs/auth/server-admin', () => ({
  setBetterAuthRoleMirror: mocks.setRole,
}));

describe('updateUserAppRole', () => {
  it('updates appRole and Better Auth role mirror', async () => {
    mocks.countAdmins.mockResolvedValue(2);
    mocks.findUnique.mockResolvedValue({ appRole: Role.ADMIN, id: 'user-1' });
    mocks.updateUser.mockResolvedValue({ id: 'user-1' });
    const { updateUserAppRole } = await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1', permissions: [] },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { appRole: Role.DOCK_STAFF },
    });
    expect(mocks.setRole).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      role: Role.DOCK_STAFF,
      userId: 'user-1',
    });
  });

  it('blocks demoting the last admin', async () => {
    mocks.countAdmins.mockResolvedValue(1);
    mocks.findUnique.mockResolvedValue({ appRole: Role.ADMIN, id: 'admin-1' });
    const { updateUserAppRole } = await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1', permissions: [] },
        nextRole: Role.USER,
        requestHeaders: new Headers(),
        targetUserId: 'admin-1',
      })
    ).resolves.toEqual({ ok: false, code: 'last_admin' });
  });

  it('rolls back Better Auth role mirror when appRole update fails', async () => {
    mocks.countAdmins.mockResolvedValue(2);
    mocks.findUnique.mockResolvedValue({ appRole: Role.ADMIN, id: 'user-1' });
    mocks.updateUser.mockRejectedValue(new Error('database unavailable'));
    const { updateUserAppRole } = await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1', permissions: [] },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).rejects.toThrow('database unavailable');

    expect(mocks.setRole).toHaveBeenNthCalledWith(1, {
      requestHeaders: expect.any(Headers),
      role: Role.DOCK_STAFF,
      userId: 'user-1',
    });
    expect(mocks.setRole).toHaveBeenNthCalledWith(2, {
      requestHeaders: expect.any(Headers),
      role: Role.ADMIN,
      userId: 'user-1',
    });
  });
});
```

Also update `src/libs/admin/users/usersAdminHandlers.test.ts` to cover:

- creating an admin user sets `appRole` through `updateUserAppRole` after Better Auth creates the account;
- user update payloads sent to Better Auth admin APIs do not include `role`;
- demoting, banning, or deleting the final `appRole === Role.ADMIN` user is blocked;
- ban/delete checks do not use Better Auth comma-role parsing.
- if the initial Better Auth `setRole` mirror update fails, the `appRole` database update is not attempted;
- if the `appRole` update fails and the compensating Better Auth `setRole` rollback also fails, the action returns/throws a distinct mirror inconsistency error and logs both failures; do not silently report success.

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- src/libs/admin/users/appRoleActions.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement app role action**

Create `src/libs/admin/users/appRoleActions.ts`:

```ts
import 'server-only';
import { Role } from '@/libs/auth/roles';
import { setBetterAuthRoleMirror } from '@/libs/auth/server-admin';
import type { ZenStackAuthContext } from '@/libs/zenstack/auth';
import { zenStackRawClient } from '@/libs/zenstack/client';
import { logger } from '@/libs/Logger';

type AppRoleUpdateResult =
  | { ok: true }
  | { ok: false; code: 'forbidden' | 'last_admin' | 'role_mirror_inconsistent' };

export async function updateUserAppRole(props: {
  authContext: ZenStackAuthContext;
  nextRole: Role;
  requestHeaders: Headers;
  targetUserId: string;
}): Promise<AppRoleUpdateResult> {
  if (props.authContext.appRole !== Role.ADMIN) {
    return { ok: false, code: 'forbidden' };
  }

  const db = zenStackRawClient;
  const targetUser = await db.user.findUnique({
    where: { id: props.targetUserId },
    select: { appRole: true },
  });
  if (!targetUser) {
    return { ok: false, code: 'forbidden' };
  }

  if (targetUser.appRole === Role.ADMIN && props.nextRole !== Role.ADMIN) {
    const adminCount = await db.user.count({
      where: { appRole: Role.ADMIN },
    });
    if (adminCount <= 1) {
      return { ok: false, code: 'last_admin' };
    }
  }

  await setBetterAuthRoleMirror({
    requestHeaders: props.requestHeaders,
    role: props.nextRole,
    userId: props.targetUserId,
  });

  try {
    await db.user.update({
      where: { id: props.targetUserId },
      data: {
        appRole: props.nextRole,
      },
    });
  } catch (error) {
    try {
      await setBetterAuthRoleMirror({
        requestHeaders: props.requestHeaders,
        role: targetUser.appRole,
        userId: props.targetUserId,
      });
    } catch (rollbackError) {
      logger.error('Failed to roll back Better Auth role mirror: {error}', {
        error,
        operation: 'updateUserAppRole',
        rollbackError,
        targetUserId: props.targetUserId,
      });
      return { ok: false, code: 'role_mirror_inconsistent' };
    }
    throw error;
  }
  return { ok: true };
}
```

The `User` ZModel policy intentionally denies broad updates, so this helper uses the raw ZenStack client after its explicit `authContext.appRole === Role.ADMIN` guard and last-admin check. The mirror update and app-role update cannot share a database transaction if the mirror goes through Better Auth's admin API. Keep `appRole` as source of truth, but add the compensating rollback above and a test for mirror consistency failure. Do not leave a path where `appRole` succeeds and `role` silently stays stale.

If rollback fails, return `role_mirror_inconsistent` to the admin UI and log both the original app-role update error and the rollback error. Do not silently throw only the rollback error, because that loses the database failure context. That is noisy by design; a role mirror inconsistency must be fixed immediately.

Do not implement the earlier unsafe shape:

```ts
await db.user.update({
    where: { id: props.targetUserId },
    data: { appRole: props.nextRole },
  });
```

- [ ] **Step 4: Add Better Auth role mirror helper**

Create a small server-only helper, for example `src/libs/auth/server-admin.ts`, that calls Better Auth's documented admin role API for the compatibility `role` mirror so Better Auth admin/audit behavior still sees the role change. Pass the acting request headers/admin context into this helper; do not use a context-free direct DB role update.

Use the documented server API shape:

```ts
import 'server-only';
import { auth } from '@/libs/auth';
import type { Role } from '@/libs/auth/roles';

export async function setBetterAuthRoleMirror(props: {
  requestHeaders: Headers;
  role: Role;
  userId: string;
}): Promise<void> {
  await auth.api.setRole({
    body: {
      role: props.role,
      userId: props.userId,
    },
    headers: props.requestHeaders,
  });
}
```

Better Auth also accepts `role: string[]`; do not use arrays in this app because this PR is single-role only.

Expected: app authorization remains `appRole`; Better Auth `role` is updated only through this mirror helper.

- [ ] **Step 5: Route user edit role changes through `updateUserAppRole`**

In `usersAdminHandlers.ts`, keep Better Auth admin APIs for:

```txt
create user
ban/unban
delete user
set password
```

Use `updateUserAppRole` only when role changes. Do not update `User.role` directly.

For user creation:

- call Better Auth `createUser` with the default compatibility role only unless Better Auth docs prove a safer atomic app-role path;
- after the user id is returned, call `updateUserAppRole` when the submitted app role is not `Role.USER`;
- if app-role assignment fails after Better Auth creates the user, return a clear mutation error and add a test for the partial-create path before deciding whether to delete the newly created user or leave it as `user`.

For user updates:

- exclude `role` from the `adminUpdateUser` data payload;
- update name/email/emailVerified through Better Auth admin APIs;
- update ban/unban through Better Auth admin APIs;
- update app role only through `updateUserAppRole`.

For last-admin protection:

- demotion, ban, and delete checks must count `User.appRole === Role.ADMIN`;
- do not use Better Auth `role`, comma parsing, or `parseRoles`;
- keep self-delete protection unchanged.

Update admin user row/form types so the editable field is named `appRole`. Keep Better Auth `role` out of form definitions unless it is displayed as a read-only compatibility mirror for debugging.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- src/libs/admin/users/appRoleActions.test.ts src/libs/admin/users/usersAdminHandlers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/libs/admin/users/appRoleActions.ts src/libs/admin/users/appRoleActions.test.ts src/libs/auth/server-admin.ts src/libs/admin/users/usersAdminHandlers.ts src/libs/admin/users/usersAdminSchemas.ts src/libs/admin/users/userAdminDefinitions.ts
git commit -m "feat: assign app roles through ZenStack"
```

## Task 10: Replace Event Created By With EventAdmin

**Files:**
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260423041039_mit_sailing_domain/migration.sql`
- Modify: `src/data/mit-sailing/eventsSeed.ts`
- Modify: `prisma/seedMitSailing/steps.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`

- [ ] **Step 1: Remove `created_by` from ZModel Event**

In `model Event`, delete:

```zmodel
createdByUserId String @map('created_by')
createdBy       User   @relation('EventCreatedBy', fields: [createdByUserId], references: [id], onDelete: Restrict)
@@index([createdByUserId])
```

In `model User`, delete:

```zmodel
eventsCreated Event[] @relation('EventCreatedBy')
```

- [ ] **Step 2: Ensure EventAdmin has uniqueness**

In `model EventAdmin`, add:

```zmodel
@@unique([eventId, adminUserId])
```

- [ ] **Step 3: Remove seed `created_by`**

In `src/data/mit-sailing/eventsSeed.ts`, delete `created_by` from the event type and rows.

Ensure the event admin seed data includes the former creator for each event. If current seed has separate event admin rows, add the former creator user id to that event's admin rows before deleting `created_by`.

- [ ] **Step 4: Remove event create/update writes**

In `prisma/seedMitSailing/steps.ts`, delete `createdByUserId: e.created_by` from both create and update payloads.

In `src/libs/admin/events/eventAdminActions.ts`, delete new event `createdByUserId: session.user.id` and instead ensure the creating user is included in the `EventAdmin` rows for the new event.

Keep first-pass event creation limited to users with `Permission.EVENTS_MANAGE`. Do not keep a separate `EVENTS_CREATE` permission in this PR, because allowing lower roles to create an event and then self-create `EventAdmin` safely requires additional workflow state. Reducing that code path is aligned with the maintenance goal.

- [ ] **Step 5: Remove UI copy**

In `AdminEventFormView.tsx`, remove the “Created by” metadata block.

In `eventAdminQueries.ts`, stop selecting `createdBy`.

- [ ] **Step 6: Generate and update migration history**

Run:

```bash
npx zen generate --schema zenstack/schema.zmodel
```

Edit `prisma/migrations/20260423041039_mit_sailing_domain/migration.sql` so the `events` table never creates:

```sql
"created_by" TEXT NOT NULL
```

and never creates the related index or foreign key.

- [ ] **Step 7: Run event tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: tests updated for `EventAdmin` as the only event management relation.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: manage events through event admins"
```

## Task 11: Encode ZenStack Access Policies

**Files:**
- Modify: `zenstack/schema.zmodel`
- Create: `src/libs/admin/events/zenstackEventAccess.test.ts`
- Test: `src/libs/mit-sailing/eventRegistrationActions.test.ts`
- Test: `src/libs/mit-sailing/eventQueries.test.ts`

- [ ] **Step 1: Add policy tests**

Create `src/libs/admin/events/zenstackEventAccess.test.ts` with integration-style tests that seed a test database and verify:

```ts
it('allows event admins to update assigned events', async () => {});
it('blocks event admins from updating unassigned events', async () => {});
it('allows admin, dock staff, and dock master app roles to update every event', async () => {});
it('allows users to read their own event registrations', async () => {});
it('blocks users from reading another user registration', async () => {});
it('blocks users from directly approving their own event registrations', async () => {});
it('keeps user registration cancellation in the guarded server action', async () => {});
it('allows readable events to include dates, questions, fees, and comments', async () => {});
it('allows users to read and write answers only through their own registration', async () => {});
it('blocks answers whose question belongs to a different event', async () => {});
```

Use the same test database strategy already used by integration-capable tests in this repo. These tests must exercise a real ZenStack `PolicyPlugin` client against seeded rows. Do not mock the ZenStack client for policy tests, because mocks can pass while ZModel policies are wrong.

- [ ] **Step 2: Add ZModel policies**

In `zenstack/schema.zmodel`, add policies:

```zmodel
model User {
    @@allow('read', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master))
    @@allow('read', auth() != null && auth().id == id)
    @@deny('update', true)
}

model Event {
    @@allow('read', isPublished)
    @@allow('read', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master))
    @@allow('read', auth() != null && admins?[adminUserId == auth().id])
    @@allow('create', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master))
    @@allow('update,delete', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master))
    @@allow('update', auth() != null && admins?[adminUserId == auth().id])
}

model EventAdmin {
    @@allow('read', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master || adminUserId == auth().id))
    @@allow('create,update,delete', auth() != null && (auth().appRole == admin || auth().appRole == dock_staff || auth().appRole == dock_master))
}

model EventRegistration {
    @@allow('read', auth() != null && userId == auth().id)
    @@allow('read,update,delete', auth() != null && check(event, 'update'))
    @@allow('create', auth() != null && userId == auth().id && check(event, 'read'))
}

model EventDate {
    @@allow('read', check(event, 'read'))
    @@allow('create,update,delete', check(event, 'update'))
}

model EventRegistrationQuestion {
    @@allow('read', check(event, 'read'))
    @@allow('create,update,delete', check(event, 'update'))
}

model EventEntryFee {
    @@allow('read', check(event, 'read'))
    @@allow('create,update,delete', check(event, 'update'))
}

model EventRegistrationAnswer {
    @@allow('read', auth() != null && check(registration, 'read'))
    @@allow('create,update,delete', auth() != null && check(registration, 'read') && question.eventId == registration.eventId)
}

model EventComment {
    @@allow('read', check(event, 'read'))
    @@allow('create', auth() != null && userId == auth().id && check(event, 'read'))
    @@allow('update,delete', auth() != null && (userId == auth().id || check(event, 'update')))
}

model EventCategory {
    @@allow('read', isVisible)
    @@allow('all', auth() != null && auth().appRole == admin)
}
```

Do not allow users to update arbitrary `EventRegistration` fields. If user cancellation needs to update `status`, implement it in the existing server action with explicit transition validation. Use ZenStack policy reads to prove ownership first, then use the smallest write path that preserves registration workflow rules. If ZenStack v3 write policies with future-state checks can express “owner may only transition own status to cancelled”, use that documented package feature and add the policy test above; otherwise keep cancellation as a guarded server action.

Add policies for event child models in the same task. Without them, protected event reads can fail when including dates/questions/fees/comments, and answer writes can drift back to raw-client authorization code.

Do not make `EventAdmin` readable to the public just because an event is published. Event admin assignments are an authorization relation, not public event content.

Use direct `auth().appRole` enum checks in ZModel policies for the first pass. Keep the TypeScript permission map for nav/page decisions, but do not depend on uncertain scalar-list syntax such as `auth().permissions?[this == '...']` until a later small PR proves it through `zen check` and policy tests. The accepted result must keep one auth context source and no permissions table.

Do not grant broad ZenStack `User` updates. App role assignment is handled by `appRoleActions` with last-admin protection and mirror consistency checks; Better Auth account-admin APIs handle ban/delete/password/session operations.

- [ ] **Step 3: Run schema check**

Run:

```bash
npx zen check --schema zenstack/schema.zmodel
```

Expected: PASS after policy syntax is corrected for ZenStack v3.

- [ ] **Step 4: Run policy tests**

Run:

```bash
npm run test -- src/libs/admin/events/zenstackEventAccess.test.ts src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add zenstack/schema.zmodel src/libs/admin/events/zenstackEventAccess.test.ts src/libs/mit-sailing/eventQueries.ts src/libs/mit-sailing/eventRegistrationActions.ts
git commit -m "feat: enforce event access with ZenStack policies"
```

## Task 12: Mount Restricted ZenStack Next.js Adapter

**Files:**
- Create: `src/app/api/model/[...path]/route.ts`
- Modify: `src/proxy.ts` if endpoint-level blocking is needed
- Test: add or update route tests if existing API route test pattern supports it

- [ ] **Step 1: Add API route**

Before writing the route, use Context7 and the installed package types to choose ZenStack's current Next.js API handler style. Current Next adapter docs show `NextRequestHandler` with `RPCApiHandler`, while `@zenstackhq/server/api@3.7.0` package types also export `RestApiHandler`. This PR's first generic CRUD surface is commodity REST CRUD for `EventCategory`, so prefer `RestApiHandler` only after verifying the installed package route contract. Do not mix `RPCApiHandler` with REST-style assertions or vice versa.

Create `src/app/api/model/[...path]/route.ts` using the verified handler style. The preferred REST implementation, if the installed package contract verifies, is:

```ts
import { RestApiHandler } from '@zenstackhq/server/api';
import { NextRequestHandler } from '@zenstackhq/server/next';
import type { NextRequest } from 'next/server';
import { getSession } from '@/libs/auth/dal';
import { Env } from '@/libs/Env';
import { authContextFromUser } from '@/libs/zenstack/auth';
import { zenStackPolicyClient } from '@/libs/zenstack/client';
import { schema } from '@/libs/zenstack/schema';

const MODEL_NAME_MAPPING = {
  EventCategory: 'event-categories',
} as const;

const ALLOWED_MODEL_SEGMENTS = new Set(Object.values(MODEL_NAME_MAPPING));

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function modelSegmentFromContext(context: RouteContext): Promise<string | null> {
  const params = await context.params;
  return params.path[0] ?? null;
}

async function allowedRequest(context: RouteContext): Promise<boolean> {
  const modelSegment = await modelSegmentFromContext(context);
  return modelSegment !== null && ALLOWED_MODEL_SEGMENTS.has(modelSegment);
}

async function authContextForRequest() {
  const session = await getSession();
  if (!session?.user?.id || session.session.impersonatedBy) {
    return null;
  }

  return authContextFromUser(session.user);
}

async function getClient(_request: NextRequest) {
  const authContext = await authContextForRequest();
  if (!authContext) {
    throw new Error('Unauthorized');
  }
  return zenStackPolicyClient.$setAuth(
    { appRole: authContext.appRole, id: authContext.id }
  );
}

const handler = NextRequestHandler({
  apiHandler: new RestApiHandler({
    endpoint: `${Env.NEXT_PUBLIC_APP_URL}/api/model`,
    modelNameMapping: MODEL_NAME_MAPPING,
    schema,
  }),
  getClient,
  useAppDir: true,
});

async function allowlistedHandler(request: NextRequest, context: RouteContext) {
  if (!(await allowedRequest(context))) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await authContextForRequest())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handler(request, context);
}

export {
  allowlistedHandler as DELETE,
  allowlistedHandler as GET,
  allowlistedHandler as PATCH,
  allowlistedHandler as POST,
  allowlistedHandler as PUT,
};
```

The allowlist wrapper must use App Router `context.params` instead of manually parsing `request.nextUrl.pathname`, then forward the same context to `NextRequestHandler`; do not drop `context.params`.

Use an explicit `modelNameMapping` for every exposed model. Do not rely on ZenStack's default lowercasing for multi-word model names like `EventCategory`, because defaults such as `eventcategory` or `eventCategory` are easy to mismatch in tests and clients.

The generated API must fail closed for impersonated, banned, unverified, or malformed sessions before dispatching to ZenStack. Do not represent invalid sessions as `$setAuth(undefined)` on this admin API route, because public `@@allow('read', ...)` policies could still permit anonymous reads. `getClient` should bind an auth context only when `authContextFromUser(session.user)` returns non-null and `session.session.impersonatedBy` is absent.

- [ ] **Step 2: Restrict generic access to the first allowed model**

Expose only the mapped `event-categories` segment first. Do not expose generic CRUD for:

```txt
user
session
account
verification
auditLog
event
eventAdmin
eventRegistration
eventEntryFee
eventRegistrationQuestion
eventRegistrationAnswer
eventComment
newsletter
CMS models
```

Keep user account admin writes in existing server actions and Better Auth admin APIs. Keep workflow-heavy event/registration writes in server actions so generic CRUD cannot bypass capacity, payment, transition, email, cache invalidation, or audit behavior.

Verify the exact model path/action contract used by the chosen ZenStack API handler from generated client/docs before finalizing the allowlist. The preferred first exposed segment is `event-categories` via `modelNameMapping`; if package behavior differs, the route and tests must use one explicit mapped segment and every disallowed segment must return `404`.

- [ ] **Step 3: Route test**

Add route-handler tests for `src/app/api/model/[...path]/route.ts`:

- unauthenticated access to `event-categories` returns `401` before the ZenStack handler runs;
- impersonated, banned, and unverified sessions return `401` before the ZenStack handler runs;
- generic access to `user` returns `404`;
- generic access to `event` returns `404`;
- generic access to `session` returns `404`.

Use exact URLs for the verified handler style. For the preferred REST handler, test `/api/model/event-categories` as the allowed collection route and `/api/model/user`, `/api/model/event`, and `/api/model/session` as disallowed routes. The assertions are about the allowlist behavior, not a guessed URL shape.

For REST payload tests, use the request format required by ZenStack's `RestApiHandler` package docs/types. It is JSON:API-style, so do not send ad hoc plain JSON and then debug false failures in the route wrapper. Do not add a passing REST create/update test for `EventCategory` unless the ZModel has defaults for `id`, `createdAt`, and `displayOrder`, or unless the route is explicitly wrapped with server-side create logic. The current repo model requires those fields and the current catalog handler computes them server-side, so the generated REST API should not be treated as the EventCategory write path in this PR.

If a later verified REST mutation test is added after adding safe defaults/wrapping, use this JSON:API shape:

```ts
headers: {
  'Content-Type': 'application/vnd.api+json',
}
body: JSON.stringify({
  data: {
    type: 'event-categories',
    attributes: {
      accentClassName: null,
      isVisible: true,
      name: 'Regattas',
    },
  },
})
```

Keep `displayOrder`, `id`, and `createdAt` out of public form payloads unless the verified installed package and handler behavior prove that the current server-side next-order/id/timestamp calculation is no longer needed. If the REST payload contract differs, update both route and tests to the verified package contract before committing.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- 'src/app/api/model/[...path]/route.test.ts'
```

Expected: PASS with model allowlist protection.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/api/model/[...path]/route.ts' 'src/app/api/model/[...path]/route.test.ts'
git commit -m "feat: expose restricted ZenStack model API"
```

## Task 13: Move EventCategory Catalog CRUD to ZenStack

**Files:**
- Create: `src/libs/admin/catalog/zenstackCatalogHandlers.ts`
- Create: `src/libs/admin/catalog/zenstackCatalogHandlers.test.ts`
- Modify or create: EventCategory admin form component used by `src/components/mit-sailing/admin/catalog/AdminCatalogForm.tsx`
- Modify: `src/libs/admin/catalog/catalogServerRegistry.ts`
- Delete: `src/libs/admin/catalog/eventCategoriesHandlers.ts`

- [ ] **Step 1: Write failing handler test**

Create `src/libs/admin/catalog/zenstackCatalogHandlers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { Permission } from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/libs/zenstack/client', () => ({
  zenStackClientForAuth: (authContext: unknown) => ({
    authContext,
    eventCategory: mocks,
  }),
}));

describe('createZenStackCatalogHandlers', () => {
  it('creates event categories through ZenStack', async () => {
    mocks.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } });
    mocks.create.mockResolvedValue({ id: 'cat-1' });
    const { createZenStackCatalogHandlers } = await import(
      '@/libs/admin/catalog/zenstackCatalogHandlers'
    );
    const handlers = createZenStackCatalogHandlers('event_categories');
    const formData = new FormData();
    formData.set('name', 'Regattas');
    formData.set('isVisible', 'true');

    await expect(
      handlers.createFromForm(formData, {
        authContext: {
          appRole: Role.ADMIN,
          id: 'admin-1',
          permissions: [Permission.EVENT_CATEGORIES_MANAGE],
        },
      })
    ).resolves.toEqual({ ok: true, id: 'cat-1' });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdAt: expect.any(Date),
        displayOrder: 5,
        id: expect.any(String),
        isVisible: true,
        name: 'Regattas',
      }),
      select: { id: true },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        data: expect.objectContaining({ accentClassName: expect.anything() }),
      })
    );
  });
});
```

Also cover:

- missing `authContext` returns `{ ok: false, code: 'forbidden' }` without calling ZenStack;
- `list()` preserves the current order `[{ displayOrder: 'asc' }, { name: 'asc' }]`;
- update does not write `displayOrder`, `id`, `createdAt`, or `accentClassName`.

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- src/libs/admin/catalog/zenstackCatalogHandlers.test.ts
```

Expected: FAIL because the factory does not exist.

- [ ] **Step 3: Implement EventCategory ZenStack handler**

Create `src/libs/admin/catalog/zenstackCatalogHandlers.ts` with a first implementation for `event_categories` only. Convert `FormData` into a typed input object first, then parse that object with `eventCategoryCreateSchema` and `eventCategoryUpdateSchema` from `src/libs/zenstack/zod.ts`.

Import `randomUUID` from `node:crypto` for create ids, matching the current handler.

Keep the FormData coercion small and local:

```ts
function eventCategoryInputFromFormData(formData: FormData) {
  return {
    isVisible: booleanFromFormValue(formData.get('isVisible')),
    name: stringFromFormValue(formData.get('name')),
  };
}
```

For create, do not pass `displayOrder`, `id`, `createdAt`, or `accentClassName` from `FormData` into `eventCategoryCreateSchema`; compute the next display order server-side using the current maximum display order, matching the existing handler behavior. Add `id: randomUUID()` and `createdAt: new Date()` in the handler before calling ZenStack, because the current EventCategory model requires those fields. Keep reorder in the existing catalog reorder path; do not force `displayOrder` through the regular create/update form schema.

Do not include `accentClassName` in create/update data until the EventCategory form explicitly exposes it. The current form posts only `name` and `isVisible`; parsing a missing accent field to `null` would clear existing accent values during ordinary edits.

Reuse existing form value helpers if they already exist in the catalog layer. The generated ZenStack Zod schema should validate the typed object; it should not receive raw string `FormData` values for numeric/boolean fields.

For checkbox booleans, preserve the existing catalog behavior for absent fields. If existing forms omit unchecked checkboxes, coerce missing `isVisible` to `false` only if that is how the current handler behaves; otherwise keep the current default and test it.

Then call:

```ts
if (!context.authContext) {
  return { ok: false, code: 'forbidden' };
}
const db = zenStackClientForAuth(context.authContext);
const aggregate = await db.eventCategory.aggregate({
  _max: { displayOrder: true },
});
await db.eventCategory.create({
  data: {
    ...data,
    createdAt: new Date(),
    displayOrder: (aggregate._max.displayOrder ?? -1) + 1,
    id: randomUUID(),
  },
  select: { id: true },
});
await db.eventCategory.update({ where: { id }, data });
await db.eventCategory.delete({ where: { id } });
await db.eventCategory.findMany({
  orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
});
```

Do not generalize to every catalog resource in this task.

If `src/libs/admin/catalog/eventCategoriesSchemas.ts` becomes unused after this switch, delete it in this task. If shared form utilities still import it, shrink it to only the pieces still needed and leave the generated ZenStack Zod schemas as the write-validation source of truth.

If the existing catalog action context only carries `userId`, update the catalog server-action boundary to pass `authContext` from the current session. Do not invent a helper with an ambiguous actor shape.

Expected context shape:

```ts
export type CatalogMutationContext = {
  authContext: ZenStackAuthContext;
  impersonatedUserId?: string;
  userId?: string;
};
```

`createCatalogResourceAction`, `updateCatalogResourceAction`, and delete/reorder actions should pass `session.authContext` from `requirePermission` into this context. Mutating ZenStack catalog handlers must treat a missing auth context as a server-action wiring bug and fail with `forbidden` before calling ZenStack; do not silently call `zenStackClientForAuth(undefined)`.

- [ ] **Step 4: Use React Hook Form for the converted EventCategory form**

For the EventCategory admin form path, use React Hook Form and `zodResolver` with the generated ZenStack Zod schema:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type * as z from 'zod';
import { eventCategoryCreateSchema } from '@/libs/zenstack/zod-client';

type EventCategoryFormInput = z.input<typeof eventCategoryCreateSchema>;
type EventCategoryFormOutput = z.output<typeof eventCategoryCreateSchema>;

const form = useForm<EventCategoryFormInput, unknown, EventCategoryFormOutput>({
  resolver: zodResolver(eventCategoryCreateSchema),
});
```

Use React Hook Form's package features for numeric and boolean fields, such as `valueAsNumber` and checkbox registration, instead of custom client state. Preserve existing server actions for progressive enhancement and authorization; the form package is for client-side form state/validation, not for bypassing server validation.

Do not rewrite every admin form in this PR. EventCategory is the first package-backed form because it is also the first ZenStack/Zod-backed CRUD resource.

Keep this scoped because `AdminCatalogForm` also supports complex CMS block editors, rich text, media controls, and dynamic selects. Either add a narrow EventCategory form path/component or branch inside the generic form only for `resourceId === 'event_categories'`; do not retrofit React Hook Form across every catalog resource in this PR.

Wire edit mode deliberately:

- `defaultValues` must come from the existing row for `name`, `isVisible`, and `accentClassName` if the accent field is exposed in this form;
- server-returned field errors from the existing redirect query mechanism must still render next to fields;
- client-side Zod errors must use existing next-intl keys or a small error-code map, not raw package/default messages;
- submit still posts to the existing server action so server-side ZenStack authorization and validation always run.

Be careful with `handleSubmit`: a naive `onSubmit={handleSubmit(...)}` can prevent the native form action and skip the current redirect/revalidation flow. Use the smallest documented React Hook Form + Next Server Action pattern that preserves the existing `formAction` behavior. If that requires calling the server action from the validated submit handler, cover redirect/error behavior in a component test; otherwise keep the native `action={formAction}` and use React Hook Form only for registration, coercion, and client-visible validation.

- [ ] **Step 5: Register handler**

In `catalogServerRegistry.ts`, replace:

```ts
event_categories: eventCategoriesCatalogHandlers,
```

with:

```ts
event_categories: createZenStackCatalogHandlers('event_categories'),
```

- [ ] **Step 6: Delete manual event category handler**

Delete `src/libs/admin/catalog/eventCategoriesHandlers.ts` after tests pass.

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test -- src/libs/admin/catalog/zenstackCatalogHandlers.test.ts src/libs/admin/catalog/catalogActions.test.ts src/components/mit-sailing/admin/catalog/AdminCatalogForm.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move event category CRUD to ZenStack"
```

## Task 14: Move Event Backend Workflow to ZenStack Protected Client

**Files:**
- Modify: `src/libs/admin/events/eventAdminAuthorization.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: tests under `src/libs/admin/events`

- [ ] **Step 1: Update event authorization tests**

In `eventAdminAuthorization.test.ts`, replace CASL expectations with ZenStack policy expectations:

```ts
it('loads an assigned event through a ZenStack protected query', async () => {});
it('returns null when the protected query cannot read the event', async () => {});
```

- [ ] **Step 2: Run red tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: FAIL because implementation still uses CASL.

- [ ] **Step 3: Replace CASL event filters**

In `eventAdminAuthorization.ts`, delete `accessibleBy`, `ForbiddenError`, `AuthAbility`, and `createAuthAbility` usage.

Use:

```ts
const db = zenStackClientForAuth(session.authContext);
const event = await db.event.findFirst({
  where: { slug: props.slug },
  select: {
    id: true,
    slug: true,
    admins: { select: { adminUserId: true } },
  },
});
```

Rows not allowed by policy should behave as missing.

- [ ] **Step 4: Move actions to protected client**

In `eventAdminActions.ts`, use the ZenStack client for Event, EventAdmin, EventDate, EventRegistrationQuestion, and EventEntryFee writes. Keep custom transaction/business logic for:

```txt
slug construction
date parsing
question parsing
fee parsing
capacity checks
registration status transitions
cache invalidation
redirects
```

Do not move this workflow behind the generic Next.js adapter in this PR. The point is policy-enforced data access with less hand-written authorization code, not exposing workflow-heavy event mutations as commodity CRUD.

When replacing Prisma writes, update error mapping too. Existing helpers such as `mutationCodeFromPrisma` must either become package-neutral helpers or branch on the exact ZenStack/Kysely error shape proven by package types/tests. Do not keep `Prisma.PrismaClientKnownRequestError` as the only path for duplicate slug, not found, or foreign key errors after the write no longer uses Prisma.

If ZenStack returns policy denials as not-found-style errors for forbidden writes, map that to `not_found` for admin event edit/delete flows and cover it in tests.

For public event registration actions, replace ownership checks based only on `requireCurrentUser` with a verified auth context. Banned, unverified, or malformed session users must redirect or return the same authentication/registration error path as unauthenticated users before any registration write. Use the ZenStack protected client to prove the viewer can read the event and their own registration; keep capacity/window/payment/status workflow validation in the existing server action.

- [ ] **Step 5: Run event tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/libs/admin/events/eventAdminAuthorization.ts src/libs/admin/events/eventAdminActions.ts src/libs/admin/events/eventAdminQueries.ts src/libs/admin/events/*.test.ts
git commit -m "refactor: use ZenStack for event admin data access"
```

## Task 15: Remove CASL Packages and Stale Authorization Code

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete or shrink: `src/libs/auth/permissions.ts`
- Delete: `src/libs/auth/permissions.test.ts`
- Modify all imports.

- [ ] **Step 1: Search CASL surface**

Run:

```bash
rg -n "@better-auth/prisma-adapter|@casl|CASL|createAuthAbility|AuthAbility|AuthSubject|AuthAction|accessibleBy|ForbiddenError|createEventAbilitySubject|createEventRegistrationAbilitySubject|EVENTS_CREATE|currentUser\\?\\.role|currentUser\\.role|parseRoles\\(" src tests package.json
```

Expected: matches before removal.

- [ ] **Step 2: Move remaining permission constants**

If any code still imports `Permission` from `src/libs/auth/permissions.ts`, move the import to:

```ts
import { Permission } from '@/libs/auth/appPermissions';
```

- [ ] **Step 3: Remove replaced dependencies**

Run:

```bash
npm uninstall @better-auth/prisma-adapter @casl/ability @casl/prisma
```

- [ ] **Step 4: Delete stale tests**

Delete `src/libs/auth/permissions.test.ts` after its coverage is represented by:

```txt
src/libs/auth/appPermissions.test.ts
src/libs/zenstack/auth.test.ts
src/libs/admin/events/zenstackEventAccess.test.ts
```

- [ ] **Step 5: Search again**

Run:

```bash
rg -n "@better-auth/prisma-adapter|@casl|CASL|createAuthAbility|AuthAbility|AuthSubject|AuthAction|accessibleBy|ForbiddenError|createEventAbilitySubject|createEventRegistrationAbilitySubject|EVENTS_CREATE|currentUser\\?\\.role|currentUser\\.role|parseRoles\\(" src tests package.json
```

Expected: no matches except historical docs/plans.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove CASL authorization"
```

## Task 16: Migration History Cleanup

**Files:**
- Modify: `prisma/migrations/20260422220000_better_auth_init/migration.sql`
- Modify: `prisma/migrations/20260423041039_mit_sailing_domain/migration.sql`
- Modify or delete: `prisma/migrations/20260511120000_event_category_accent_class_name/migration.sql`
- Modify or delete: `prisma/migrations/20260518130000_role_permission_grants/migration.sql`

- [ ] **Step 1: Confirm migration-squash precondition**

Before editing historical migration files, confirm these migrations have not been applied to staging, production, or any shared database that must preserve migration checksums:

```txt
20260422220000_better_auth_init
20260423041039_mit_sailing_domain
20260511120000_event_category_accent_class_name
20260518130000_role_permission_grants
```

Expected: because the site is not live and the database will be dropped/reseeded, it is safe to squash only this PR's touched auth/event-domain migrations. If a shared environment has applied any of these migrations, stop and create forward migrations instead.

- [ ] **Step 2: Fold `app_role` into Better Auth baseline**

In `20260422220000_better_auth_init/migration.sql`, add:

```sql
"app_role" ... NOT NULL DEFAULT 'user',
```

to the `user` table.

The exact SQL type must match generated `prisma/schema.prisma` and `zenstack/schema.zmodel`. If `AppRole` is generated as a PostgreSQL enum, create/use that enum. If the final ZModel changes `appRole` to a validated string, use `TEXT`. Do not leave migration SQL inconsistent with the generated schema.

Keep:

```sql
"role" TEXT NOT NULL DEFAULT 'user',
"banned" BOOLEAN DEFAULT false,
"ban_reason" TEXT,
"ban_expires" TIMESTAMP(3),
```

because Better Auth admin plugin remains installed.

- [ ] **Step 3: Remove role permission grant migration content**

Delete the `role_permission_grants` create table and related index/constraint SQL from `20260518130000_role_permission_grants/migration.sql`.

Keep `gym_membership_verified_at` by folding it into the baseline `user` table or leaving a focused migration only for that user profile field.

- [ ] **Step 4: Fold event category accent field**

If `EventCategory.accentClassName` remains in the model, create it directly in the event category table in `20260423041039_mit_sailing_domain/migration.sql` and delete the standalone accent migration.

- [ ] **Step 5: Verify migration search**

Run:

```bash
rg -n "role_permission_grants|RolePermissionGrant|events_created_by_idx|events_created_by_fkey|\"created_by\" TEXT NOT NULL" prisma/migrations prisma/schema.prisma
```

Expected: no `role_permission_grants`; no event `created_by` column/index/foreign key; no `RolePermissionGrant`. Do not treat unrelated newsletter `created_by_user_id` or historical stale-column cleanup migrations as failures.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "build: squash prelaunch authorization migrations"
```

## Task 17: Verification and CodeRabbit Risk Pass

**Files:**
- No planned production edits unless checks identify direct regressions.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm run test -- src/libs/auth/appPermissions.test.ts src/libs/zenstack/auth.test.ts src/libs/admin/users/appRoleActions.test.ts src/libs/admin/catalog/zenstackCatalogHandlers.test.ts src/libs/admin/events/zenstackEventAccess.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader unit/component tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run required static checks**

Run:

```bash
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
```

Expected: PASS.

- [ ] **Step 4: Run E2E gate**

Run:

```bash
npm run test:e2e
```

Expected: PASS. This is required because admin auth, impersonation, ban, verify-email, and event admin behavior changed.

- [ ] **Step 5: CodeRabbit preflight search**

Run:

```bash
rg -n "any\\b|as unknown as|parseRoles|EVENTS_CREATE|currentUser\\?\\.role|currentUser\\.role|rolePermissionGrant|createdByUserId|events_created_by|@better-auth/prisma-adapter|@casl|process\\.env|TODO|TBD" src prisma tests package.json --glob '!src/generated/**'
```

Expected:

- no CASL references;
- no Better Auth Prisma adapter references;
- no `parseRoles`;
- no `EVENTS_CREATE`;
- no `currentUser.role` authorization checks;
- no event `createdByUserId` or event-created-by relation/index;
- no RolePermissionGrant;
- no new `any` or double-casts in touched code;
- no direct `process.env` reads outside approved env modules.

- [ ] **Step 6: Commit final fixes**

```bash
git add -A
git commit -m "test: verify ZenStack authorization migration"
```

## Three-Pass Plan Self-Review

### Pass 1: Spec Coverage

- ZenStack v3 docs are reflected: ZModel, `PolicyPlugin`, `$setAuth`, `@core/prisma`, Next.js adapter, Query-as-a-Service, policy limitations.
- ZenStack Better Auth recipe is reflected: `@zenstackhq/better-auth`, `zenstackAdapter`, version-verified Better Auth CLI/manual schema comparison, and server-side `$setAuth`.
- ZenStack Studio local use is reflected with `npx zenstack studio`.
- ZenStack Zod utility is reflected through `@zenstackhq/zod` and `createSchemaFactory`.
- Multi-tenant/organization guidance is explicitly excluded.
- CASL removal is covered in Task 15.
- RolePermissionGrant and `/admin/roles` removal are covered in Task 8.
- `User.appRole` and Better Auth role mirror are covered in Tasks 4 and 9.
- Better Auth account-admin retention is covered in Tasks 9 and 12.
- Better Auth storage moves to ZenStack adapter in Task 5.
- ZenStack Zod factory, React Hook Form resolver path, and Studio local verification are covered in Tasks 6 and 13.
- Event `created_by` removal is covered in Task 10.
- Event/EventRegistration policies are covered in Task 11.
- EventCategory generated/protected CRUD and first React Hook Form conversion are covered in Task 13.
- Event backend protected data access is covered in Task 14.
- Admin header/layout/nav refactor is covered in Task 7.
- Migration squashing is covered in Task 16.
- Sub-agent execution and GitHub milestone/issues are covered in Task 1 and Execution Model.

### Pass 2: Placeholder Scan

No task contains unresolved `TBD`, `TODO`, or “implement later” instructions. Where exact ZenStack policy syntax may require adjustment, the plan states the concrete fallback and acceptance condition: `zen check` must pass without adding a permission table.

### Pass 3: Type and Naming Consistency

- The app role field is consistently named `appRole`.
- The ZModel auth type is `AuthContext`.
- The TypeScript auth type is `ZenStackAuthContext`.
- Better Auth compatibility field remains `role`.
- Client-safe app auth context lives in `src/libs/auth/appAuthContext.ts`; server-only ZenStack auth lives in `src/libs/zenstack/auth.ts`.
- App permissions live in `src/libs/auth/appPermissions.ts`.
- ZenStack client helpers live under `src/libs/zenstack`.
- `EventAdmin` remains the event-scoped management relation; `EventHost` is not introduced.

## Execution Handoff

Plan complete. Execute with **Subagent-Driven** mode: create or use the GitHub issue for each task, dispatch one fresh sub-agent per task, review diffs before moving to the next task, and run the verification commands after each cluster. If executing inline instead, invoke the `executing-plans` skill and follow the checklist sequentially.

## New-Agent Handoff Prompt

Use this prompt when continuing in a fresh context:

```txt
You are working in /Users/andrewkelley/GitHub/mitsailing on the ZenStack admin authorization migration. Read docs/superpowers/plans/2026-05-18-zenstack-admin-authorization.md first and execute it task-by-task with sub-agents. Do not continue the CASL approach. Key decisions: use ZenStack v3 ZModel as source of truth; follow https://zenstack.dev/docs/recipe/auth-integration/better-auth; use @zenstackhq/better-auth so Better Auth uses ZenStack storage; keep Better Auth admin plugin for impersonation, ban/delete/password/session admin and logging; narrow Better Auth admin-plugin powers to appRole admin only; add User.appRole as MIT Sailing authorization source; mirror appRole into Better Auth role only for plugin compatibility and use Better Auth admin API with request headers for that mirror; explicitly test mirror rollback when appRole persistence fails; user create/update/ban/delete last-admin checks must use appRole, not Better Auth role; banned, unverified, impersonated, or malformed sessions must fail closed before ZenStack receives auth; remove RolePermissionGrant and /admin/roles; remove EVENTS_CREATE and use EVENTS_MANAGE for event admin workflows; single-role only; no role inheritance helper; no multi-tenant or organization plugin; remove Event.created_by and use EventAdmin; do not grant broad ZenStack User updates; do not allow users to update arbitrary EventRegistration fields; add policies for EventDate, EventRegistrationQuestion, EventEntryFee, EventRegistrationAnswer, and EventComment; commit the generated zenstack/schema.ts artifact; use ZenStack Next.js adapter with RestApiHandler for restricted generated CRUD and explicit modelNameMapping from EventCategory to event-categories; keep client-safe permission helpers separate from server-only ZenStack helpers; use @zenstackhq/zod for EventCategory validation first; keep EventCategory create order server-computed instead of requiring displayOrder in the create form; use React Hook Form plus @hookform/resolvers/zod for converted React forms, starting only with EventCategory; catalog mutation context must carry authContext; keep the Prisma 7 generator client block in ZModel and run npx prisma generate after ZenStack generation; use REST JSON:API payloads only if RestApiHandler is verified from installed types; use npx zenstack studio locally only for manual verification. Bemi is non-scope for this PR unless this PR directly needs domain audit/history code to finish; do not create Bemi issues or replace CMS/catalog history in this PR. Use Context7 before relying on any library/framework/package/API docs because agent memory is likely stale. If executing inline, use the executing-plans skill. If a task exposes a new architectural decision, use the available reasoning/design skill; if no exact reasoning skill exists, use grill-me and stop before widening scope. Follow AGENTS.md, TDD, and repo command restrictions. Use one sub-agent per plan task and keep main context low.
```
