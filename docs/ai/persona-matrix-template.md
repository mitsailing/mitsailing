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

## Personas

| Persona ID | Persona | Actor/session | Goal | Status | Current path | Seeded data | Prerequisite gates | Blocked-state assertion | Eligibility transition | Eligible-state assertion | Staff/admin handoff | Evidence source | Finding classification | Owner issue or durable doc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| student-card-onboarding | MIT student | Separate browser/session from staff | Get a sailing card | Capability-gated | | Unique verified user | Intro for experienced sailors or one beginner class must be complete | Staff cannot assign a sailing card yet | User completes intro for experienced sailors or one required beginner class | User becomes ready for staff card assignment | Staff assigns card only after eligibility | Playwright, DB query, screenshot | Needs verification | |
| admin-card-assignment | Staff/admin | Separate browser/session from student | Review registration and issue card | Capability-gated | | Eligible user from student flow | User must be eligible | Card action unavailable or rejected before eligibility | User eligibility exists | Card action available and succeeds | Admin records card assignment | Playwright, DB query, screenshot | Needs verification | |
| pavilion-rental-payment-question | Pavilion rental requester | Separate public or authenticated user session | Understand how to pay for a pavilion rental | Supported if clear copy exists | Pavilion rental inquiry or reservation path | Rental request data | Payment is manual | UI must not imply online payment is available | Staff/manual payment next step is shown | User knows who follows up or how manual payment happens | Staff handles payment manually | Playwright, screenshot, copy review | Needs verification | |

## Status Labels

- `Supported`: implemented and verified.
- `Partially supported`: some path exists, but required workflow coverage is incomplete.
- `Manual staff workaround`: staff can complete it outside the intended product flow.
- `Not built`: no product path exists; track as an issue if approved.
- `Capability-gated`: request or intent can exist, but completion requires prerequisites.
- `Blocked by policy decision`: needs product decision before implementation.
- `Needs verification`: expected to work, but no evidence yet.

Keep status separate from finding classification. Classification is `PR
blocker`, `follow-up`, `won't fix`, or `needs product judgment`.

## Executable Acceptance Checks

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
