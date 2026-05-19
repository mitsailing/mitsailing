# Package-First Refactor Audit Design

## Goal

Create a behavior-preserving refactor audit process that reduces owned code, prevents agent overbuilding, and makes self-hosted Bemi Prisma migration a first-class audit item.

## Context

This design is intentionally written before source-code analysis. The audit will inspect current code later. The immediate problem is process quality: agents can build custom infrastructure when maintained packages would delete code and reduce long-term ownership.

Useful external references:

- [Bemi Prisma](https://github.com/BemiHQ/bemi-prisma): required target for self-hosted open-source audit trail migration.
- [GitHub agent skills docs](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills): skills are focused instruction folders; third-party skills must be inspected before use.
- [github/awesome-copilot refactor](https://skills.sh/github/awesome-copilot/refactor): behavior-preserving, small-step refactoring workflow.
- [addyosmani code-review-and-quality](https://github.com/addyosmani/agent-skills/blob/main/skills/code-review-and-quality/SKILL.md): review against correctness, readability, architecture, security, and performance.
- [obra/superpowers](https://github.com/obra/superpowers): spec-first, TDD, YAGNI, DRY, review-gated workflow.

## Decisions

- Success metric: maintainable behavior-preserving boundaries first, net code reduction second, future agent guardrails third.
- Audit scope: start with a hotspot audit, then create PR-sized implementation slices.
- Ranking evidence: file/function size, duplication, dependency direction, complex conditionals, recent churn, tests, analyzer findings, user-facing blast radius, and likely net code deletion.
- UI code: include UI, but score with repo-specific i18n, accessibility, Tailwind, token, and responsive constraints.
- Abstractions: simplify locally first. Add shared abstractions only for at least three real call sites or a stable domain concept.
- Dependency replacement: package-first for commodity systems, not custom-first.
- Bemi Prisma: required migration target for audit trail work, self-hosted open-source posture.
- Early implementation order: audit Bemi first, but allow low-risk local simplifications before the Bemi PR if the audit finds clear wins.

## Audit Output

The audit will produce:

1. A ranked table of refactor candidates.
2. Detailed briefs for top candidates.
3. A dedicated self-hosted Bemi Prisma migration brief.
4. Proposed package-first rule updates for repo agent guidance.

Each candidate brief must include:

- Current owned-code surface.
- Recommended action: delete, simplify, consolidate, package replacement, architecture migration, leave alone, or needs product decision.
- Expected code deletion or simplification.
- Behavior risk.
- Test coverage and missing characterization tests.
- Integration points.
- License and maintenance signals for any package.
- Hosting, operational, data, privacy, and security impact.
- Rollback path.
- Targeted verification commands.

## Bemi Migration Brief

The Bemi brief must map:

- Current audit-trail responsibilities and data consumers.
- Owned audit infrastructure to delete.
- Minimal app-owned wrapper that may remain: context mapping, app-specific authorization/display helpers, and migration glue.
- Bemi Prisma integration points.
- Self-hosted open-source deployment requirements.
- License implications.
- Data retention, sensitive-data handling, and admin/member privacy risk.
- Migration and rollback plan.
- Required tests and manual verification.

The Bemi brief is not optional. It can be sequenced after low-risk simplifications, but it must be written in the first audit artifact.

## Low-Risk Simplifications

Before the Bemi PR, allowed low-risk simplifications are only:

- Behavior-preserving local changes.
- No new dependency.
- No schema change.
- No route behavior change.
- Existing tests or easy characterization tests.
- Clear net reduction or clarity improvement.

## Package-First Guardrail

Add this policy to always-loaded repo guidance after this design is accepted:

> Before custom-building commodity infrastructure, search for maintained packages or hosted/open-source systems first. Commodity infrastructure includes audit trails, auth, permissions, queues, notifications, search, exports, scheduling, billing, analytics, and similar cross-cutting systems. If no suitable package exists, document evaluated options and ask before building custom infrastructure. Custom code must be justified by repo-specific behavior, unacceptable package risk, license constraints, or operational constraints.

Planned locations:

- `AGENTS.md`: shared source of truth for Codex and Cursor.
- `.cursor/rules/package-first.mdc`: short always-applied Cursor rule for sessions that do not begin from a spec or plan.

## Non-Goals

- No source-code audit in this design step.
- No implementation plan for every candidate.
- No broad rewrite campaign.
- No rule-file edits until this spec is reviewed.
- No package adoption without package risk review.

## Verification

For the later audit and implementation work:

- Use targeted tests for each behavior-preserving slice.
- Use characterization tests before deleting or replacing custom behavior.
- Run `npm run lint` and `npm run check:types` before claiming code changes are complete.
- Use `npm run test` or targeted tests when the touched area has meaningful test coverage.
- Report when remote analyzer results may be stale until CI re-runs.
