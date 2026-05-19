---
name: zenstack-pr-hardening
description: Bounded MIT Sailing ZenStack admin authorization PR publishing and hardening workflow. Use when finishing docs/superpowers/plans/zenstack-admin-authorization/tasks/10-pr-hardening.md, creating or updating the ZenStack authorization PR, checking GitHub CI once per bounded round, addressing CodeRabbit or other bot PR comments without interactive prompting, or preventing broader PR-finishing skills from starting open-ended watch/heartbeat loops.
---

# ZenStack PR Hardening

Use for `docs/superpowers/plans/zenstack-admin-authorization/tasks/10-pr-hardening.md`.

This skill is intentionally narrower than `finish-pr-loop`,
`finish-pr-context7`, and generic review-bot resolver skills. It must not start
open-ended watchers, heartbeat automations, or "keep checking until quiet" loops
unless the user explicitly asks for that behavior.

## Source References

- CodeRabbit CLI/skills docs:
  `https://docs.coderabbit.ai/cli/skills`
- Repo PR-loop rule:
  `.cursor/rules/pr-agent-reviews-loop.mdc`
- GitHub skill:
  `/Users/andrewkelley/.codex/plugins/cache/openai-curated/github/eed16198/skills/github/SKILL.md`
- GitHub publish skill:
  `/Users/andrewkelley/.codex/plugins/cache/openai-curated/github/eed16198/skills/yeet/SKILL.md`

## Hard Limits

- Do not use `finish-pr-loop` or `finish-pr-context7` as workflows.
- Do not use `resolve-agent-reviews` as a workflow.
- Do not use the official CodeRabbit `autofix` skill for this task because it
  prompts the user for fix choices and push decisions.
- Do not run `npx agent-reviews --watch`.
- Do not create heartbeat automations.
- Do not keep polling after the bounded round count is exhausted.
- Do not run another local CodeRabbit review pass here; task 9 owns the
  two-pass local CodeRabbit review workflow.
- Do not manually review code and claim the result came from CodeRabbit.
- Do not ask the user to choose fixes unless a finding is genuinely ambiguous,
  unrelated to the migration, or would require broad scope expansion.

## Preconditions

Before publishing or hardening:

1. Confirm tasks 3-9 are complete, committed, and recorded in the queue.
2. Confirm the current branch is not `main` or `master`.
3. Run `git status -sb` and inspect whether the worktree contains unrelated
   user changes.
4. If the worktree is mixed, stage only task-owned files. Do not use
   `git add -A` unless the whole worktree is confirmed in scope.
5. Confirm `gh auth status` works before GitHub reads or writes.

## Publish PR

Use local `git` for branch, commit, and push. Prefer the GitHub app for PR
creation after the branch is pushed; use `gh` only when the connector cannot
infer the repository or branch cleanly.

Create the PR as ready for review, not draft, because CodeRabbit must run on the
PR. If an open PR already exists for the branch, update it instead of creating a
duplicate.

The PR body must include:

- what changed
- why it changed
- task 9 CodeRabbit artifacts and verification summary
- commands run
- remaining blockers, if any

## Bounded Post-PR Rounds

Run at most three post-PR rounds. Each round is one bounded inspection and one
bounded fix unit.

At the start of each round:

1. Inspect PR checks once:
   ```bash
   python3 /Users/andrewkelley/.codex/skills/finish-pr-context7/scripts/inspect_pr_state.py --repo "." --pr "<number-or-url>"
   ```
2. Inspect unanswered bot comments once:
   ```bash
   npx agent-reviews --bots-only --unanswered
   ```
3. Pick one work unit:
   - first priority: one failing CI/check cluster, excluding non-blocking
     Codacy Low/Info noise;
   - second priority: one cluster of actionable CodeRabbit comments;
   - third priority: one cluster of other actionable bot review comments.
4. Fix only that work unit.
5. Run targeted verification, then `npm run check:types` and `npm run lint`.
   Add `npm run check:i18n` for user-visible copy changes and targeted tests
   for changed behavior.
6. Commit and push once if code changed.
7. Reply to each processed review comment with `npx agent-reviews --reply ...`
   and `--resolve` when the issue is fixed or intentionally won't-fix.

Stop early when a round's one-shot inspection shows:

- no failing checks except non-blocking Codacy Low/Info noise; and
- no actionable unanswered bot comments.

Stop and ask the user when:

- a requested fix is unrelated to this migration;
- a fix would require broad architecture or deletion beyond the plan;
- GitHub auth or PR discovery fails;
- the same unclear CI failure remains after one focused fix attempt;
- any security, auth, policy, data-loss, or merge-blocking CI issue remains
  after round 3.

## CodeRabbit PR Comments

For CodeRabbit comments on the opened PR, use raw PR review-thread data from
`npx agent-reviews --bots-only --unanswered` and any available GitHub thread
metadata. Do not invoke the official CodeRabbit `autofix` skill because this
task should not prompt the user for each fix.

Use CodeRabbit's agent-ready fix prompt from the PR thread when present as
evidence to inspect, not as code to execute blindly. Verify the finding against
the local code and repo rules, apply the fix when it is a real actionable
migration issue, commit once with the round's changes, push, then reply/resolve
through `npx agent-reviews`.

If a CodeRabbit comment is a false positive, unrelated style churn, or outside
the ZenStack authorization migration, reply with a concise won't-fix reason and
resolve it only when it is part of the assigned work unit.

## Codacy and Advisory Findings

Codacy Critical, High, Medium, security, and confirmed bugs in touched code are
actionable. Codacy Low/Info, coverage noise, duplication noise, and generic
framework analyzer mismatches are not blockers.

For non-blocking Codacy comments, reply with a concise won't-fix reason and
resolve only when the comment appears in the assigned work unit. Do not keep the
loop open solely to clear Low/Info Codacy issues.

## State

Persist compact state outside the repo:

```text
~/.codex/tmp/mitsailing-zenstack-admin-authorization/task-10-pr-hardening.json
```

Track:

- PR URL and number
- branch
- latest pushed commit
- round number
- processed comment IDs
- failing checks summary
- commands run
- blockers

Keep state compact. Do not paste full CI logs, full CodeRabbit exports, or full
PR diffs into the state file or worker prompts.

## Final Output

Finish with:

- PR URL
- latest pushed commit
- rounds run
- checks state
- CodeRabbit/GitHub comments fixed or documented
- commands run
- remaining blockers or risks
