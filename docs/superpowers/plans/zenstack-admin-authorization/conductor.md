# Sequential Conductor

The conductor is the only agent that should hold the migration-wide view. Its job
is coordination, not implementation.

## Loop

1. Read `task-queue.md` and choose the first unchecked packet.
2. Start one fresh worker with:
   - the assigned `tasks/*.md` packet;
   - `AGENTS.md`;
   - only the rule paths listed in the packet;
   - the package-first gate from `.cursor/rules/package-first-simple.mdc`;
   - the instruction to inspect before editing and to update only its packet scope.
3. Wait for the worker to finish.
4. Review the diff before starting another worker.
5. Run the packet verification commands.
6. Update `task-queue.md` with completion notes, commands run, and blockers.
7. Continue to the next packet.

## Reasoning Effort

Use GPT-5.5 reasoning deliberately:

- `low`: repository searches, inventory, formatting-only docs, and simple copy edits.
- `medium`: ordinary implementation when APIs are already verified by local code or docs.
- `high`: auth, data access, migrations, policy tests, admin UI redesign, and failing-check fixes.
- `xhigh`: conductor planning, cross-cutting auth/database decisions, repeated verification failure,
  or resolving contradictory CodeRabbit/Sonar/security findings.

Do not use high or xhigh just because a task is long. Use it when a wrong decision
would create security, migration, or review-bot churn.

## Stop And Slack

Slack `mitsailing` / `ak` only when blocked by:

- conflicting product/security requirements;
- dependency/API incompatibility after checking current docs and installed types;
- destructive migration or data-loss risk;
- repeated verification failure after one focused fix attempt;
- a UX decision that cannot be inferred from existing admin patterns.
- a worker is about to build custom infrastructure where an existing maintained
  package or local abstraction may be the simpler choice.

Do not Slack for routine implementation choices, passing milestones, low/info
analyzer noise, or small refactors.

## Worker Prompt Skeleton

```txt
You are a fresh worker in /Users/andrewkelley/GitHub/mitsailing.

Use GPT-5.5 reasoning effort: <low|medium|high|xhigh>.
Read AGENTS.md, then read:
- docs/superpowers/plans/zenstack-admin-authorization/tasks/<packet>.md
- cited .cursor/rules paths only

Scope: only the assigned packet. Inspect first. Do not load the full original
ZenStack plan unless the packet explicitly sends you to a heading for a needed
snippet. Use Context7/official docs before relying on package APIs. Keep changes
small and maintainable. Before building custom infrastructure, check existing
repo patterns and package options; stop if the package-first rule says to ask.
If blocked by the Stop And Slack policy, stop and report the exact question.

Return: changed files, tests run, remaining risk, and any queue note the conductor
should write.
```
