# 05 - Event Authorization Policies

## Goal

Encode event, event admin, event registration, and child-model access in ZModel
policies.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/dates-us-eastern.mdc`
- Original plan headings:
  - `Task 10: Replace Event Created By With EventAdmin`
  - `Task 11: Encode ZenStack Access Policies`

## Scope

- Remove `Event.createdByUserId`; use `EventAdmin` as the management relation.
- Add ZModel policies for `Event`, `EventAdmin`, `EventRegistration`, dates,
  questions, fees, answers, and comments.
- Keep public reads for published event content.
- Do not make `EventAdmin` assignments publicly readable.
- Do not allow users to update arbitrary registration rows.

## Acceptance

- Real ZenStack policy tests cover assigned/unassigned event admins, staff/admin
  roles, user-owned registrations, answer/question event matching, and child-model
  includes.
- `npx zen check --schema zenstack/schema.zmodel` passes.
- No live event code depends on `createdByUserId`.
