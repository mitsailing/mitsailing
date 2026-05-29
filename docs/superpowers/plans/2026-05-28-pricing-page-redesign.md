# Pricing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/pricing` into a tabbed, pricing-page-style decision surface that helps users pick the right sailing card without reading policy paragraphs.

**Architecture:** The server page determines whether the visitor is signed in and passes one CTA model into the pricing UI. The pricing UI uses three status tabs (`MIT student`, `MIT Recreation member`, `No MIT Recreation`), plan cards for choices, and a compact paid-card table only inside the no-rec path. Copy stays in `src/locales/en.json`; the design source of truth is `docs/superpowers/specs/2026-05-28-pricing-page-redesign-design.md`.

**Tech Stack:** Next.js App Router, React, TypeScript, next-intl, Tailwind v4, existing `Button`, `Link`, and MIT Sailing token classes.

---

## Files

- Modify: `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`
  Server-side auth-aware CTA selection.
- Replace most of: `src/components/mit-sailing/pricing/PricingPageView.tsx`
  Page composition, plan cards, status tabs, paid-card table.
- Modify: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`
  Tests for tabs, labels, paid chart, no Mashnee, guest/signed-in CTAs.
- Modify: `src/locales/en.json`
  New pricing copy; remove pricing-page Mashnee copy.
- Modify: `src/data/mit-sailing/cmsSeed.ts`
  Home pricing card links should create account where appropriate, not jump guests directly to onboarding.
- Modify: `src/data/mit-sailing/cmsSeed.test.ts`
  Assert home pricing CTA URLs.
- Modify: `src/components/mit-sailing/about/AboutPageView.test.tsx`
  Repair current test drift from the earlier `<dl>` polish change.

## Task 1: Repair Current Test Drift

**Files:**
- Modify: `src/components/mit-sailing/about/AboutPageView.test.tsx`

- [ ] **Step 1: Update the failing About test assertion**

Replace the `term` role assertion with text assertions. React Testing Library exposes `<dt>` as `term`, but the current test environment reports empty accessible names for these terms, so the role-name assertion is brittle and not relevant to the pricing redesign.

```tsx
expect(screen.getByText('Full sailing membership')).toBeInTheDocument();
expect(
  screen.getByText(/Pavilion sailing, classes, ratings/u)
).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused About test**

Run:

```bash
npm run test -- src/components/mit-sailing/about/AboutPageView.test.tsx
```

Expected: PASS.

## Task 2: Make Pricing CTA Auth-Aware

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`
- Modify: `src/components/mit-sailing/pricing/PricingPageView.tsx`
- Test: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`

- [ ] **Step 1: Write failing CTA tests**

Change the render helper to accept signed-in state:

```tsx
function renderPricingPage(options?: { readonly isSignedIn?: boolean }) {
  render(<PricingPageView isSignedIn={options?.isSignedIn ?? false} />);
}
```

Add tests:

```tsx
it('sends guests to sign up before onboarding', () => {
  renderPricingPage();

  expect(screen.getAllByRole('link', { name: 'Create account' }).at(0)).toHaveAttribute(
    'href',
    '/signup?callbackUrl=%2Fonboarding'
  );
});

it('sends signed-in users directly to onboarding', () => {
  renderPricingPage({ isSignedIn: true });

  expect(screen.getAllByRole('link', { name: 'Start sailing card' }).at(0)).toHaveAttribute(
    'href',
    '/onboarding'
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: FAIL because `PricingPageView` has no `isSignedIn` prop and still renders `Request a sailing card`.

- [ ] **Step 3: Add CTA props in `PricingPageView`**

Use this prop shape:

```tsx
type PricingPageViewProps = {
  readonly isSignedIn: boolean;
};

function pricingPrimaryCta(props: PricingPageViewProps) {
  if (props.isSignedIn) {
    return {
      href: '/onboarding',
      labelKey: 'cta_start_sailing_card',
    } as const;
  }

  return {
    href: '/signup?callbackUrl=%2Fonboarding',
    labelKey: 'cta_create_account',
  } as const;
}

export function PricingPageView(props: PricingPageViewProps) {
  const t = useTranslations('PricingPage');
  const primaryCta = pricingPrimaryCta(props);
  // render `t(primaryCta.labelKey)` and `primaryCta.href`
}
```

- [ ] **Step 4: Make the server page pass auth state**

In `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`, import `getCurrentUser` and pass the boolean:

```tsx
import { getCurrentUser } from '@/libs/auth/dal';

export default async function PricingPage(props: PricingPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [t, currentUser] = await Promise.all([
    getTranslations({ locale, namespace: 'PricingPage' }),
    getCurrentUser(),
  ]);

  return (
    <SiteSectionShell locale={locale} segments={[{ label: t('breadcrumb') }]}>
      <PricingPageView isSignedIn={Boolean(currentUser)} />
    </SiteSectionShell>
  );
}
```

- [ ] **Step 5: Add translation keys**

In `PricingPage` locale:

```json
"cta_create_account": "Create account",
"cta_start_sailing_card": "Start sailing card"
```

- [ ] **Step 6: Run focused pricing tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: CTA tests pass after the rest of the page is rebuilt in later tasks.

## Task 3: Replace Paragraph-First Pricing with Three Status Tabs

**Files:**
- Modify: `src/components/mit-sailing/pricing/PricingPageView.tsx`
- Modify: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing tab tests**

Add:

```tsx
it('renders three status tabs only', () => {
  renderPricingPage();

  expect(screen.getByRole('tab', { name: 'MIT student' })).toBeInTheDocument();
  expect(
    screen.getByRole('tab', { name: 'MIT Recreation member' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('tab', { name: 'No MIT Recreation' })
  ).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /under 30/u })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /30\+/u })).not.toBeInTheDocument();
});
```

Also add the banned-content assertion:

```tsx
it('keeps Mashnee off the pricing page', () => {
  renderPricingPage();

  expect(screen.queryByText(/Mashnee/u)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement tab state**

Keep the component simple. `PricingPageView.tsx` can become a client component if necessary:

```tsx
'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
```

Use a local union:

```tsx
type PricingStatus = 'mit-student' | 'mit-recreation' | 'no-recreation';

const pricingStatuses: readonly PricingStatus[] = [
  'mit-student',
  'mit-recreation',
  'no-recreation',
];
```

Render buttons with tab roles:

```tsx
<div aria-label={t('status_tabs_label')} className="grid gap-2 rounded-lg border border-mit-line bg-card p-1 sm:grid-cols-3" role="tablist">
  {pricingStatuses.map((status) => (
    <button
      aria-selected={selectedStatus === status}
      className={cn(
        'min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        selectedStatus === status
          ? 'bg-mit-red text-white'
          : 'text-mit-text hover:bg-mit-red-highlight'
      )}
      key={status}
      onClick={() => setSelectedStatus(status)}
      role="tab"
      type="button"
    >
      {t(`status_${status}`)}
    </button>
  ))}
</div>
```

Use actual keys instead of template strings if TypeScript does not narrow them cleanly.

- [ ] **Step 3: Replace hero copy**

Use:

```text
Sailing card pricing
Choose your status. Prices update below.
```

Remove the long `description` paragraph from the hero.

- [ ] **Step 4: Run focused pricing tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: tab tests pass after plan cards are implemented in Task 4.

## Task 4: Implement Status-Specific Plan Cards

**Files:**
- Modify: `src/components/mit-sailing/pricing/PricingPageView.tsx`
- Modify: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write tests for included-status tabs**

Add tests that click each tab:

```tsx
it('shows full sailing included for MIT students', async () => {
  renderPricingPage();

  expect(screen.getByRole('heading', { name: 'Full sailing' })).toBeInTheDocument();
  expect(screen.getByText('Included')).toBeInTheDocument();
  expect(screen.getByText('Covered by Full sailing')).toBeInTheDocument();
});

it('shows full sailing included for MIT Recreation members', async () => {
  renderPricingPage();
  await userEvent.click(screen.getByRole('tab', { name: 'MIT Recreation member' }));

  expect(screen.getByRole('heading', { name: 'Full sailing' })).toBeInTheDocument();
  expect(screen.getByText('For active MIT Recreation members.')).toBeInTheDocument();
  expect(screen.getAllByText('Covered by Full sailing').length).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Add `PricingPlanCard` helper**

Implement:

```tsx
function PricingPlanCard(props: {
  readonly title: string;
  readonly price: string;
  readonly body: string;
  readonly badge?: string;
  readonly cta?: {
    readonly href: string;
    readonly label: string;
  };
  readonly secondary?: boolean;
}) {
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-lg border p-5',
        props.secondary
          ? 'border-mit-line bg-mit-surface'
          : 'border-mit-red bg-card'
      )}
    >
      {props.badge ? (
        <p className="mb-3 text-xs font-semibold text-mit-red dark:text-mit-red-ink">
          {props.badge}
        </p>
      ) : null}
      <h2 className="text-lg font-semibold text-mit-text">{props.title}</h2>
      <p className="mt-2 text-2xl font-semibold text-mit-text">{props.price}</p>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
        {props.body}
      </p>
      {props.cta ? (
        <Button asChild className="mt-5" variant="mit">
          <Link href={props.cta.href}>
            {props.cta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 3: Render included-status cards**

For `MIT student` and `MIT Recreation member`, render a 1-column recommended Full sailing card followed by two subdued included cards:

```tsx
<div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
  <PricingPlanCard ... />
  <div className="grid gap-4">
    <PricingPlanCard secondary title={t('plan_pavilion_racing')} price={t('covered_by_full')} ... />
    <PricingPlanCard secondary title={t('plan_thursday_team_racing')} price={t('covered_by_full')} ... />
  </div>
</div>
```

- [ ] **Step 4: Run focused pricing tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: included-status tests pass.

## Task 5: Implement the No MIT Recreation Paid Path

**Files:**
- Modify: `src/components/mit-sailing/pricing/PricingPageView.tsx`
- Modify: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write tests for paid path**

Add:

```tsx
it('shows paid cards and non-rec price categories only', async () => {
  renderPricingPage();
  await userEvent.click(screen.getByRole('tab', { name: 'No MIT Recreation' }));

  expect(screen.getByRole('heading', { name: 'Pavilion racing' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thursday team racing' })).toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Paid-card prices' })).toBeInTheDocument();

  const table = screen.getByRole('table', { name: 'Paid-card prices' });
  expect(within(table).getByRole('columnheader', { name: 'Non-MIT student' })).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: 'Non-student under 30' })
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: 'Non-student 30+' })
  ).toBeInTheDocument();
  expect(within(table).queryByRole('columnheader', { name: 'MIT student' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add paid plan cards**

Render:

```tsx
<div className="grid gap-4 md:grid-cols-2">
  <PricingPlanCard
    body={t('pavilion_racing_body')}
    price={t('pavilion_racing_price')}
    title={t('plan_pavilion_racing')}
  />
  <PricingPlanCard
    body={t('thursday_team_racing_body')}
    price={t('thursday_team_racing_price')}
    title={t('plan_thursday_team_racing')}
  />
</div>
```

- [ ] **Step 3: Add exact paid-card table**

Use a table with no MIT-student column:

```tsx
function PaidCardPriceTable() {
  const t = useTranslations('PricingPage');
  const rows = [
    {
      label: t('paid_table_pavilion_before_july_15'),
      nonMitStudent: t('paid_table_pavilion_before_july_15_student'),
      under30: t('paid_table_pavilion_before_july_15_under_30'),
      thirtyPlus: t('paid_table_pavilion_before_july_15_30_plus'),
    },
    {
      label: t('paid_table_pavilion_july_15_later'),
      nonMitStudent: t('paid_table_pavilion_july_15_later_student'),
      under30: t('paid_table_pavilion_july_15_later_under_30'),
      thirtyPlus: t('paid_table_pavilion_july_15_later_30_plus'),
    },
    {
      label: t('paid_table_thursday_team_racing'),
      nonMitStudent: t('paid_table_thursday_team_racing_student'),
      under30: t('paid_table_thursday_team_racing_under_30'),
      thirtyPlus: t('paid_table_thursday_team_racing_30_plus'),
    },
  ] as const;

  return (
    <div className="overflow-x-auto rounded-lg border border-mit-line">
      <table aria-label={t('paid_table_label')} className="w-full min-w-[42rem] text-left text-sm">
        ...
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Add MIT Recreation upsell as secondary row**

Below the table:

```tsx
<div className="rounded-lg border border-mit-line bg-card p-5">
  <h2 className="text-base font-semibold text-mit-text">{t('want_full_sailing_heading')}</h2>
  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('want_full_sailing_body')}</p>
  <Button asChild className="mt-4" variant="outline">
    <a href={mitRecreationRatesHref} rel="noreferrer" target="_blank">
      {t('mit_recreation_rates_link')}
    </a>
  </Button>
</div>
```

- [ ] **Step 5: Run focused pricing tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: paid-path tests pass.

## Task 6: Update Home Pricing CTAs

**Files:**
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/data/mit-sailing/cmsSeed.test.ts`

- [ ] **Step 1: Write/adjust CMS seed tests**

Update expectations so home pricing cards do not send guests straight to onboarding:

```ts
expect(pricing?.plans[0]).toMatchObject({
  highlighted: true,
  linkUrl: '/signup',
  price: 'Included with MIT student or MIT Recreation status',
});
expect(pricing?.plans[1]).toMatchObject({
  linkUrl: '/pricing',
  price: '$25-$175',
});
expect(pricing?.plans[2]).toMatchObject({
  linkUrl: '/pricing',
  price: '$25-$100',
});
```

- [ ] **Step 2: Update `cmsSeed.ts`**

Change the highlighted Full sailing plan:

```ts
linkLabel: 'Create account',
linkUrl: '/signup',
```

Keep paid racing cards pointing to `/pricing`.

- [ ] **Step 3: Run CMS seed tests**

Run:

```bash
npm run test -- src/data/mit-sailing/cmsSeed.test.ts
```

Expected: PASS.

## Task 7: Remove Pricing-Page Mashnee Copy

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`

- [ ] **Step 1: Remove or stop using old pricing keys**

Do not render these old strings on `/pricing`:

```json
"description": "... Mashnee ...",
"full_body": "... Mashnee ...",
"mit_recreation_rule": "... Mashnee ..."
```

Either delete unused keys or replace them with the new short copy required by the spec.

- [ ] **Step 2: Verify no Mashnee on pricing**

Run:

```bash
rg -n "Mashnee" src/components/mit-sailing/pricing src/locales/en.json
```

Expected: no `PricingPage` keys rendered by `/pricing` contain Mashnee. Mashnee may remain in onboarding/about/docs where already scoped.

- [ ] **Step 3: Run pricing tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: PASS.

## Task 8: Verify and Audit

**Files:**
- No code changes unless verification finds defects.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx src/components/mit-sailing/about/AboutPageView.test.tsx src/data/mit-sailing/cmsSeed.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run i18n and type checks**

Run:

```bash
npm run check:i18n
npm run check:types
```

Expected: both PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS. If formatting fails, use the repo's formatter command pattern already used in this worktree:

```bash
npm exec -- ultracite fix src/components/mit-sailing/pricing/PricingPageView.tsx src/components/mit-sailing/pricing/PricingPageView.test.tsx --type-aware --type-check
```

- [ ] **Step 4: Run Impeccable detector**

Run:

```bash
npx impeccable detect --json src/components/mit-sailing/pricing/PricingPageView.tsx src/components/mit-sailing/cms/CmsPricingBlock.tsx
```

Expected: `[]`.

- [ ] **Step 5: Browser review**

Start the app if no server is running:

```bash
npm run build-local
```

Then inspect `/pricing` in desktop and mobile widths. Confirm:

- Status tabs are the first meaningful interaction after the hero.
- Primary choice cards are visible without reading paragraph copy.
- `No MIT Recreation` shows `Non-MIT student`, `Non-student under 30`, and `Non-student 30+`.
- No Mashnee appears on `/pricing`.
- Guest CTA goes to signup; signed-in CTA goes to onboarding.

## Self-Review

- Spec coverage: This plan implements every requirement in `docs/superpowers/specs/2026-05-28-pricing-page-redesign-design.md`.
- Placeholder scan: No `TBD`, `TODO`, or unspecified test commands remain.
- Type consistency: `PricingPageView` receives `isSignedIn`; CTA labels come from `PricingPage` translation keys; tab statuses use a local `PricingStatus` union.
