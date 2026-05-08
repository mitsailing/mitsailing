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
- **Cursor rules** attach by **glob** (see each `.mdc` frontmatter). **Cite** paths instead of pasting long policy. **`@tdd`** for strict test-first without repeating prompts.
- **Which rule:** `nextjs-node-server-2026.mdc` (Next caching/DB/runtime, `src/app` + `src/libs`). `e2e-verification.mdc` (when `test:e2e` counts as done). `tdd.mdc` (Vitest/Playwright, `tests/**` + co-located `*.test.*`). `agent-workflow.mdc` (workflow + stale APIs, `src/**`).

## Commands
Only these `npm run` scripts: `build-local`, `lint`, `check:types`, `check:deps`, `check:i18n`, `test`, `test:e2e`.

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
- Avoid app-wide `force-dynamic`; use segment `revalidate`, `cache()` / `unstable_cache`, and `revalidatePath` after Server Actions. See `.cursor/rules/nextjs-node-server-2026.mdc` for full guidance.
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

## JSDoc
- Start each block with `/**` directly above the symbol.
- Short, sentence-case, present-tense description of intent.
- Order: description → `@param` → `@returns` → `@throws` (only if it can throw).

## Tests
- `*.test.ts` for unit tests; `*.spec.ts` for integration tests; `*.e2e.ts` for Playwright tests.
- `*.test.ts` co-located with implementation; `*.spec.ts` and `*.e2e.ts` in `tests/` directory.
- Top `describe` = subject; nested `describe` to group scenarios or contexts.
- `it` titles: short, third-person present, `verb + object + context`. Sentence case, no period.
- Omit "should/works/handles/checks/validates". State what, not how.
- Avoid mocking unless necessary.
