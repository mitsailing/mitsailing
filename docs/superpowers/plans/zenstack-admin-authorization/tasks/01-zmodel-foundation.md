# 01 - Dependency and ZModel Foundation

## Goal

Install ZenStack packages and establish `zenstack/schema.zmodel` as the schema
source while preserving the existing Prisma 7 generated client contract.

## Read

- `AGENTS.md`
- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- Original plan headings:
  - `Task 2: Install ZenStack v3, Better Auth Adapter, and Zod Utility`
  - `Task 3: Port Auth Models Into ZModel and Move Prisma Schema Source to ZModel`

## Scope

- Add pinned ZenStack v3 packages and React Hook Form/Zod resolver packages.
- Create `zenstack/schema.zmodel`.
- Port current Prisma models into ZModel.
- Preserve `generator client { provider = 'prisma-client'; output = '../src/generated/prisma' }`.
- Generate `prisma/schema.prisma` and commit `zenstack/schema.ts` when generated.

## Acceptance

- `npx zen check --schema zenstack/schema.zmodel` passes.
- `npx zen generate --schema zenstack/schema.zmodel` produces the expected generated artifacts.
- `npx prisma generate` still works with `src/generated/prisma`.
- No unpinned Better Auth CLI generation is used.
