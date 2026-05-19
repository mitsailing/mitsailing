# Context Map

## Always Read

- `AGENTS.md`
- Assigned `tasks/*.md` packet
- `skills.md` when deciding whether to load or install an additional skill
- Source files discovered by `rg`
- Package docs through Context7 or official docs when the task uses external APIs

## Rule Paths To Cite

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/nextjs-node-server-2026.mdc`
- `.cursor/rules/e2e-verification.mdc`
- `.cursor/rules/admin-list-usability.mdc`
- `.cursor/rules/ui-color-tokens.mdc`
- `.cursor/rules/coderabbit-review.mdc`

Add task-specific rules only when touched files require them, for example
`dates-us-eastern.mdc`, `next-intl-single-locale-routing.mdc`, or
`pavilion-reservation-pricing.mdc`.

## Avoid By Default

- Full `.cursor/rules/*.mdc` bodies in prompts.
- Full CodeRabbit false-positive history in worker prompts.
- Full original plan content in worker prompts.
- Generated files unless the task is code generation or generated-artifact verification.
- Broad PR review logs unless the task is a review-bot loop.

## Admin UX Invariant

Admin list pages are management surfaces. Workers touching admin pages must apply
`.cursor/rules/admin-list-usability.mdc`:

- comparable rows by default;
- visible row actions;
- no horizontal scroll required to reach actions;
- mobile rows expose labels and actions;
- primary identifiers link to the safest default destination.

## Package-First Gate

Workers must apply `.cursor/rules/package-first-simple.mdc`. If a task starts to
build a custom subsystem that looks like a package should own it, stop and ask
before coding. Examples: custom table engines, custom form resolver layers,
custom auth adapters, custom generated CRUD, custom policy engines, custom audit
history, or custom queue orchestration beyond the conductor loop.
