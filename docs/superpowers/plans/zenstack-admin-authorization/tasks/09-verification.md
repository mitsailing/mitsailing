# 09 - Full Verification and Review-Bot Preflight

## Goal

Prove the migration is ready for CodeRabbit and CI before opening or updating the PR.

## Read

- `.cursor/rules/agent-workflow.mdc`
- `.cursor/rules/package-first-simple.mdc`
- `.cursor/rules/tdd.mdc`
- `.cursor/rules/e2e-verification.mdc`
- `.cursor/rules/coderabbit-review.mdc`
- Original plan heading: `Task 17: Verification and CodeRabbit Risk Pass`

## Scope

- Run targeted auth/ZenStack/admin/event tests.
- Run full unit/component tests.
- Run static checks.
- Run E2E gate when environment allows.
- Run preflight stale-pattern searches.
- Fix only real failures; do not churn low/info analyzer noise.

## Acceptance

- `npm run test` passes.
- `npm run lint`, `npm run check:types`, `npm run check:i18n`, and `npm run check:deps` pass.
- `npm run test:e2e` passes or a concrete environment blocker is recorded.
- Preflight search shows no stale CASL, RolePermissionGrant, `parseRoles`, event
  `createdByUserId`, direct env reads, or new casts in touched source.
