# 09 - Two-Pass Review Verification

## Goal

Prove the migration is ready for PR review by running two review/fix cycles,
using CodeRabbit only when it is available without waiting or spending extra
credits. If CodeRabbit is unavailable, use bounded local adversarial sub-agent
review instead. Run a full local verification gate after each fix cycle.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/e2e-verification.mdc`
- `.cursor/rules/coderabbit-review.mdc`
- Original plan heading: `Task 17: Verification and CodeRabbit Risk Pass`

## Scope

- Use CodeRabbit only when it is already available without waiting, retrying, or
  spending extra credits.
- If CodeRabbit is actively running/pending, wait for it to finish. If
  CodeRabbit is unavailable because of credits, rate limits, auth, skipped/not
  started state, or service failure, record `CodeRabbit unavailable` and replace
  each missed pass with one bounded local adversarial review by independent
  agents. Do not treat CodeRabbit unavailability alone as a blocker.
- Fix every real actionable finding relevant to this migration:
  security, auth/policy bugs, data integrity issues, failing-test causes,
  TypeScript/lint failures, broken admin/event workflows, stale pre-ZenStack
  authorization paths, and small clarity fixes that directly reduce migration
  risk.
- Do not churn broad refactors, architecture rewrites, style-only feedback,
  naming churn, unrelated cleanup, or false positives. Record those decisions in
  the parsed review artifact.

## Artifact Location

Write review artifacts outside the repo under:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/
```

For each pass, save both files:

- `review-pass-1.raw.txt`
- `review-pass-1.parsed.md`
- `review-pass-2.raw.txt`
- `review-pass-2.parsed.md`

Each parsed file must include, for every CodeRabbit or substitute-review issue
or rejected finding:

- severity
- file/line or affected area
- finding text
- decision: fixed, false positive, or out of scope
- fix status
- verification command proving the fix, when fixed

Keep parsed files compact. Summarize findings in a table or short bullet list,
do not paste raw review output, full diffs, full file contents, or full test
logs. Store raw output only in the `.raw.txt` files. If a parsed file grows past
one screen, group resolved low-risk items by theme and keep only unresolved or
security/auth-critical details expanded.

## Phase 1: First Review Pass

Run CodeRabbit if available. Otherwise run a local adversarial sub-agent review.

Save the exact raw output to:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/review-pass-1.raw.txt
```

Parse the findings into:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/review-pass-1.parsed.md
```

Fix every real actionable finding from pass 1. Keep fixes narrow and
migration-relevant.

## Phase 2: First Full Verification Gate

After pass 1 fixes, run the full gate:

```bash
npm run test -- src/libs/auth/appPermissions.test.ts src/libs/zenstack/auth.test.ts src/libs/admin/users/appRoleActions.test.ts src/libs/admin/catalog/zenstackCatalogHandlers.test.ts src/libs/admin/events/zenstackEventAccess.test.ts
npm run test
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
npm run test:e2e
```

Expected: all commands pass. If `npm run test:e2e` cannot run because of a
concrete environment blocker, record the exact blocker and continue only if all
other gates pass.

## Phase 3: Second Review Pass

Run a second review pass after pass 1 fixes and the first full verification
gate: CodeRabbit if available, otherwise a fresh local adversarial sub-agent
review.

Save the exact raw output to:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/review-pass-2.raw.txt
```

Parse the findings into:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/review-pass-2.parsed.md
```

Fix every real actionable finding from pass 2. If pass 2 only reports false
positives, unrelated style churn, or out-of-scope findings, document those
decisions in the parsed artifact and do not edit code for them.

## Phase 4: Final Full Verification Gate

After pass 2 fixes, rerun the full gate:

```bash
npm run test -- src/libs/auth/appPermissions.test.ts src/libs/zenstack/auth.test.ts src/libs/admin/users/appRoleActions.test.ts src/libs/admin/catalog/zenstackCatalogHandlers.test.ts src/libs/admin/events/zenstackEventAccess.test.ts
npm run test
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
npm run test:e2e
```

Expected: all commands pass. If `npm run test:e2e` cannot run because of a
concrete environment blocker, record the exact blocker and all other passing
commands.

Run the stale-pattern search:

```bash
rg -n "any\\b|as unknown as|parseRoles|EVENTS_CREATE|currentUser\\?\\.role|currentUser\\.role|rolePermissionGrant|createdByUserId|events_created_by|@better-auth/prisma-adapter|@casl|process\\.env|TODO|TBD" src prisma tests package.json --glob '!src/generated/**'
```

Expected:

- no CASL references
- no Better Auth Prisma adapter references
- no `parseRoles`
- no `EVENTS_CREATE`
- no `currentUser.role` authorization checks
- no event `createdByUserId` or event-created-by relation/index
- no RolePermissionGrant
- no new `any` or double-casts in touched code
- no direct `process.env` reads outside approved env modules

## Commit

After both review passes, all actionable findings are fixed or documented,
and the final verification gate passes, make one Conventional Commit:

```bash
git add -A
git commit -m "test: verify ZenStack authorization migration"
```

## Acceptance

- Two review passes completed: CodeRabbit when available, otherwise documented
  local adversarial substitutes.
- Raw and parsed artifacts exist for both review passes in
  `~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-09/`.
- All real actionable CodeRabbit or substitute-review findings from both passes
  are fixed.
- False positives, unrelated style churn, and out-of-scope findings are recorded
  in the parsed artifacts.
- The full verification gate passes after pass 1 fixes and again after pass 2
  fixes, except for any concrete recorded E2E environment blocker.
- The stale-pattern search shows no stale CASL, RolePermissionGrant,
  `parseRoles`, event `createdByUserId`, direct env reads, or new casts in
  touched source.
- The task 9 completion note is compact: artifact paths, command names with
  pass/fail status, commit hash, and blockers only. Do not paste raw review
  output, full command logs, or long fixed-finding histories into the queue or
  the next task handoff.
