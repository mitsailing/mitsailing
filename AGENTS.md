# AGENTS

## Principles

- Clarity and consistency over cleverness. Minimal changes. Match existing patterns.
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

## Token efficiency

- Skip recaps unless the result is ambiguous or you need more input.
- **Cursor rules** ([Cursor docs](https://cursor.com/docs/rules)): keep each `.mdc` **focused, actionable, well-scoped** — **reference** code or docs instead of duplicating prose (official guidance allows up to **500 lines per rule**; stay **well below** that). Prefer **`globs` + `alwaysApply: false`**; use **`alwaysApply: true`** only for short universal policy. **Cite** `.cursor/rules/…` paths; do not paste full rule bodies (including in **sub-agent** prompts). **`@tdd`** for strict test-first.
- **Which rule:** `.coderabbit.yaml` (CodeRabbit on PRs) + `coderabbit-review.mdc` (same expectations for local agents / `cr review`). `nextjs-node-server-2026.mdc` (Next cache/DB/runtime, `src/app` + `src/libs`). `e2e-verification.mdc` (`test:e2e` gate). `dev-browser-auth.mdc` (local `/api/dev-login` for Cursor browser agents only). `tdd.mdc` (`tests/**`, `*.test.*`). `agent-workflow.mdc` (inspect-first, `src/**`). `ada-color-accessibility.mdc` (UI contrast/tokens). `app-design-tokens-colors.mdc` + `mit-red-ink-usage.mdc` (MIT red text utilities). `dates-us-eastern.mdc` (venue US Eastern; `I18n.ts` `timeZone`). `mitsailing-single-tenant-chrome.mdc` (chrome copy).
- **Prod → local DB:** `.cursor/skills/pgsync-prod-to-local/SKILL.md` (`.pgsync.yml`, optional `PGSYNC_FROM_URL` in `.env`).

## Commands

Only these `npm run` scripts: `build-local`, `lint`, `check:types`, `check:deps`, `check:i18n`, `test`, `test:coverage`, `test:e2e`.

## Dev authentication (browser agents)

For **Cursor browser MCP** or manual agent browsing on **`npm run dev`** only — not a substitute for claiming `npm run test:e2e` complete, and **not** for specs that assert `/login`, sign-up, or email/password UI (those stay on real forms; see `tests/e2e/Auth.e2e.ts` and `tests/helpers/e2e-admin-sign-in.ts`).

1. Run `npm run db:seed` with your `.env` `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Open (replace with your seeded credentials):

   `http://localhost:3000/api/dev-login?email=YOUR_ADMIN_EMAIL&password=YOUR_PASSWORD&redirect=/admin`

`GET /api/dev-login` returns **404** when `APP_ENV` is staging/production, when `IS_E2E=1` (Playwright), or when `APP_ENV` is not `local`. Re-scaffold after auth changes: `npx skills add pbakaus/burn-after-login`.

## Git Commits

Conventional Commits: `type: summary` without scope. The summary should be a short, specific sentence that explains what changed and where or why, not a vague phrase. Types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`. `BREAKING CHANGE:` footer when needed.

## Env

All env vars validated in `Env.ts`; never read `process.env` directly.

## Styling

Tailwind v4 utility classes. Reuse shared components. Responsive. No unnecessary classes.

## React

- No `useMemo`/`useCallback` (React compiler handles it). Avoid `useEffect`.
- Single `props` param with inline type; access as `props.foo` (no destructuring).
- Use `React.ReactNode`, not `ReactNode`.
- Inline short event handlers; extract only when complex.

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
- Single locale (`en`) with `localePrefix: 'never'`: locale never appears in public URLs (`/admin`, not `/en/admin`). Keep `src/app/[locale]/`; see `.cursor/rules/next-intl-single-locale-routing.mdc`.
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
