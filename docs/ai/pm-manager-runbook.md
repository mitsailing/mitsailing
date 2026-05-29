# AI PM Manager Runbook

Use this when the user asks for project management help, feature planning,
backlog cleanup, release planning, or "what needs to get finished?"

The PM manager does not write code by default. It organizes GitHub state,
protects product scope, and turns persona discoveries into durable tasks.

## Source of Truth

Use GitHub in this order:

1. Parent issue with the feature task list from
   `docs/ai/feature-task-list-template.md`.
2. Child issues for larger tasks or future PRs.
3. Milestone for release or phase grouping.
4. GitHub Project only when parent issues plus milestones become hard to scan.

Use `local/agent-runs/<id>/conductor.md` only as a mirror for the current
agent run. Do not treat local run files, chat, or persona matrices as the
durable backlog.

## Portfolio Inventory

Start every PM pass by inventorying the repo:

```bash
gh pr list --repo mitsailing/mitsailing --state open --limit 50 \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,reviewDecision,updatedAt,labels

gh issue list --repo mitsailing/mitsailing --state open --limit 100 \
  --json number,title,labels,assignees,milestone,updatedAt

git ls-remote --heads origin
```

Then classify each item:

| Item | Type | Status | Blocks | Next action | Durable home |
| --- | --- | --- | --- | --- | --- |
| | PR / issue / branch | Ready / blocked / stale / duplicate / future | | | |

## Feature Plan Rules

For each active feature, create or update one parent issue:

- goal and non-goals;
- included tasks;
- explicit out-of-scope tasks;
- child issues;
- current PRs and branches;
- milestone;
- persona-discovered gaps;
- decisions needed from the user.

The parent issue must answer:

- What is already done?
- What is in the current PR?
- What is blocked?
- What is intentionally deferred?
- What should not be built?
- What did personas discover that was missing from the plan?

## Persona Gap Reconciliation

When a persona finds a missing capability, the PM manager must not leave it in
the persona file.

Process:

1. Search the parent issue task list and open issues.
2. If the task exists, record the issue/task link in the conductor ledger.
3. If the task is missing, draft a task-list addition or child issue in
   `local/agent-runs/<id>/follow-ups.md`.
4. Ask before editing GitHub.
5. Final verification reports the gap as fixed, linked, deferred with approval,
   or intentionally dropped.

Example:

```markdown
Persona: Non-MIT racer
Discovery: The user reads pricing, starts onboarding, and cannot pay for
racing membership.
Expected PM action: Search for racing membership payment tasks. If found, link
the task and mark the PR as not responsible unless the current PR claimed to
build payment. If missing, draft "Add racing membership payment during
onboarding" with persona evidence.
```

## Pricing And Membership Defaults

For pricing, membership, and onboarding work, the PM manager should check these
known areas before creating new tasks:

- sailing-card membership payment during onboarding;
- racing membership checkout and renewal;
- waitlist flow for the two beginner intro classes;
- MIT affiliation and identity editing after onboarding;
- verified MIT email signup simplification;
- staff-gated sailing card assignment after class or intro prerequisites;
- confirmation emails and Mailman/list side effects;
- warehouse sync and stale identity data.

Explicit non-goals unless the user says otherwise:

- broad payment platform rebuilds unrelated to membership or events;
- V2 notification systems such as SMS or calendar attachments.

Pavilion rental payment rule:

- Pavilion rental payment is manual.
- Do not build online pavilion rental payment unless the user explicitly adds
  that scope.
- Personas should still ask, "How do I pay for pavilion rental?"
- The expected product behavior is clear copy that tells the user payment is
  handled manually and what staff/contact/next step follows.
- If the UI does not explain manual payment, classify it as a clarity issue,
  not as a request to build online payment.

## Training Agents From Mistakes

"Training the model" means improving the project instructions, templates,
tests, and durable examples. Do not rely on the agent remembering a chat.

When an agent misses an important issue:

1. Write the missed scenario as a concrete persona discovery.
2. Add or update a parent issue task, child issue, or non-goal.
3. Add a regression test or acceptance check if the behavior should be caught
   automatically.
4. Update the relevant template or runbook if future agents need the rule.
5. Record the correction in the parent issue under "Agent learning notes."

Learning note shape:

```markdown
## Agent learning note

Missed by agent:
Why it mattered:
Correct behavior:
Where this is now tracked:
Template/runbook/test updated:
```

Example:

```markdown
Missed by agent: Pricing persona did not attempt to pay for racing membership
after reading pricing and starting onboarding.
Why it mattered: The workflow looked clear but failed at conversion.
Correct behavior: Pricing personas must follow pricing -> signup/onboarding ->
payment or explicitly classify missing payment as deferred.
Where this is now tracked: Parent issue task "Add racing membership payment
during onboarding".
Template/runbook/test updated: Persona matrix acceptance check for payment path.
```
