# PR Persona Matrix

PR:
Branch:
Last updated:
Conductor:

Use this template for UI, journey, admin, onboarding, or capability-gated PR
runs. Copy it to `local/agent-runs/pr-<number>/personas.md`, or to
`local/agent-runs/<branch-slug>/personas.md` before a PR number exists. Do not
commit PR-specific persona files unless the user explicitly asks.

## Personas

| Persona | Actor/session | Goal | Status | Current path | Prerequisite gates | Blocked state | Eligible state | Staff/admin handoff | Evidence | Owner issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIT student | Separate browser/session from staff | Get a sailing card | Capability-gated | | Intro for experienced sailors or one beginner class must be complete | Staff cannot assign a sailing card yet | User completed required class or intro | Staff assigns card only after eligibility | Playwright, DB query, screenshot | |
| Staff/admin | Separate browser/session from student | Review registration and issue card | Capability-gated | | User must be eligible | Card action unavailable or rejected | Card action available and succeeds | Admin records card assignment | Playwright, DB query, screenshot | |

## Executable Acceptance Checks

### MIT student onboarding

Persona:
Actor/session:
Seeded data:
Start route:
Given:
When:
Then:
Blocked-state assertion:
Eligible-state assertion:
Staff/admin handoff:
Evidence source:

### Staff/admin card assignment

Persona:
Actor/session:
Seeded data:
Start route:
Given:
When:
Then:
Blocked-state assertion:
Eligible-state assertion:
Staff/admin handoff:
Evidence source:

## Product Judgment Questions

| Question | Recommended answer | Impact if deferred | Blocking |
| --- | --- | --- | --- |
| | | | |

## Missing Capability Issues

| Gap | Evidence | Suggested owner issue |
| --- | --- | --- |
| | | |
