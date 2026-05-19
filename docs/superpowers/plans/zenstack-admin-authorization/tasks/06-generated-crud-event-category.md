# 06 - Restricted Generated CRUD and EventCategory Admin UX

## Goal

Expose only explicitly allowlisted ZenStack generated CRUD and move EventCategory
catalog CRUD/form validation to ZenStack and React Hook Form.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/nextjs-node-server-2026.mdc`
- `.cursor/rules/admin-list-usability.mdc`
- `.cursor/rules/ui-color-tokens.mdc`
- Original plan headings:
  - `Task 12: Mount Restricted ZenStack Next.js Adapter`
  - `Task 13: Move EventCategory Catalog CRUD to ZenStack`

## Scope

- Mount `/api/model/[...path]` with a verified ZenStack Next.js handler.
- Allowlist only EventCategory via explicit model mapping.
- Keep auth/account/workflow-heavy models out of generic CRUD.
- Move EventCategory catalog handler to ZenStack protected client.
- Use ZenStack Zod + React Hook Form for EventCategory only.
- Preserve server-side create behavior for id, createdAt, and displayOrder.

## Acceptance

- Unauthenticated, impersonated, banned, or unverified generated API requests fail
  before handler dispatch.
- `/api/model/user`, `/api/model/event`, and `/api/model/session` return 404.
- EventCategory form still posts through server authorization and validation.
- EventCategory admin list follows `.cursor/rules/admin-list-usability.mdc`.
