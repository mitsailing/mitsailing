---
name: zenstack-worker
description: Execute one ZenStack admin authorization task packet with small context, TDD, package-first simplicity, and focused verification.
---

# ZenStack Worker

Use for one task packet under `docs/superpowers/plans/zenstack-admin-authorization/tasks/`.

## Workflow

1. Read `AGENTS.md`.
2. Read the assigned task packet.
3. Read only cited `.cursor/rules/*.mdc` paths.
4. Inspect relevant code with `rg` before editing.
5. Use Context7 or official docs before relying on external APIs.
6. Write or update focused tests first when logic is testable.
7. Implement the smallest maintainable change.
8. Run packet verification commands.
9. Return changed files, tests run, remaining risks, and queue notes.

## Package-First Simplicity

Use `.cursor/rules/package-first-simple.mdc`.

Before building a custom subsystem, stop and ask whether to use a package or an
existing local abstraction. This applies especially to auth, policies, validation,
forms, tables, generated CRUD, audit/history, and orchestration.

## Supporting Skills

Use these installed skills when the task matches:

- `test-driven-development`: logic, auth, policies, validators, server actions.
- `next-best-practices`: Next.js App Router, Server Actions, RSC, route handlers.
- `shadcn`: shared UI components and shadcn conventions.
- `requesting-code-review`: before completing large or risky packets.
- `grill-me`: if a new architectural decision appears and is not settled by the packet.

