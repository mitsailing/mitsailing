# 10 - PR Hardening and Post-Review Fixes

## Goal

Push the completed ZenStack admin authorization migration to GitHub, create a
ready-for-review PR, then run up to three post-PR rounds for relevant GitHub
comments and CI/test failures.

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
- `.agents/skills/zenstack-pr-hardening/SKILL.md`
- GitHub skill

## Scope

Task 10 stays under the ZenStack conductor workflow.

Use CodeRabbit and GitHub skills/tools only as sub-tools for:

- PR creation/update
- PR comments
- review comments
- CI inspection

Do not switch to `finish-pr-loop` or `finish-pr-context7` unless the user
explicitly asks.

Do not use the official CodeRabbit `autofix` skill in this task because it
prompts for fix and push choices. CodeRabbit PR comments are handled through the
bounded workflow in `.agents/skills/zenstack-pr-hardening/SKILL.md`.

## Phase 1: Local Hardening

Task 9 already completed the required two-pass local CodeRabbit MCP review/fix
loop. Do not run another local CodeRabbit pass here unless new local commits are
added after task 9 or the user explicitly asks.

Run local verification before PR creation:

- `npm run lint`
- `npm run check:types`
- `npm run check:i18n`
- `npm run check:deps`
- Task 9 required tests

Run stale-pattern searches for pre-ZenStack authorization paths.

Fix only real local failures, stale pre-ZenStack migration leftovers, and small
issues directly relevant to this migration.

## Phase 2: Create Ready PR

Push the current branch.

Create a GitHub PR as ready for review, not draft, because CodeRabbit must run.

If a PR already exists for the branch, update that PR instead of creating a
duplicate.

## Phase 3: Up to Three Post-PR Fix Rounds

Run up to three post-PR fix rounds. Start each round in its own fresh sub-agent.
Each round begins by waiting until 30 minutes have passed since the latest push,
then inspecting GitHub checks and review comments. Do not wait 30 minutes
between local fix steps inside a round.

Each round must begin with aggressive context pruning. The context gets very big
during step 9 and during review loops, so do not treat prior implementation or
review history as reusable context.

Before round 1, discard the accumulated step 9 implementation context. Keep only
a short task 9 completion summary, the latest pushed commit hash, and the PR
state. Do not carry forward step 9 file-by-file notes, full verification output,
debugging history, or old hypotheses.

Before round 2 and round 3, close or discard the previous round's working notes,
pasted logs, full review dumps, stale hypotheses, speculative analysis, fixed
findings, and unrelated file summaries. Build a small handoff packet for the
next fresh sub-agent with only:

- this task file
- PR URL and branch name
- latest pushed commit hash
- current check status
- current unresolved actionable review findings
- exact failed command plus the smallest relevant log excerpt, if a check failed
- files or tests already touched in the previous round

Do not carry forward full CI logs, full CodeRabbit/GitHub comment exports,
complete diffs, full file contents, full rule bodies, or broad repository
context. Cite rule paths instead of pasting rules. Keep the handoff short enough
to fit in one screen; if it grows past that, summarize harder before spawning
the next sub-agent. Reload details from the source of truth only when the active
finding requires them. If a tool returns noisy output, summarize the
decision-relevant lines and drop the rest before starting the next round. The
sub-agent should need only current PR state, targeted files, and targeted
verification to complete the round.

Stop the loop early when the 30-minute post-push check shows all GitHub checks
passing, no failing tests, and no actionable GitHub or CodeRabbit comments left
to fix.

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
  the third post-PR fix round
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
