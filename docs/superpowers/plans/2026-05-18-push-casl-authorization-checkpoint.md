# Push CASL Authorization Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify, commit, and push the current CASL authorization checkpoint so the next agent can continue from a safe remote branch state.

**Architecture:** This is a checkpointing task, not a feature-completion task. It should preserve the current dirty authorization/admin work, run focused checks for the parts already changed, commit the checkpoint with a clear Conventional Commit message, and push `feature/registration-onboarding-permissions`.

**Tech Stack:** Git, npm scripts, Vitest, TypeScript.

---

## Current Context

Work in `/Users/andrewkelley/GitHub/mitsailing-registration-onboarding` on branch `feature/registration-onboarding-permissions`. The worktree is intentionally dirty with broad authorization/admin changes. Do not revert unrelated changes. Do not execute the remaining CASL Prisma finish plan in this checkpoint task; that plan is saved separately at `docs/superpowers/plans/2026-05-18-casl-prisma-event-authorization-finish.md`.

Expected current product/model checkpoint:

- `events.create` exists.
- `Volunteer Instructor` receives `events.create` by default.
- `events.manage` means global event management.
- `Dock Staff` and `Dock Master` receive `events.manage` by default.
- `createdByUserId` remains metadata only and should not grant event edit access.
- `createAdminEventAction` creates an `EventAdmin` row for the creator.
- Public event registration actions use CASL Prisma ownership filters.

## File Structure

- Read only for inspection: current Git status and diffs.
- Modify only if focused tests fail due to an obvious mismatch in the current checkpoint, such as a stale test expecting Volunteer Instructor event creation to be off by default.
- Do not touch the remaining implementation plan unless updating a typo in handoff notes is necessary.

## Task 1: Verify the Worktree and Scope

**Files:**
- Read: Git status and branch.

- [ ] **Step 1: Confirm branch and dirty state**

Run:

```bash
git branch --show-current
git status --short
```

Expected:

- Branch is `feature/registration-onboarding-permissions`.
- Dirty worktree includes authorization/admin files such as `src/libs/auth/permissions.ts`, `src/libs/auth/dal.ts`, `src/libs/admin/roles/`, `src/libs/admin/events/eventAdminActions.ts`, admin pages, and `src/locales/en.json`.

If branch is not `feature/registration-onboarding-permissions`, stop and report. If the dirty state is unexpectedly tiny or missing the authorization files, stop and report.

- [ ] **Step 2: Review the intended checkpoint diff**

Run:

```bash
git diff -- src/libs/auth/permissions.ts src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/mit-sailing/eventRegistrationActions.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected:

- `Permission.EVENTS_CREATE` is present.
- Volunteer Instructor default grants include `EVENTS_CREATE`.
- Dock Staff and Dock Master default grants include `EVENTS_MANAGE`.
- Event CASL update rules do not use `createdByUserId`.
- Public registration action ownership uses `accessibleBy(...).EventRegistration`.

## Task 2: Run Focused Verification Before Commit

**Files:**
- No planned edits.

- [ ] **Step 1: Run focused CASL/event tests**

Run:

```bash
npm run test -- src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: PASS.

If this fails because a test still expects Volunteer Instructor `events.create` to be off by default, update that test to expect the new product decision, then rerun this command.

- [ ] **Step 2: Run typecheck**

Run:

```bash
SKIP_ENV_VALIDATION=true npm run check:types
```

Expected: PASS.

If typecheck fails in files directly touched by the current CASL checkpoint, fix those type errors. If it fails in unrelated pre-existing dirty work, stop and report the exact errors instead of widening scope.

- [ ] **Step 3: Optional quick static checks**

Run if time permits:

```bash
npm run lint
npm run check:i18n
```

Expected: PASS.

If either fails due to unrelated dirty work, report the output. Do not make broad cleanup changes just to push the checkpoint.

## Task 3: Commit the Checkpoint

**Files:**
- Git staging and commit only.

- [ ] **Step 1: Inspect changed file list**

Run:

```bash
git status --short
```

Expected: broad dirty authorization/admin work. Confirm no obvious generated trash, local logs, or accidental files are present. `test-report.junit.xml` may be modified by test runs; include it only if this repo normally tracks test report updates. If it is untracked or unrelated, do not add it.

- [ ] **Step 2: Stage the current checkpoint**

Run:

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/seed.ts prisma/migrations/20260518130000_role_permission_grants docs/superpowers/plans/2026-05-18-casl-prisma-authorization.md docs/superpowers/plans/2026-05-18-casl-prisma-event-authorization-finish.md docs/superpowers/plans/2026-05-18-push-casl-authorization-checkpoint.md src
```

Expected: all intended authorization/admin source changes staged. If Git reports a path does not exist, inspect `git status --short` and stage the existing corresponding paths.

- [ ] **Step 3: Review staged summary**

Run:

```bash
git diff --cached --stat
git diff --cached --name-only
```

Expected: staged files match the authorization/admin checkpoint. If accidental files appear, unstage only those specific files with:

```bash
git restore --staged path/to/accidental-file
```

Do not use destructive checkout/reset commands.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "feat: add CASL event permission model"
```

Expected: commit succeeds.

If commit hooks run and fail, fix only focused issues caused by this checkpoint, rerun focused tests as needed, then commit again.

## Task 4: Push the Branch

**Files:**
- Git push only.

- [ ] **Step 1: Push current branch**

Run:

```bash
git push -u origin feature/registration-onboarding-permissions
```

Expected: push succeeds.

If push is rejected because the remote has new commits, stop and report. Do not rebase or merge without user confirmation.

- [ ] **Step 2: Capture post-push state**

Run:

```bash
git status --short
git log -1 --oneline
```

Expected:

- Working tree is clean, or only intentionally untracked local artifacts remain.
- Latest commit is `feat: add CASL event permission model`.

## Task 5: Final Handoff Message

**Files:**
- No edits.

- [ ] **Step 1: Report exact verification and push result**

Final response should include:

- Branch name.
- Commit hash and subject.
- Push result.
- Exact test/check commands run and whether they passed.
- Any checks not run or failures deferred.
- Reminder that remaining implementation plan is `docs/superpowers/plans/2026-05-18-casl-prisma-event-authorization-finish.md`.

## Self-Review Notes

- Spec coverage: This plan covers pre-push verification, staging, committing, pushing, and handoff.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Commands use the current branch and known plan paths.

