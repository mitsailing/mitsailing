# Storybook (MIT Sailing marketing UI)

Runs with `@storybook/nextjs-vite` against the App Router codebase. **URLs and nesting stay in [`src/app/`](src/app/)** (`layout.tsx`); Storybook exercises **localized presentation** (`SiteSectionBreadcrumbs`, optional stacked chrome previews).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run storybook` | Dev server at port **6006** |
| `npm run build-storybook` | Static output to `storybook-static/` (gitignored) |
| `npm run storybook:test` | Vitest + Playwright/Chromium via `@storybook/addon-vitest` |

**CI:** `.github/workflows/CI.yml` includes a **`storybook`** job that runs `npm run storybook:test` inside the Playwright Docker image.

## Intl and styling

- [`StorybookIntlRoot.tsx`](StorybookIntlRoot.tsx) wraps the preview canvas with `NextIntlClientProvider` **`locale="en"`** and messages from [`src/locales/en.json`](../src/locales/en.json). Stories can use **`useTranslations`** (client hooks) aligned with prod namespaces (`MitSailingRoutes`, `MitSailingSite`, …).
- Global Tailwind/CSS is chained through [`src/styles/storybook-tailwind-anchor.ts`](../src/styles/storybook-tailwind-anchor.ts). Importing `.css` **directly** under `.storybook/` tripped **TS2882** under Ultracite; the shim keeps one normal TypeScript resolution path (`../src/...`).
- **`global.d.ts`** at the repo root declares `*.css` for TypeScript elsewhere (Next imports).

## Adding stories

- Co-locate **`*.stories.tsx`** next to components (see [`Marketing/SectionShell`](../src/components/mit-sailing/SiteSectionShell.stories.tsx)).
- Use **`title`** prefixes to group catalog: **`Marketing/…`**, **`Auth/…`**, **`UI/…`** (matches existing Button).
- Prefer **thin presentational** pieces [`SiteSectionBreadcrumbs`](../src/components/mit-sailing/SiteSectionBreadcrumbs.tsx); avoid pasting **`layout.tsx`** or async server shells unless you accept mocks and drift (see **`Marketing/SiteShell`** stacked preview).

## App Router alignment (short)

Nested **`layout.tsx`** files remain the canonical shell. Storybook validates **looks and accessibility**; it does not replace **`page.tsx`** / **`layout.tsx`** routing. See Next.js [**Layouts and Templates**](https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates) and [**Server Components**](https://nextjs.org/docs/app/building-your-application/rendering/server-components).

In production, section routes compose **`SiteSectionShell`** (breadcrumbs) with **`SiteSectionMain`** ([`SiteSectionMain.tsx`](../src/components/mit-sailing/SiteSectionMain.tsx)) for shared **`max-w-*`**, **`px-6`**, and vertical rhythm (Tailwind [spacing scale](https://tailwindcss.com/docs/padding))). Stories may show breadcrumbs alone (`SiteSectionShell` stories) or skip `SiteSectionMain` when not relevant.
