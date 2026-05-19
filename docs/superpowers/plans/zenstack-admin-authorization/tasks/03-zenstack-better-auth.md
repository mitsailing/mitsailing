# 03 - ZenStack Client and Better Auth Adapter

## Goal

Use ZenStack for Better Auth storage and expose a fail-closed auth context for
ZenStack policies.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/nextjs-node-server-2026.mdc`
- Original plan headings:
  - `Task 5: Add ZenStack Client and Auth Context`
  - `Task 6: Add ZenStack Zod Factory and Local Studio Verification`

## Scope

- Add client-safe app auth context helper.
- Add server-only ZenStack auth adapter and client helpers.
- Switch Better Auth to `@zenstackhq/better-auth`.
- Expose `appRole`, `emailVerified`, and `banned` in session user data.
- Narrow Better Auth admin plugin powers to `appRole === admin`.
- Add ZenStack Zod schemas for EventCategory as the first converted form path.

## Acceptance

- Banned, unverified, impersonated, or malformed sessions fail closed before admin
  or generated ZenStack routes get an auth context.
- Better Auth `role` remains a mirror only.
- Better Auth role mirror updates use Better Auth admin APIs, not direct DB writes.
- `npm run test -- src/libs/zenstack/auth.test.ts src/libs/zenstack/zod.test.ts`
  passes.
