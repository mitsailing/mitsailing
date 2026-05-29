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

## Run Artifacts

Persona matrix:
Follow-up drafts:
Worker packets:
Worker results:

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
| CodeRabbit | Report separately from independent bug review | | | |
| Sonar/Codacy/analyzers | Include commit SHA and timestamp | | | |

## Merge Readiness

Local HEAD:
PR head:
Unpushed changes:
Commitlint:
Signed commits or branch protection satisfied:
Review approval:
Review threads:
Required remote checks:
Advisory remote checks:
Remote analyzer freshness:

## Follow-Up Issues

| Gap | Duplicate search | User approved | Issue |
| --- | --- | --- | --- |
| | | | |
