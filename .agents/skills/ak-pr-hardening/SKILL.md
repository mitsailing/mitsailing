---
name: ak-pr-hardening
description: Harden one MIT Sailing pull request at a time with low main-agent context, sub-agent review/fix loops, local adversarial review, CodeRabbit follow-up, critical touched-code coverage, and bounded handoffs.
---

# AK PR Hardening

Use when asked to harden, finish, production-shape, review, or CodeRabbit-cycle a MIT Sailing PR. Work on exactly one PR at a time.

## Operating Rules

- Main agent is conductor/integrator. Keep main context small.
- Use explorer sub-agents for read-only review and compact findings.
- Use worker sub-agents for bounded edits with disjoint ownership.
- Do not paste full rule bodies into prompts. Cite paths such as `AGENTS.md`, `.coderabbit.yaml`, and `.cursor/rules/*.mdc`.
- Persist state outside the repo under `~/.codex/tmp/ak-pr-hardening/`.
- Write a handoff after every major phase and before stopping for context, CI, or blockers.
- Default mode may commit locally after verification, but does not push. Push only when the user explicitly says push, publish, finish, or production-shape this PR.
- Create follow-up automation only after a successful push to GitHub and only when CI/checks are pending or expected to rerun.
- Never merge the PR. Never use destructive git commands.

## Credit And Context Controls

Apply these controls before doing extra analysis or spawning agents:

1. Fetch remote PR state only at phase boundaries: start, after local hardening, after fresh CodeRabbit, and after a successful push.
2. Keep prompts scoped to one role and one ownership area. Cite rule paths instead of pasting rule bodies.
3. Store findings, decisions, and handoffs in `~/.codex/tmp/ak-pr-hardening/`; keep main context focused on the current batch.
4. Run fresh CodeRabbit at most once per active fix loop, after local adversarial review or major fixes, unless CodeRabbit itself is the blocker.
5. Prefer targeted tests and diffs first; run broader checks only when the changed surface or repo gates require them.

Do not poll GitHub or CI in-session. After the last successful push in finish mode, use a thread heartbeat automation for the next check-in; otherwise write the handoff and stop.

## Start

1. Resolve the PR from the current branch, PR URL/number, or `gh pr list`.
2. If the PR branch is checked out in another worktree, use that worktree.
3. Snapshot:
   - `git status --short --branch`
   - `gh pr view <pr> --json number,title,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,latestReviews,comments,files`
   - `.coderabbit.yaml`
   - `AGENTS.md`
   - relevant `.cursor/rules/*.mdc` paths only
   - package scripts and coverage config
4. Create or update:
   - `~/.codex/tmp/ak-pr-hardening/<owner>-<repo>-<pr>.json`
   - `~/.codex/tmp/ak-pr-hardening/<owner>-<repo>-<pr>-handoff.md`

State tracks PR URL, worktree, head SHA, phase, loop count, review findings, accepted/rejected findings, changed files, commands run, coverage status, CodeRabbit status, CI status, pushed commits, blockers, and exact next action.

## Risk Classification

Classify as risky when the PR touches payments, auth, permissions, webhooks, background jobs, database schema/migrations, security, money, email delivery, external APIs, or production deploy behavior.

- Risky PR: require 3 local adversarial review rounds before fresh CodeRabbit or push.
- Small PR: require 1 local adversarial review round.

## Local Adversarial Review

Run independent explorer sub-agents with narrow prompts. Each returns only concrete findings with file path, impact, evidence, and suggested fix.

Rounds for risky PRs:

1. Correctness, state transitions, races, idempotency, async failures.
2. Security, authz/authn, money handling, webhook trust, data integrity, secrets, PII.
3. Tests, coverage gaps, edge cases, regression risk, e2e realism.

Reject weak findings only with verified evidence from local code, tests/types, installed dependency source, or official docs. Record rejections in state.

## Fixing

Batch accepted findings by ownership. Spawn worker sub-agents only when scopes are disjoint.

Worker prompt requirements:

- Say they are not alone in the codebase.
- Assign exact files/modules they own.
- Tell them not to revert edits from others.
- Cite local rules by path, not pasted rule bodies.
- Require final output with changed paths, tests run, unresolved risks, and any follow-up needed.

Main agent reviews worker diffs, integrates conflicts, and runs focused verification. Read diffs and touched snippets, not whole unrelated files.

## Coverage

For payment/auth/security/data PRs, target 95% meaningful coverage on critical touched code, not whole-repo global coverage unless the user explicitly asks.

Use existing repo gates first:

- `npm run test:coverage`
- `scripts/check-critical-coverage.mjs`

Add tests for real risk: payment amount correctness, webhook idempotency, duplicate delivery, queue/outbox failure, authz, deadline/status transitions, worker retry behavior, and UI/server action regressions. Do not chase irrelevant historical coverage.

## CodeRabbit

Use posted PR review comments first. For fresh local review, use the CodeRabbit skill/CLI:

- Verify `coderabbit --version`.
- Verify `coderabbit auth status --agent`.
- Run `coderabbit review --agent` with repo config when appropriate.

Fix real correctness, security, accessibility, framework, and test issues. If CodeRabbit is stale or wrong, record verified evidence and reply/resolve only when needed.

Do not run a fresh CodeRabbit pass after every small edit. Run it after local adversarial hardening, after major fixes, or when CodeRabbit is the blocker.

## Verification Order

Use only repo-approved npm scripts from `AGENTS.md` unless the user approves otherwise:

1. Focused tests for changed code.
2. `npm run test`
3. `npm run test:coverage` for critical coverage work.
4. `npm run lint`
5. `npm run check:types`
6. `npm run check:i18n` when user-visible strings changed.
7. `npm run test:e2e` when flows, routing, forms, payments, or auth UX changed.

If CI fails, inspect failing logs before guessing. Fix required checks before lower-priority review comments.

## Loop Budget

Default active budget: 3 fix loops. Finish mode budget: 3 fix loops.

Stop as blocked when:

- The same failure cluster recurs after 2 attempts.
- A product, pricing, permission, security, data migration, or deploy tradeoff is ambiguous.
- Required credentials or tool auth are missing.
- Main context is too large to continue cleanly.
- CI is pending after a push.

For pending CI after push, write handoff and schedule or request a later recheck instead of waiting in-session.

Automation rule:

- Never create an automation before a successful push.
- After the final successful push in finish mode, create one thread heartbeat for the next CI/check recheck.
- The heartbeat prompt must point to the state file and handoff, refresh compact PR checks once, and either continue the next fix loop, stop as done, or write a new handoff if checks remain pending.
- Do not schedule repeated fixed-time automations unless a pushed commit is waiting on remote checks.

## Handoff

Update the handoff after each phase:

- PR URL, branch, worktree, head SHA.
- Current phase and loop count.
- What changed and why.
- Accepted, fixed, rejected, and unresolved findings.
- Commands run and results.
- Coverage status for critical touched code.
- CodeRabbit/Codacy/Sonar/CI state.
- Blockers and exact next command.

If context grows large, stop and tell the user to start a fresh agent with the handoff path. If Codex auto-compacts cleanly, continue from the state file.
