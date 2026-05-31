# PR Persona Matrix

PR:
Branch:
Last updated:
Conductor:
Last updated by user:
Last reloaded by conductor:
Reload required: yes/no
Worker dispatch allowed: yes/no

Use this template for UI, journey, admin, onboarding, or capability-gated PR
runs. Copy it to `local/agent-runs/pr-<number>/personas.md`, or to
`local/agent-runs/<branch-slug>/personas.md` before a PR number exists. Do not
commit PR-specific persona files unless the user explicitly asks.

Merge readiness is blocked until every selected persona row has evidence for
its executable acceptance check and has each finding classified as `PR blocker`,
`follow-up`, `won't fix`, or `needs product judgment`. `PR blocker` findings
must be fixed before merge readiness. `needs product judgment` blocks until the
user decides or explicitly defers it.

## Personas

| Persona ID | Persona | Actor/session | Goal | Status | Current path | Seeded data | Prerequisite gates | Blocked-state assertion | Eligibility transition | Eligible-state assertion | Staff/admin handoff | Evidence source | Finding classification | Owner issue or durable doc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| software-engineer-conductor | Software engineer or agent conductor | Local repo, GitHub PR, Linear/GitHub tasks, local run files | Use the runbook to make safe code changes for this PR | Required for feature/code PRs | README prompt -> runbook -> conductor ledger -> persona matrix -> durable task source -> verification | PR URL, branch, repo rules, Linear/GitHub task links | Must keep context small, ask before product semantics or issue creation, and run independent bug review | Cannot start implementation if task source, persona file, or verification gates are unclear | Run packet is clear and user has reviewed editable persona/task files | Implementation workers can proceed with bounded prompts and evidence requirements | Follow-up gaps are linked to Linear/GitHub, not chat memory | Ledger, task links, command output, manual note | Needs verification | |
| student-card-onboarding | MIT student | Separate browser/session from staff | Get a sailing card | Capability-gated | | Unique verified user | Intro for experienced sailors or one beginner class must be complete | Staff cannot assign a sailing card yet | User completes intro for experienced sailors or one required beginner class | User becomes ready for staff card assignment | Staff assigns card only after eligibility | Playwright, DB query, screenshot | Needs verification | |
| admin-card-assignment | Staff/admin | Separate browser/session from student | Review registration and issue card | Capability-gated | | Eligible user from student flow | User must be eligible | Card action unavailable or rejected before eligibility | User eligibility exists | Card action available and succeeds | Admin records card assignment | Playwright, DB query, screenshot | Needs verification | |
| pavilion-rental-payment-question | Pavilion rental requester | Separate public or authenticated user session | Understand how to pay for a pavilion rental | Supported if clear copy exists | Pavilion rental inquiry or reservation path | Rental request data | Payment is manual | UI must not imply online payment is available | Staff/manual payment next step is shown | User knows who follows up or how manual payment happens | Staff handles payment manually | Playwright, screenshot, copy review | Needs verification | |

## Status Labels

Suggested run-status values:

- `Selected`: this persona applies to the PR and must run.
- `Running`: a sub-agent or manual pass is currently evaluating it.
- `Done`: evidence is captured and findings are classified.
- `Skipped`: not applicable, with a short reason in the evidence/source column.
- `Blocked`: cannot complete without a user decision, credentials, data, or a
  prerequisite fix.

Product support labels:

- `Supported`: implemented and verified.
- `Partially supported`: some path exists, but required workflow coverage is incomplete.
- `Manual staff workaround`: staff can complete it outside the intended product flow.
- `Not built`: no product path exists; track as an issue if approved.
- `Capability-gated`: request or intent can exist, but completion requires prerequisites.
- `Blocked by policy decision`: needs product decision before implementation.
- `Needs verification`: expected to work, but no evidence yet.

Keep status separate from finding classification. Classification is `PR
blocker`, `follow-up`, `won't fix`, or `needs product judgment`.

## Persona Model Checks

For each feature slice, create the selected persona framing once, then review
that persona and your reasoning twice before relying on it. This is not three
separate persona runs; it is one persona plus two explicit checks that the
persona behaves like a real user or admin and that the website path is super
simple. Record the answer in the evidence column or in the Impeccable/anti-slop
tables below.

1. Would this real person naturally start here on the website, with this goal
   and this amount of context? If the persona sounds like a route, table, queue,
   schema model, Stripe object, or implementation concern, rewrite it as a human
   user/admin task.
2. Is the website path obvious and minimal for this person: find the thing,
   understand the current state, take the next action, and recover from blockers
   without hunting through extra pages or controls?
3. Did the persona lead us to add complexity that does not make the user's or
   admin's path simpler? Prefer the existing user/admin page, form, filter, or
   helper unless a split directly simplifies that real workflow.

## Executable Acceptance Checks

### Software engineer conductor

Persona ID:
Persona:
Actor/session:
PR:
Branch:
Run directory:
Durable task source:
Given:
When:
Then:
Context-control assertion:
Task-tracking assertion:
Product-semantics stop condition:
Issue-creation stop condition:
Independent bug-review gate:
Verification gate:
Evidence source:

### MIT student onboarding

Persona ID:
Persona:
Actor/session:
Actor storage state/context name:
Session creation method:
Cross-actor contamination check:
Invalid if same session reused: yes/no
Seeded data:
Start route:
Given:
When:
Then:
Blocked-state assertion:
Eligibility transition:
Eligible-state assertion:
Staff/admin handoff:
Evidence source:

Failing test artifact:
- Test file:
- Test title:
- Expected initial failure:
- Failure command:
- Failure evidence:
- Implementation gate: no fix agent starts until the failing test exists or an
  explicit impracticality note is recorded.

Email evidence:
- Email expected: yes/no
- Recipient key:
- Mailbox isolation:
- Mailpit assertion:
- No-email assertion:

Database evidence:
- DB setup helper/file:
- DB assertion query/helper:
- Tables asserted:
- Before state:
- After blocked state:
- After eligible state:
- Cleanup key:

Screenshot evidence:
- Screenshot required: yes/no
- Screenshot point:
- Artifact path:
- Assertion paired with screenshot:

### Staff/admin card assignment

Persona ID:
Persona:
Actor/session:
Actor storage state/context name:
Session creation method:
Cross-actor contamination check:
Invalid if same session reused: yes/no
Seeded data:
Start route:
Given:
When:
Then:
Blocked-state assertion:
Eligibility transition:
Eligible-state assertion:
Staff/admin handoff:
Evidence source:

Capability gate tests:
- Blocked state test:
- Eligibility transition test:
- Completion test:
- Premature completion impossible assertion:
- Visible to user assertion:
- Visible to staff/admin assertion:

## Impeccable Evidence

| Gate | Command/reference used | Touchpoint | Evidence artifact | Classification | User decision |
| --- | --- | --- | --- | --- | --- |
| setup | PRODUCT.md, DESIGN.md, product register | | | | |
| shape | `impeccable shape` for net-new or meaningful UI/journey work | | | | |
| critique | Concrete page, form, email, or admin touchpoint | | | | |
| clarify | Copy, labels, errors, eligibility, emails, admin actions | | | | |
| adapt | Mobile, tablet, and desktop where relevant | | | | |
| audit | Keyboard, focus, semantics, contrast, tokens, states | | | | |
| harden | Long names, empty/error states, permissions, double submit, stale state | | | | |
| polish | Final design-system alignment and anti-AI-slop verdict | | | | |

## Structural Simplicity Evidence

| Proposed structure | Existing simpler option | Boundary that justifies split | Evidence/test | Classification |
| --- | --- | --- | --- | --- |
| | | | | |

## Product Judgment Questions

| Question | Recommended answer | Impact if deferred | Blocking |
| --- | --- | --- | --- |
| | | | |

## Operational Parity Inventory

Use this for migration, admin/member lifecycle, email, import, scheduled-job,
or deployment/runtime PRs.

| Operation | Legacy evidence | Trigger | Cadence/timezone | Owner actor | Inputs | Outputs/side effects | Idempotency/dedupe | Retry/failure/alert | Runtime dependency | New-app status | Verification evidence | Classification | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIT warehouse person_sailing refresh | | Cron/manual run | Daily or documented cadence | System | Oracle/MIT warehouse, DB credentials | Local `dw` data freshness | | | Oracle/MIT warehouse, env vars | Needs verification | DB assertion or job log | Needs product judgment | |
| New-card mailing list sync | | Cron/manual run | Daily or documented cadence | System | New card records, Mailman credentials | Mailman subscription changes | | | Mailman API, network, env vars | Needs verification | Job log plus external-side-effect note | Needs product judgment | |

## Missing Capability Issues

| Gap | Evidence | Suggested owner issue |
| --- | --- | --- |
| | | |
