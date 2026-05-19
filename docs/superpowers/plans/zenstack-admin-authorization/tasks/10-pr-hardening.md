# 10 - PR Hardening and Post-Review Fixes

## Goal

Push the completed ZenStack admin authorization migration to GitHub, create a
ready-for-review PR, harden it with one local CodeRabbit pass, then run up to
three post-PR rounds for relevant GitHub comments and CI/test failures.

## Preconditions

- Tasks 3-9 are complete, verified, committed, and recorded in
  `task-queue.md`.
- Current branch is not `main` or `master`.
- Local worktree has no unrelated dirty files in the task-owned scope.
- Task 9 verification has passed, or concrete environment blockers are
  recorded.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/coderabbit-review.mdc`
- `.cursor/rules/pr-agent-reviews-loop.mdc`
- `.cursor/rules/sonarqube-review.mdc`
- `.cursor/rules/e2e-verification.mdc`
- CodeRabbit skill
- GitHub skill

## Scope

Task 10 stays under the ZenStack conductor workflow.

Use CodeRabbit and GitHub skills/tools only as sub-tools for:

- local review
- PR creation/update
- PR comments
- review comments
- CI inspection

Do not switch to `finish-pr-loop` or `finish-pr-context7` unless the user
explicitly asks.

## Phase 1: Local CodeRabbit Review

Run one local CodeRabbit hardening round before creating the PR.

CodeRabbit scope:

- Local CodeRabbit is a bug-finding hardening pass, not a refactor mandate.
- Fix all real bugs relevant to this migration.
- Fix concrete defects, unsafe auth/policy behavior, failing-test causes, stale
  pre-ZenStack migration leftovers, and small clarity fixes that directly
  reduce migration risk.
- Do not do broad refactors, architecture rewrites, style churn, naming churn,
  or large abstractions from CodeRabbit feedback.
- Treat low-value style comments as advisory unless they reveal a real bug,
  security issue, test failure, or migration risk.
- If CodeRabbit recommends broad redesign or unrelated cleanup, document it as
  out of scope in the final PR comment.

After fixes, rerun relevant verification and commit with a Conventional Commit.

## Phase 2: Local Hardening

Run local verification before PR creation after finishing Phase 1 above.

- `npm run lint`
- `npm run check:types`
- `npm run check:i18n`
- `npm run check:deps`
- Task 9 required tests

Run stale-pattern searches for pre-ZenStack authorization paths.

Fix only real local failures, stale pre-ZenStack migration leftovers, and small
issues directly relevant to this migration.

## Phase 3: Create Ready PR

Push the current branch.

Create a GitHub PR as ready for review, not draft, because CodeRabbit must run.

If a PR already exists for the branch, update that PR instead of creating a
duplicate.

## Phase 4: Three Post-PR Fix Rounds

Run up to three post-PR fix rounds. Start each round in its own fresh sub-agent.
Before inspecting GitHub checks or review comments in a round, wait until 30
minutes have passed since the latest push so CI and review bots have time to
report.

Stop the loop early if the 30-minute post-push check shows all tests passing,
no failing checks, and no actionable GitHub or CodeRabbit comments left to fix.

A post-PR round means:

- inspect current GitHub Actions/check results
- inspect all GitHub review comments
- inspect all CodeRabbit PR comments
- fix all relevant actionable issues
- run local verification
- commit and push once

Review finding scope:

- Prioritize security, auth/policy bugs, data integrity, failing tests,
  TypeScript/lint failures, broken admin/event workflows, and stale pre-ZenStack
  authorization paths.
- Fix CodeRabbit and GitHub review comments when they are relevant and
  actionable.
- Treat Codacy as advisory.
- Fix Codacy findings only when they identify a real bug, security issue, test
  failure, or clear migration risk.
- Ignore or document Codacy findings that conflict with React, Next.js, app
  style rules, i18n rules, Tailwind v4, generated-code conventions, or existing
  project patterns.
- Do not comment on GitHub issues.
- Do not add suppressions or broad tool config just to silence Codacy unless
  the finding is a documented analyzer mismatch and the config is narrowly
  scoped.

If a requested fix is unrelated to this migration, stop and ask before fixing
it.

## Verification

After each coherent fix:

- Run the smallest targeted test for the fix.
- Run `npm run lint`.
- Run `npm run check:types`.
- Run any failed CI-equivalent command when reproducible locally.

Before finishing:

- Confirm latest pushed commit.
- Confirm PR URL.
- Confirm GitHub checks state.
- Confirm relevant CodeRabbit/GitHub comments are fixed or documented.

## Stop Conditions

Stop and ask if:

- current branch is `main` or `master`
- no PR can be created or found after push
- a requested fix is unrelated to this migration
- a fix would require broad deletion or rewrite of pre-ZenStack code beyond this
  plan
- a security, auth, policy, data-loss, or merge-blocking CI issue remains after
  the third post-PR round
- the same unclear CI failure remains after one focused fix attempt

## Final PR Comment

Post a final comment on the PR with:

- local commands run
- latest pushed commit hash
- GitHub checks status
- CodeRabbit/GitHub review status
- relevant bugs fixed
- Codacy advisory status if applicable
- remaining risks or items left for user decision
