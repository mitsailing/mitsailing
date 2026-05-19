# 07 - Event Workflow Data Access

## Goal

Move event admin data access to ZenStack protected clients while preserving the
existing workflow logic.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/nextjs-node-server-2026.mdc`
- `.cursor/rules/dates-us-eastern.mdc`
- Original plan heading: `Task 14: Move Event Backend Workflow to ZenStack Protected Client`

## Scope

- Move public `/events`, `/events/[slug]`, and `/events/[slug]/register` event
  reads and registration actions to ZenStack-backed event access.
- Replace CASL event filters with ZenStack protected queries.
- Use ZenStack for Event/EventAdmin/EventDate/question/fee writes where practical.
- Keep custom workflow logic for slugging, capacity, registration transitions,
  payment, cache invalidation, redirects, and email side effects.
- Update error mapping from Prisma-only classes to the verified ZenStack/Kysely
  error behavior.

## Acceptance

- Public `/events`, `/events/[slug]`, and `/events/[slug]/register` use
  ZenStack-backed event access.
- Event admin tests pass without CASL.
- Public event registration actions fail closed for banned or unverified users.
- Generic CRUD is not used for workflow-heavy event mutations.
