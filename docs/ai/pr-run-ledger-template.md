# PR Agent Run Ledger

PR:
Branch:
Run directory:
Conductor:
Last updated:

Copy this template to `local/agent-runs/pr-<number>/conductor.md`, or to
`local/agent-runs/<branch-slug>/conductor.md` before a PR number exists. Keep
it small. Do not paste raw logs, full transcripts, or full rule files.

## Classification

PR class:
Reason:

## Required Specialists

| Specialist | Trigger | Status | Packet | Result |
| --- | --- | --- | --- | --- |
| Triage | Always for code-changing PRs | Pending | `packets/01-triage.md` | |
| Focused fix | Confirmed blocker or approved implementation | Pending | `packets/02-focused-fix.md` | |
| Independent bug review | Always before merge-readiness claim | Pending | `packets/03-bug-review.md` | |
| Final verification | Always before final answer | Pending | `packets/04-final-verification.md` | |

## Local Review Gates

Merge readiness is blocked until every required gate is `Done` and every
finding is fixed or classified with evidence. GitHub comments may be used as
inputs, but this local gate is the source of truth for AI review completion.

| Gate | Required when | Status | Evidence | Unresolved findings |
| --- | --- | --- | --- | --- |
| Persona matrix written and user-reviewed | UI, journey, admin, onboarding, or capability-gated PRs | Pending | | |
| Selected personas executed | UI, journey, admin, onboarding, or capability-gated PRs | Pending | | |
| Persona findings fixed/classified | UI, journey, admin, onboarding, or capability-gated PRs | Pending | | |
| Independent local bug review executed | Every code-changing PR | Pending | | |
| Local review findings fixed/classified | Every code-changing PR | Pending | | |
| GitHub comments/threads inspected | Every PR with comments or requested changes | Pending | | |

## Run Artifacts

Persona matrix:
Follow-up drafts:
Worker packets:
Worker results:
Durable task list or parent issue:

## Task List Sync

Use this section to mirror, not replace, the durable GitHub task list. After
GitHub changes, update this section with the issue/task link and timestamp. If
a local draft is promoted, mark the draft `promoted`; if rejected, mark it
`obsolete` or `rejected` with a short reason.

| Task/gap | Durable source | Local status | Agent/persona evidence | Action needed |
| --- | --- | --- | --- | --- |
| | GitHub parent issue, child issue, milestone, or none yet | Planned / in progress / done / blocked / deferred / discovered / dropped | | Update existing task / draft issue / ask user |

## Blockers

| Finding | Evidence | Owner | Status |
| --- | --- | --- | --- |
| | | | |

## Product Judgment Queue

| Decision | Evidence | Options | Recommended answer | Impact if deferred | User decision |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Files Changed

| File | Agent | Reason |
| --- | --- | --- |
| | | |

## Verification

| Command/check | Required | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| `npm run build-local` | Before merge-ready claim | | | |
| `npm run lint` | Yes | | | |
| `npm run check:types` | Yes | | | |
| `npm run check:deps` | Before merge-ready claim | | | |
| `npm run check:i18n` | Before merge-ready claim | | | |
| `npm run test:coverage` | Before merge-ready claim | | | |
| `npm run test:e2e` | Journey/user-flow PRs | | | |
| Required GitHub checks | Before merge | | | |
| Advisory GitHub checks | Report only | | | |
| CodeRabbit comments | Report separately from independent bug review | | | |
| CodeRabbit finishing touches | Must remain untriggered unless user explicitly requested | | | |
| Sonar/Codacy/analyzers | Include commit SHA and timestamp | | | |

## Merge Readiness

Local HEAD:
PR head:
Unpushed changes:
Persona gate:
Independent local review gate:
GitHub comments/thread gate:
Commitlint:
Signed commits or branch protection satisfied:
Review approval:
Review threads:
Required remote checks:
Advisory remote checks:
Remote analyzer freshness:
Rebased on current `origin/main`:
Merge strategy:
CodeRabbit credit/rate-limit status:
CodeRabbit write actions requested by user:

## Follow-Up Issues

| Gap | Duplicate search | User approved | Issue |
| --- | --- | --- | --- |
| | | | |
