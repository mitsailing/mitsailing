# ZenStack Admin Authorization Control Plane

This folder is the AI-facing control plane for implementing
`docs/superpowers/plans/2026-05-18-zenstack-admin-authorization.md`.

Use this folder first. The original 2,899-line plan is the detailed reference, not
the default worker prompt.

## Execution Model

- One conductor owns the full queue.
- One fresh worker handles one task packet at a time.
- Workers do not run in parallel for this migration.
- Each worker receives only `AGENTS.md`, relevant `.cursor/rules/*.mdc` paths, this
  folder, its assigned task packet, and the exact source files it discovers.
- The conductor reviews the diff, runs the task's verification commands, updates
  `task-queue.md`, then starts the next worker.
- Slack `mitsailing` / `ak` only for real blockers: conflicting requirements,
  dependency/API incompatibility, destructive migration risk, repeated verification
  failure, or a UX decision that cannot be inferred from existing admin patterns.

## Context Rules

- Do not paste full `.cursor/rules/*.mdc` bodies into worker prompts. Cite paths.
- Do not paste the full original plan into worker prompts. Cite the relevant task
  packet and heading in the original plan only when the packet says to.
- Use Context7 or official package docs before relying on ZenStack, Better Auth,
  Prisma, Next.js, React Hook Form, Zod, or adapter API behavior.
- Prefer maintained packages for commodity behavior. New production dependencies
  should be active in the last year, not deprecated, and should normally have
  2,000+ GitHub stars unless the dependency is the official package for the stack
  being adopted.
- Stop and ask before building a custom subsystem when an established package or
  existing repo abstraction could own the behavior.

## Files

- `conductor.md`: orchestration loop, model/reasoning selection, Slack policy.
- `context-map.md`: what each worker should read and what it should avoid.
- `skills.md`: which reusable skills to use and which low-signal skills to avoid.
- `task-queue.md`: ordered worker queue and status.
- `tasks/*.md`: small worker packets with scope, acceptance, and verification.
