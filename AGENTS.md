# AGENTS

## Principles

- Clarity and consistency over cleverness. Minimal changes. Match existing patterns.
- Build bug-free, maintainable, simple code; ask before building package-like infrastructure from scratch when an existing package or local abstraction may fit.
- User-path first: before adding or moving UI, identify the actor, their starting point, and the object they are trying to change. Put controls where that actor naturally works, not where the database/model name suggests.
- Avoid agent slop: do not add tables, pages, components, services, permissions, states, or workflows when an existing surface plus a field, filter, or narrow helper fits the current slice; split only for a proven lifecycle, permission, audit, retention, cardinality, transaction, operational, or external-platform boundary.
- Keep components/functions short; break down when it improves structure.
- TypeScript everywhere; no `any` unless isolated and necessary.
- No unnecessary `try/catch`. Avoid casting; use narrowing.
- Named exports only (no default exports, except Next.js pages).
- Absolute imports via `@/` unless same directory.
- Follow existing ESLint setup; don't reformat unrelated code.
- Zod type-only: `import type * as z from 'zod';`.
- Let compiler infer return types unless annotation adds clarity.
- Options object for 3+ params, optional flags, or ambiguous args.
- Hypothesis-driven debugging: 1-3 causes, validate most likely first.

## Verified execution

- Evidence before claims: verify mutable, remote, tool, and runtime state from the source of truth before acting or reporting.
- High-impact actions need preflight plus post-action verification; do not bypass protected safeguards without explicit authorization.
- User-caught repeatable mistakes are workflow bugs. Update the smallest relevant AGENTS/rule/runbook/skill and prefer references over long prose.

## Token efficiency

- Skip recaps unless the result is ambiguous or you need more input.
- Instruction files are context budget: keep `AGENTS.md` for always-on rules only, `.mdc` files focused and scoped, skills/runbooks procedural and loaded on demand, and prefer references over duplicated prose.
- **Cursor rules** ([Cursor docs](https://cursor.com/docs/rules)): keep each `.mdc` **focused, actionable, well-scoped** — **reference** code or docs instead of duplicating prose (official guidance allows up to **500 lines per rule**; stay **well below** that). Prefer **`globs` + `alwaysApply: false`**; use **`alwaysApply: true`** only for short universal policy. **Cite** `.cursor/rules/…` paths; do not paste full rule bodies (including in **sub-agent** prompts). **`@tdd`** for strict test-first.
- **Which rule:** `.coderabbit.yaml` is the CodeRabbit PR source of truth; `coderabbit-review.mdc` mirrors it for local agents. CodeRabbit should run as automatic review/comment input only. Do not trigger write-producing CodeRabbit finishing touches (`autofix`, generated unit tests, docstrings, simplify, custom recipes, stacked PRs) unless the user explicitly asks for that exact action. Historical CodeRabbit-heavy plans were shaped by API-limit failures; do not copy those loops forward when local independent review can provide the gate.
- Merge readiness is blocked by incomplete local AI review: required personas not run, persona findings not fixed/classified, independent local code review not run, or local review findings not fixed/classified. CodeRabbit blocks only while a review is actively running/pending or when completed actionable comments exist; CodeRabbit no-start/skipped/credit/rate-limit/auth/service failure is not a blocker unless repository policy explicitly requires it, so use local sub-agent review instead. When disabling CodeRabbit as a blocking PR status, set `reviews.commit_status: false`; `fail_commit_status: false` alone still allows red rate-limit statuses when `commit_status` is enabled.
- Other rules: `source-faithful-implementation.mdc` (exact user source, screenshots, Figma, docs, vendor source); `pr-agent-reviews-loop.mdc` (long review-bot loops: one work unit at a time); `sonarqube-review.mdc`; `package-first-simple.mdc`; `nextjs-node-server-2026.mdc`; `e2e-verification.mdc`; `dev-browser-auth.mdc`; `tdd.mdc`; `agent-workflow.mdc`; `admin-list-usability.mdc`; `ui-color-tokens.mdc`; `dates-us-eastern.mdc`; `mitsailing-single-tenant-chrome.mdc`.
- **Prod → local DB:** `.cursor/skills/pgsync-prod-to-local/SKILL.md` (`.pgsync.yml`, optional `PGSYNC_FROM_URL` in `.env`).

## Commands

Only these `npm run` scripts: `build-local`, `lint`, `check:types`, `check:deps`, `check:i18n`, `test`, `test:coverage`, `test:e2e`.

## Static Analysis

- Shared for Codex and Cursor: this `AGENTS.md` is the source of truth. `.cursor/rules/sonarqube-review.mdc` only helps Cursor load the same Sonar guidance.
- SonarQube MCP: resolve the project from `.sonarlint/connectedMode.json`; list PRs when the current PR cannot be inferred or the user asks for PR state, then check quality gate + open issues. Do not change the remote Sonar profile unless explicitly asked.
- Fix order: vulnerabilities/security hotspots, bugs/reliability gate blockers, high-impact maintainability that simplifies code, then low-risk style cleanups. Do not chase coverage, duplication, or broad complexity metrics unless the gate fails on them.
- App style/design rules win over generic Sonar code smells. UI fixes must keep Tailwind v4 utilities, shared components, translation keys, app color tokens, accessibility rules, and existing responsive behavior; if a confirmed bug or security fix conflicts with a style rule, document the tradeoff and ask before widening scope. Do not introduce raw colors, new visual patterns, hard-coded user-visible strings, prop destructuring, unnecessary hooks, or formatting churn just to silence Sonar.
- Current TypeScript Sonar alignment: no real secrets in source; local dev placeholders must be `Env`-gated and documented unless a test fixture needs an explicitly fake value. Use explicit sort comparators (`localeCompare` for strings). Reduce complexity with named helpers/components, early returns, and tests. Use readonly React props only when touching a component and it preserves the single `props` parameter pattern; do not bulk-convert TSX for low-severity `S6759` alone. Optional chaining, `.includes()`, `RegExp.exec()`, `export...from`, `globalThis`, `TypeError`, and unused-prop fixes are fine when they make code clearer.
- Codacy/PR analyzer triage: do not exclude app-owned source files to hide findings. Exclude only generated/build artifacts, vendored files, migrations, reports, or a narrowly documented tool/analyzer mismatch. Prefer fixing real issues in source; when a generic analyzer conflicts with React/Next conventions, document the mismatch and keep other analyzers covering the file. **Low/Info Codacy findings are not PR blockers** in `pr-agent-reviews-loop.mdc` loops (fix Critical/High/Medium and security; resolve low threads with documented won’t-fix).
- Do not add root config files for tools not used by local scripts just to influence PR analysis. If a remote tool needs configuration, scope it to that tool and verify `npm run lint` still uses the repo's configured stack.
- Report when Sonar results may be stale until CI re-analyzes the PR.

### Sonar Setup Top 10

1. Keep local project identity in `.sonarlint/connectedMode.json` and scanner defaults in `sonar-project.properties`.
2. Use Sonar way quality gate/profile and Clean as You Code: gate new code first, not historical debt.
3. PR analysis belongs in CI with the PR branch checked out, target branch fetched, intact `.git` metadata, and no synthetic merge-preview edits before scanning.
4. Keep `sonar.sources`, `sonar.tests`, and `sonar.test.inclusions` explicit unless Sonar changes the property contract; a file must be source or test, never both.
5. Import JS/TS coverage from `coverage/lcov.info`; Sonar does not generate coverage.
6. Exclude build outputs, dependency folders, reports, generated artifacts, migrations, and tests from metrics where they are low signal.
7. Keep Sonar tokens and host URLs in CI secrets/variables, never in repo files.
8. Treat quality-gate failures as blocking; treat low-severity code smells as cleanup only when they improve clarity.
9. Do not tune Sonar to override app UX, accessibility, i18n, or React conventions.
10. After fixes, run targeted tests plus `npm run lint` and `npm run check:types`, then wait for CI/Sonar re-analysis before claiming the remote gate is clean.

## Dev authentication (browser agents)

For **Cursor browser MCP** or manual agent browsing on **`npm run dev`** only — not a substitute for claiming `npm run test:e2e` complete, and **not** for specs that assert `/login`, sign-up, or email/password UI (those stay on real forms; see `tests/e2e/Auth.e2e.ts` and `tests/helpers/e2e-admin-sign-in.ts`).

1. Run `npm run db:seed` with your `.env` `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Open (replace with your seeded credentials):

   `http://localhost:3000/api/dev-login?email=YOUR_ADMIN_EMAIL&password=YOUR_PASSWORD&redirect=/admin`

`GET /api/dev-login` returns **404** when `APP_ENV` is staging/production, when `IS_E2E=1` (Playwright), or when `APP_ENV` is not `local`. Re-scaffold after auth changes: `npx skills add pbakaus/burn-after-login`.

## Git Commits

Conventional Commits: `type: summary` without scope. The summary should be a short, specific sentence that explains what changed and where or why, not a vague phrase. Types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`. `BREAKING CHANGE:` footer when needed.
For GitHub squash merges, use the PR title as the squash commit title and preserve GitHub's PR suffix, for example `feat: add payment onboarding (#123)`. Do not override the squash title with a plain sentence that drops the type or PR number.

## Env

All env vars validated in `Env.ts`; never read `process.env` directly.

## Styling

Tailwind v4 utility classes. Reuse shared components. Responsive. No unnecessary classes.

## React

- React Compiler is enabled for this codebase's style: do not add `useMemo`, `useCallback`, `React.memo`, or derived-state `useEffect` unless profiling or an external-system effect requires it.
- Treat `useEffect` as an escape hatch for synchronizing with external systems (browser APIs, subscriptions, third-party widgets, imperative SDKs). Do not use it for user events, data transformation, derived state, or server-loadable data; use event handlers, render-time calculation, RSC, or Server Actions instead.
- Single `props` param with inline type; access as `props.foo` (no destructuring).
- Use `React.ReactNode`, not `ReactNode`.
- Inline short event handlers; extract only when complex.
- Do not use `React.cloneElement` to inject form or accessibility props. Put `id`, `required`, `aria-required`, `aria-describedby`, and validation props directly on the actual control or redesign the component API.
- Prefer native form semantics first: back visual required markers with `required`/`aria-required` on the control when browser validation or assistive-tech announcement is expected; if the control cannot support native semantics, document the component API/accessibility reason.

## Next.js (Node server, not serverless)

- Production is **`output: 'standalone'`**; expect a **long-lived Node** process. Prefer RSC and server data access; do not use `runtime: 'edge'` for Prisma/pg routes.
- Prisma is a **singleton** per worker in [DB.ts](src/libs/DB.ts); size `pg` pool for dedicated Postgres, not serverless cold starts.
- Avoid app-wide `force-dynamic`; use segment `revalidate`, `cache()` / `unstable_cache`, `await connection()` when a route must bind to the request, and `revalidatePath` after Server Actions. See `.cursor/rules/nextjs-node-server-2026.mdc` for full guidance.
- Other Cursor rules: see **Token efficiency** (paths + globs).

## Pages

- Default export name ends with `Page`. Props alias (if reused) ends with `PageProps`.
- Locale pages: `props: { params: Promise<{ locale: string }> }` → `await props.params` → `setRequestLocale(locale)`.
- Escape glob chars in shell commands for Next.js paths.
- Dashboard pages (sit behind auth); define meta once in layout, not in each page.

## i18n (next-intl)

- Never hard-code user-visible strings. Page namespaces end with `Page`.
- Server: `getTranslations`; Client: `useTranslations`.
- Context-specific keys (`card_title`, `meta_description`). Use `t.rich(...)` for markup.
- Use sentence case for translations.
- Error messages: short, no "try again" variants.
- Single locale (`en`) with `localePrefix: 'never'`: locale never appears in public URLs (`/admin`, not `/en/admin`) unless product requirements add public locale prefixes. Keep `src/app/[locale]/`; see `.cursor/rules/next-intl-single-locale-routing.mdc`.
- `revalidatePath`, redirects, and links: `getI18nPath(path, locale)` from `@/utils/Helpers`, not `` `/${locale}${path}` ``.

## JSDoc

- Start each block with `/**` directly above the symbol.
- Short, sentence-case, present-tense description of intent.
- Order: description → `@param` → `@returns` → `@throws` (only if it can throw).

## Tests

- `*.test.ts` for unit tests; `*.spec.ts` for integration tests; `*.e2e.ts` for Playwright tests.
- `*.test.ts` co-located with implementation; `*.spec.ts` and `*.e2e.ts` in `tests/` directory.
- Top `describe` = subject; nested `describe` to group scenarios or contexts.
- `it` titles: short, lowercase verb phrase, `verb + object + context`, no period.
- Omit "should/works/handles/checks/validates". State what, not how.
- Avoid mocking unless necessary.
