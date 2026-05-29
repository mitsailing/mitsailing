# Feature Task List

Feature:
Parent issue:
Milestone:
GitHub Project:
Current PR:
Last updated:

Use this shape in a GitHub parent issue for any feature that spans more than
one PR, has known deferred work, or depends on persona-discovered gaps. The
GitHub issue is the durable source of truth. Use a milestone for the release or
phase. Use a GitHub Project only when the parent issue plus milestone are not
enough. Local agent ledgers only mirror state for the current run.

## Goal

What user or staff outcome should exist when this feature is complete?

## Non-Goals

What should agents avoid building in this feature?

For membership pricing work, pavilion rental online payment is a non-goal
unless the user explicitly adds it. Pavilion rental payment is manual; personas
should verify that users are told the manual payment next step clearly.

## Tasks

| Task | Status | Source | Owner PR/issue | Acceptance evidence |
| --- | --- | --- | --- | --- |
| | Planned / in progress / done / blocked / deferred / discovered | User / persona / legacy / CI / review | | |

## Persona-Discovered Gaps

| Persona | Gap | Evidence | Current status | Existing task/issue | Action |
| --- | --- | --- | --- | --- | --- |
| Non-MIT racer | Cannot pay for racing membership during onboarding | Persona attempts pricing-to-signup flow and payment is unavailable | Deferred | | Add issue or task if missing |

## Decisions

| Decision | Options | User decision | Impact |
| --- | --- | --- | --- |
| | | | |

## Completion Gate

This feature is complete only when:

- required tasks are `done`;
- deferred tasks have linked issues or explicit user approval;
- persona-discovered gaps are either fixed, linked, or intentionally dropped;
- CI and required reviews are green for the final PR;
- parent issue acceptance criteria are satisfied.
