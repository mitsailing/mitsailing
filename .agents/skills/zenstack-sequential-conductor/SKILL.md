---
name: zenstack-sequential-conductor
description: Sequentially orchestrate the MIT Sailing ZenStack admin authorization migration with one fresh worker at a time, compact context, package-first gates, and verification checkpoints.
---

# ZenStack Sequential Conductor

Use for `docs/superpowers/plans/zenstack-admin-authorization/`.

## Required Inputs

- `docs/superpowers/plans/zenstack-admin-authorization/task-queue.md`
- `docs/superpowers/plans/zenstack-admin-authorization/conductor.md`
- `docs/superpowers/plans/zenstack-admin-authorization/context-map.md`
- `docs/superpowers/plans/zenstack-admin-authorization/skills.md`
- Assigned `tasks/*.md` packet

## Loop

1. Pick the first unchecked queue item.
2. Start one fresh worker with only the assigned packet and cited rule paths.
3. Require the worker to use `.cursor/rules/package-first-simple.mdc`.
4. Review the diff before the next worker.
5. Run packet verification.
6. Update `task-queue.md` with status, commands, and blockers.

## Reasoning Effort

- `low`: inventory and docs-only changes.
- `medium`: known local-pattern implementation.
- `high`: auth, policies, migrations, admin UI, or failing checks.
- `xhigh`: cross-cutting auth/database decisions or repeated verification failure.

## Stop Conditions

Stop and ask the user on Slack `mitsailing` / `ak` only for real blockers listed
in `conductor.md`, including package-vs-custom decisions.
