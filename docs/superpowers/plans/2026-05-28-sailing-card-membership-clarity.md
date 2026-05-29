# Sailing Card Membership Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sailing-card membership choices understandable at the exact signup decision point, explain the same model on the home/About/pricing pages, and document the domain rules so future developers do not confuse racing membership, Thursday team racing, and college sailing-team eligibility.

**Architecture:** Keep the existing `SailingCardType` enum values because they are already wired through onboarding and admin records, but stop exposing legacy/internal labels directly to users. Put the highest-value comparison inside onboarding, where affiliation and date of birth can produce accurate prices; use the home page for a compact public comparison; use `/pricing` as the canonical full explainer; add developer documentation that distinguishes user-facing labels from internal enum names and old WordPress behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, Tailwind v4, Vitest/Testing Library, Playwright only if the final UI needs e2e confirmation.

---

## Domain Decisions

The current user-facing labels must be consistent:

- `Normal` is the approved user-facing label for the general sailing-card type.
- `Pavilion racing` must be described clearly because it excludes Mashnee and means MIT evening racing/race classes at the Pavilion.
- `Team racing` is misleading because even a developer read it as college-team membership. Legacy WordPress shows it meant summer Thursday team racing, not being on the MIT or Northeastern college team.

Use this vocabulary in user-facing product UI:

| Internal enum | User-facing label | Compact detail | Badge examples |
|---|---|---|---|
| `normal` | `Normal` | `Pavilion, classes, ratings, and Mashnee.` | `Included` |
| `racing` | `Pavilion racing` | `MIT evening racing and race classes at the Pavilion. No Mashnee.` | `$25`, `$70`, `$100`, `$125`, `$175` |
| `team_racing` | `Thursday team racing` | `Thursday night team Pavilion racing only. No Mashnee. Not MIT Sailing Team.` | `$25`, `$70`, `$100`, `Summer only` |

Free Normal eligibility must always be presented in this order:

1. MIT students get Normal included.
2. MIT Recreation members get Normal included.
3. Users who are not eligible for included Normal can still choose paid Pavilion-racing or Thursday-team-racing cards.

Do not use `College team racing membership` for the current product. That is a different concept. College sailing-team status should be handled as eligibility/affiliation copy, not as the `team_racing` card type.

## Legacy Facts To Preserve

Source files:

- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/racing/team.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/includes/user.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/account.php`

Legacy behavior:

- `Team Racing` was a summer-only recreational team racing card.
- Public copy said it was for Thursday team racing, and users were only allowed to race in that Thursday team Pavilion racing.
- It had pricing: non-MIT/high-school/college student `$25`, under 30 `$70`, 30-plus `$100`.
- Regular racing pricing was spring `$25/$70/$100` before July 15 and full-year `$40/$125/$175` after July 15.
- MIT students did not pay for sailing cards and were told to get a normal card free.

## Signup UX Principles

External references used for this plan:

- [Amazon Subscribe & Save overview](https://www.aboutamazon.com/news/retail/how-you-can-save-time-and-money-with-amazon-subscribe-save): shows the subscribe choice near purchase, gives advance reminders before recurring charges, and keeps subscription management discoverable.
- [Baymard subscription UX research](https://baymard.com/blog/new-research-consumables-subscription-services): users distrust subscription flows when pricing is hard to find before checkout.

Apply these eleven principles:

1. Show the comparison before the user submits onboarding, not only on a separate page.
2. Let the user compare membership types with prices calculated from their affiliation and date of birth.
3. Show free Normal eligibility in the right order: MIT students, then MIT Recreation members.
4. Make the no-MIT-Recreation path positive: if the user is not eligible for free Normal and does not plan to buy MIT Recreation, show Pavilion-racing and Thursday-team-racing as available choices.
5. Use one clear “today” price on each option, with later renewal copy only when subscription checkout is implemented.
6. Keep the primary labels short, but use one compact detail line per option so the user knows what is included.
7. Do not hide price behind FAQ text, helper text, or a later payment step.
8. Use badges for fast scanning: `Included`, `$70 today`, `Needs MIT Recreation`, `Thursday series`.
9. Keep one obvious next action after the user selects an option.
10. Explain why date of birth is needed before price calculation, because age changes racing and team-racing prices.
11. Keep cancellation and renewal expectations adjacent to paid subscription checkout when the billing PR adds auto-renew.

## File Structure

- Modify `src/locales/en.json`: all public copy and test assertions.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx`: keep compact option cards, add an in-flow comparison/price section, add a membership-details link, and ensure the new labels/descriptions render in the radio group.
- Modify `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`: prove the approved labels are accessible.
- Create `src/components/mit-sailing/pricing/PricingPageView.tsx`: public pricing explainer.
- Create `src/components/mit-sailing/pricing/PricingPageView.test.tsx`: page-level copy and link tests.
- Create `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`: static public route.
- Create `src/app/[locale]/(marketing)/(site)/pricing/pricingPage.test.tsx`: route metadata/page shell test if existing app-page tests make this straightforward.
- Modify `src/components/mit-sailing/home/MitSailingHomePageView.tsx` and tests if the seeded pricing block cannot express a clear pricing comparison by itself.
- Modify `src/components/mit-sailing/about/AboutPageView.tsx`: add a compact “Pricing” section or callout linking to `/pricing`.
- Modify `src/components/mit-sailing/about/AboutPageView.test.tsx` if present; otherwise add focused assertions to existing about page tests under `src/app/[locale]/(marketing)/(site)/about`.
- Modify `src/data/mit-sailing/footerNavSeed.ts`: point `footer_link_membership` to `/pricing`.
- Modify `src/data/mit-sailing/cmsSeed.ts`: keep home pricing aligned with the public pricing page and avoid implying racing/team-racing are college-team status.
- Run a site-wide copy audit across `src/locales/en.json`, `src/components/mit-sailing`, `src/app/[locale]/(marketing)/(site)`, and seeded public CMS data so membership option copy consistently uses `Normal`, `Pavilion racing`, and `Thursday team racing`.
- Create `docs/mit-sailing/sailing-card-memberships.md`: developer-facing source of truth for card types, pricing, and legacy terminology.
- Modify `README.md`: link the developer doc from a short “Product domain docs” section.

## Task 1: Write Developer Source Of Truth

**Files:**
- Create: `docs/mit-sailing/sailing-card-memberships.md`
- Modify: `README.md`

- [ ] **Step 1: Create the docs directory if needed**

Run:

```shell
mkdir -p docs/mit-sailing
```

Expected: command exits with status `0`.

- [ ] **Step 2: Add the membership documentation**

Create `docs/mit-sailing/sailing-card-memberships.md` with this content:

```markdown
# Sailing Card Memberships

This document is the product-domain source of truth for sailing-card membership labels, access, and pricing rules. Keep it in sync with onboarding copy, the public pricing page, and membership billing changes.

## User-facing card types

| Internal value | User-facing label | Meaning |
|---|---|---|
| `normal` | Normal | General MITNA sailing membership with Pavilion access, classes, ratings, and Mashnee access when the sailor has the required rating/approval. |
| `racing` | Pavilion racing | MIT evening racing and race-related classes at the Sailing Pavilion. This does not include Mashnee. |
| `team_racing` | Thursday team racing | Thursday night team Pavilion racing only. No Mashnee. This is not MIT Sailing Team membership. |

The internal enum names are legacy storage names. Do not use `normal`, `racing`, or `team racing` alone as the primary onboarding labels.

## Pricing model

Normal is included for eligible users. Always list MIT students first and MIT Recreation members second:

1. MIT students.
2. MIT Recreation members.

Pavilion racing uses the racing-card pricing model:

| Timing | Non-MIT student | Under 30 | 30-plus |
|---|---:|---:|---:|
| Spring, before July 15 | $25 | $70 | $100 |
| Full year, July 15 or later | $40 | $125 | $175 |

Thursday team racing uses the summer-only team-racing pricing model:

| Timing | Non-MIT student | Under 30 | 30-plus |
|---|---:|---:|---:|
| Any date | $25 | $70 | $100 |

MIT students do not pay for sailing cards. They should use Normal unless a staff-controlled future flow explicitly introduces another verified team status.

## Legacy WordPress behavior

The old WordPress site used `Normal`, `Racing`, and `Team Racing` in account forms. `Normal` remains the approved modern label; bare `Racing` and `Team Racing` need clearer product copy.

`Team Racing` in legacy WordPress meant summer recreational team racing, not membership on the MIT or Northeastern college sailing team. The old public page described it as Thursday summer team racing and said the team-racing card only allowed racing in that Thursday team Pavilion racing.

Relevant legacy files:

- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/racing/team.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/includes/user.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/account.php`

## Copy rules

- Onboarding labels must be short and disambiguating.
- Onboarding must show a comparison with exact prices once affiliation and date of birth are known.
- If a non-MIT user is not getting MIT Recreation membership, do not leave them at a dead end. Make the Pavilion-racing and Thursday-team-racing options visible as the available paid paths.
- Public pages can explain the differences with tables and short paragraphs.
- Admin views may show internal values, but member-facing UI should use the user-facing labels above.
- Do not introduce `college team racing membership` unless the data model changes to represent verified college sailing-team status separately from Thursday team racing.
```

- [ ] **Step 3: Link the document from README**

Add this section after the “Checks” section in `README.md`:

```markdown
## Product Domain Docs

- [docs/mit-sailing/sailing-card-memberships.md](docs/mit-sailing/sailing-card-memberships.md) - sailing-card membership labels, pricing rules, and legacy WordPress terminology.
```

- [ ] **Step 4: Verify the docs link**

Run:

```shell
rg -n "sailing-card-memberships" README.md docs/mit-sailing/sailing-card-memberships.md
```

Expected: both files are returned.

## Task 2: Fix Onboarding Labels And Add In-Flow Comparison

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`

- [ ] **Step 1: Write failing onboarding copy tests**

In `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`, update the card-type test so it asserts the approved labels:

```ts
expect(
  cardTypeControls.getByRole('radio', { name: /Normal/u })
).toBeInTheDocument();
expect(
  cardTypeControls.getByRole('radio', { name: /Pavilion racing/u })
).toBeInTheDocument();
expect(
  cardTypeControls.getByRole('radio', { name: /Thursday team racing/u })
).toBeInTheDocument();
expect(screen.getByText('Normal')).toBeInTheDocument();
expect(screen.queryByText('Team racing')).not.toBeInTheDocument();
expect(
  screen.getByText(
    'MIT evening racing and race classes at the Pavilion. No Mashnee.'
  )
).toBeInTheDocument();
expect(
  screen.getByText(
    'Thursday night team Pavilion racing only. No Mashnee. Not MIT Sailing Team.'
  )
).toBeInTheDocument();
expect(
  screen.getByRole('heading', { name: 'Compare your options' })
).toBeInTheDocument();
```

Also update any existing expectations for `Normal`, `Pavilion racing`, and the current team-racing description.

- [ ] **Step 2: Run the failing onboarding test**

Run:

```shell
npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: FAIL before implementation because the current locale still uses stale card-type descriptions or a college-team-oriented team-racing description.

- [ ] **Step 3: Update locale copy**

In `src/locales/en.json`, replace the onboarding card-type keys with:

```json
"card_type_label": "Choose your sailing card",
"card_type_normal": "Normal",
"card_type_normal_description": "Included for MIT students and MIT Recreation members. Pavilion, classes, ratings, and Mashnee.",
"card_type_racing": "Pavilion racing",
"card_type_racing_description": "MIT evening racing and race classes at the Pavilion. No Mashnee.",
"card_type_racing_description_needs_dob": "Enter date of birth above to see the Pavilion racing price. MIT evening racing and race classes at the Pavilion. No Mashnee.",
"card_type_team_racing": "Thursday team racing",
"card_type_team_racing_description": "Thursday night team Pavilion racing only. No Mashnee. Not MIT Sailing Team.",
"card_type_details_link": "Compare membership options",
"card_type_comparison_heading": "Compare your options",
"card_type_comparison_help": "Prices update from your affiliation and date of birth.",
"card_type_no_fitness_path": "Not getting MIT Recreation? Pavilion racing and Thursday team racing stay available.",
"card_type_full_requires_fitness": "Needs MIT Recreation",
"card_type_available_today": "Available today",
"card_type_thursday_series": "Thursday series only",
"fitness_membership_help": "Answer No if you still need to sign up. You can continue with Normal.",
"fitness_membership_auto_mit_student": "MIT students meet the MIT Recreation requirement for Normal."
```

Keep the existing price keys.

- [ ] **Step 4: Add an onboarding comparison section**

In `SailingCardOnboardingCardRequestFields.tsx`, add a small comparison component near `CardTypeSelect`. It must use the existing `sailingCardMembershipPriceCents` helper so the prices match the selectable cards:

```tsx
function CardTypeComparison(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly dateOfBirthValue: string | undefined;
  readonly now: Date;
}) {
  const t = useTranslations('OnboardingPage');
  const rows = [
    {
      cardType: SailingCardType.normal,
      detail: t('card_type_normal_description'),
      marker: t('card_type_full_requires_fitness'),
    },
    {
      cardType: SailingCardType.racing,
      detail: t('card_type_racing_description', {
        price:
          formatMembershipPrice(
            sailingCardMembershipPriceCents({
              affiliation: props.affiliation,
              cardType: SailingCardType.racing,
              dateOfBirth: props.dateOfBirthValue,
              now: props.now,
            })
          ) ?? t('card_type_price_needs_dob'),
      }),
      marker: t('card_type_available_today'),
    },
    {
      cardType: SailingCardType.team_racing,
      detail: t('card_type_team_racing_description'),
      marker: t('card_type_thursday_series'),
    },
  ];

  return (
    <section
      aria-labelledby="sailing-card-membership-comparison"
      className="rounded-lg border border-mit-line bg-mit-surface p-4"
    >
      <h3
        className="text-sm font-semibold text-mit-text"
        id="sailing-card-membership-comparison"
      >
        {t('card_type_comparison_heading')}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {t('card_type_comparison_help')}
      </p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => {
          const priceCents = sailingCardMembershipPriceCents({
            affiliation: props.affiliation,
            cardType: row.cardType,
            dateOfBirth: props.dateOfBirthValue,
            now: props.now,
          });
          const price = formatMembershipPrice(priceCents);

          return (
            <div
              className="grid gap-1 rounded-md border border-mit-line bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={row.cardType}
            >
              <div>
                <p className="text-sm font-medium text-mit-text">
                  {t(cardTypeLabelKey(row.cardType))}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {row.detail}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="rounded-md bg-mit-red-highlight px-2 py-0.5 text-xs font-semibold text-mit-red dark:text-mit-red-ink">
                  {price ?? t('card_type_price_needs_dob')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.marker}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

Before implementing this exact shape, simplify duplicated price calculation if TypeScript flags it. Preserve the one-screen comparison and current helper function.

- [ ] **Step 5: Render comparison when card type choices are visible**

In `CardRequestSection`, render `CardTypeComparison` immediately before `CardTypeSelect` when `props.fitnessMembershipReady` is true:

```tsx
{props.fitnessMembershipReady ? (
  <CardTypeComparison
    affiliation={props.affiliation}
    dateOfBirthValue={props.dateOfBirthValue}
    now={props.now}
  />
) : null}
```

Also render this note when the user has answered `No` to MIT Recreation. If the current component does not receive the raw `hasFitnessMembership` value, add it to the section props from `SailingCardOnboardingFormModel`:

```tsx
<p className="text-xs leading-5 text-muted-foreground">
  {t('card_type_no_fitness_path')}
</p>
```

- [ ] **Step 6: Add a compact details link below the radio group**

In `CardTypeSelect`, after `<FieldError field="cardType" state={props.state} />`, add:

```tsx
<Link
  className={fitnessMembershipLinkClassName}
  href="/pricing"
>
  {t('card_type_details_link')}
</Link>
```

If the link spacing looks too strong, wrap it in a `text-xs leading-5` paragraph using existing muted/link classes.

- [ ] **Step 7: Add no-MIT-Fitness conversion-path test**

Add or update the test that answers `No` to the MIT Recreation question. Assert the comparison does not dead-end the user and shows the paid options:

```ts
expect(
  screen.getByText(
    'Not getting MIT Recreation? Pavilion racing and Thursday team racing stay available.'
  )
).toBeInTheDocument();
expect(
  screen.getByRole('radio', { name: /Pavilion racing/u })
).toBeInTheDocument();
expect(
  screen.getByRole('radio', { name: /Thursday team racing/u })
).toBeInTheDocument();
```

- [ ] **Step 8: Run the onboarding test**

Run:

```shell
npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
```

Expected: PASS.

## Task 3: Add The Public Pricing Page

**Files:**
- Create: `src/components/mit-sailing/pricing/PricingPageView.tsx`
- Create: `src/components/mit-sailing/pricing/PricingPageView.test.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add pricing page locale keys**

Add a `PricingPage` namespace to `src/locales/en.json`:

```json
"PricingPage": {
  "meta_title": "Pricing",
  "meta_description": "Compare MIT Sailing Normal, Pavilion racing membership, and Thursday team racing.",
  "title": "Pricing",
  "description": "Choose the card that matches the access you need. The names are intentionally specific because the racing options cover different programs.",
  "full_title": "Normal",
  "full_body": "Included for MIT students and MIT Recreation members. Pavilion access, classes, ratings, and Mashnee access when you have the required rating or approval.",
  "full_price": "Included for eligible members",
  "racing_title": "Pavilion racing",
  "racing_body": "MIT evening racing and race-related classes at the Pavilion. Mashnee is not included.",
  "racing_price": "$25 to $175 by season, student status, and age",
  "team_title": "Thursday team racing",
  "team_body": "Thursday night team Pavilion racing only. No Mashnee. This is not MIT Sailing Team membership.",
  "team_price": "$25 to $100 by student status and age",
  "pricing_heading": "Pricing",
  "pricing_full_label": "Normal",
  "pricing_full_value": "Included for MIT students and MIT Recreation members",
  "pricing_racing_spring": "Pavilion racing, spring before July 15",
  "pricing_racing_full": "Pavilion racing, full year July 15 or later",
  "pricing_team": "Thursday team racing",
  "pricing_student": "Non-MIT student",
  "pricing_under_30": "Under 30",
  "pricing_30_plus": "30-plus",
  "pricing_racing_spring_student": "$25",
  "pricing_racing_spring_under_30": "$70",
  "pricing_racing_spring_30_plus": "$100",
  "pricing_racing_full_student": "$40",
  "pricing_racing_full_under_30": "$125",
  "pricing_racing_full_30_plus": "$175",
  "pricing_team_student": "$25",
  "pricing_team_under_30": "$70",
  "pricing_team_30_plus": "$100",
  "mit_student_note": "MIT students and MIT Recreation members do not pay for Normal.",
  "onboarding_cta": "Request a sailing card"
}
```

- [ ] **Step 2: Write the page view test**

Create `src/components/mit-sailing/pricing/PricingPageView.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/en.json';
import { PricingPageView } from './PricingPageView';

describe('PricingPageView', () => {
  it('explains the three sailing card choices', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PricingPageView />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByRole('heading', { name: 'Pricing' })
    ).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Pavilion racing')).toBeInTheDocument();
    expect(screen.getByText('Thursday team racing')).toBeInTheDocument();
    expect(
      screen.getByText('This is not college sailing-team membership.', {
        exact: false,
      })
    ).toBeInTheDocument();
  });

  it('shows racing and Thursday team racing prices separately', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PricingPageView />
      </NextIntlClientProvider>
    );

    const table = screen.getByRole('table', { name: 'Pricing' });
    expect(
      within(table).getByRole('row', {
        name: /Pavilion racing, full year July 15 or later \$40 \$125 \$175/u,
      })
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', {
        name: /Thursday team racing \$25 \$70 \$100/u,
      })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the failing page view test**

Run:

```shell
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: FAIL because `PricingPageView` does not exist.

- [ ] **Step 4: Create the pricing page view**

Create `src/components/mit-sailing/pricing/PricingPageView.tsx` using `SectionHeader`, `Button`, `Link`, and existing MIT tokens. Keep the layout restrained:

```tsx
'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/mit-sailing/home/SectionHeader';
import { Link } from '@/libs/I18nNavigation';

const pageInnerClassName = 'mx-auto w-full max-w-5xl px-6';

function PricingSummary(props: {
  readonly title: string;
  readonly body: string;
  readonly price: string;
}) {
  return (
    <article className="rounded-lg border border-mit-line bg-card p-6">
      <h2 className="text-lg font-semibold text-mit-text">{props.title}</h2>
      <p className="mt-3 text-sm leading-6 text-mit-text">{props.body}</p>
      <p className="mt-5 text-sm font-semibold text-mit-red dark:text-mit-red-ink">
        {props.price}
      </p>
    </article>
  );
}

export function PricingPageView() {
  const t = useTranslations('PricingPage');

  const rows = [
    {
      label: t('pricing_racing_spring'),
      student: t('pricing_racing_spring_student'),
      under30: t('pricing_racing_spring_under_30'),
      thirtyPlus: t('pricing_racing_spring_30_plus'),
    },
    {
      label: t('pricing_racing_full'),
      student: t('pricing_racing_full_student'),
      under30: t('pricing_racing_full_under_30'),
      thirtyPlus: t('pricing_racing_full_30_plus'),
    },
    {
      label: t('pricing_team'),
      student: t('pricing_team_student'),
      under30: t('pricing_team_under_30'),
      thirtyPlus: t('pricing_team_30_plus'),
    },
  ];

  return (
    <div className="min-h-0 min-w-0">
      <section className="border-b border-mit-line bg-background py-16 md:py-20">
        <div className={pageInnerClassName}>
          <h1 className="max-w-3xl font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-mit-text">
            {t('description')}
          </p>
          <Button asChild className="mt-8" variant="mit">
            <Link href="/onboarding">
              {t('onboarding_cta')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-b border-mit-line bg-mit-surface py-14 md:py-18">
        <div className={`${pageInnerClassName} grid gap-4 md:grid-cols-3`}>
          <PricingSummary
            body={t('full_body')}
            price={t('full_price')}
            title={t('full_title')}
          />
          <PricingSummary
            body={t('racing_body')}
            price={t('racing_price')}
            title={t('racing_title')}
          />
          <PricingSummary
            body={t('team_body')}
            price={t('team_price')}
            title={t('team_title')}
          />
        </div>
      </section>

      <section className="bg-background py-14 md:py-18">
        <div className={pageInnerClassName}>
          <SectionHeader title={t('pricing_heading')} />
          <p className="mb-6 max-w-3xl text-sm leading-6 text-mit-text">
            {t('mit_student_note')}
          </p>
          <div className="overflow-x-auto rounded-lg border border-mit-line">
            <table aria-label={t('pricing_heading')} className="w-full min-w-160 text-left text-sm">
              <thead className="bg-mit-surface text-mit-text">
                <tr>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('pricing_heading')}
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('pricing_student')}
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('pricing_under_30')}
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    {t('pricing_30_plus')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mit-line bg-card text-mit-text">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th className="px-4 py-3 font-medium" scope="row">
                      {row.label}
                    </th>
                    <td className="px-4 py-3">{row.student}</td>
                    <td className="px-4 py-3">{row.under30}</td>
                    <td className="px-4 py-3">{row.thirtyPlus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
```

If `Button` does not support `asChild`, follow the repo's existing link-button pattern instead of adding a new component API.

- [ ] **Step 5: Add the route**

Create `src/app/[locale]/(marketing)/(site)/pricing/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PricingPageView } from '@/components/mit-sailing/pricing/PricingPageView';

type PricingPageProps = {
  readonly params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PricingPageProps) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'PricingPage' });

  return {
    description: t('meta_description'),
    title: t('meta_title'),
  };
}

export default async function PricingPage(props: PricingPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <PricingPageView />;
}
```

- [ ] **Step 6: Run the page view test**

Run:

```shell
npm run test -- src/components/mit-sailing/pricing/PricingPageView.test.tsx
```

Expected: PASS.

## Task 4: Add About-Page Entry Point

**Files:**
- Modify: `src/components/mit-sailing/about/AboutPageView.tsx`
- Modify or create focused about tests under `src/components/mit-sailing/about/` or `src/app/[locale]/(marketing)/(site)/about/`
- Modify: `src/locales/en.json` only if the About page is moved to translated copy in the same PR

- [ ] **Step 1: Write a failing About-page assertion**

Add a test assertion that the About page links to `/pricing` with the label `Pricing`.

If an About page test already renders `AboutPageView`, add:

```tsx
expect(
  screen.getByRole('link', { name: /Pricing/u })
).toHaveAttribute('href', '/pricing');
```

- [ ] **Step 2: Run the failing About test**

Run the focused About test file. If the only available coverage is app-level, run:

```shell
npm run test -- src/app/[locale]/(marketing)/(site)/about
```

Expected: FAIL because there is no pricing link.

- [ ] **Step 3: Add the About-page section**

In `AboutPageView`, add a compact section between mission and history:

```tsx
<section className="border-b border-mit-line bg-background py-14 md:py-18">
  <div className={aboutSectionInner}>
    <div className="max-w-3xl">
      <SectionHeader
        subtitle="Normal, Pavilion racing, and Thursday team racing are separate card choices."
        title="Pricing"
      />
      <p className="text-sm leading-6 text-mit-text">
        The pricing page explains what each sailing card includes, what the
        racing cards exclude, and how pricing changes by season, student status,
        and age.
      </p>
      <Link className={`mt-5 inline-flex items-center gap-1 ${accent}`} href="/pricing">
        Pricing
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  </div>
</section>
```

This is intentionally a short entry point. Keep the price table on `/pricing`, not on About.

- [ ] **Step 4: Run the About test**

Run the focused test from Step 2.

Expected: PASS.

## Task 5: Add Home-Page Membership Comparison And Footer Link

**Files:**
- Modify: `src/data/mit-sailing/footerNavSeed.ts`
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/components/mit-sailing/home/MitSailingHomePageView.test.tsx`
- Modify related CMS/footer tests if they assert old `#` pricing links or old pricing copy

- [ ] **Step 1: Write failing footer test or update existing footer assertion**

Find the footer test:

```shell
rg -n "footer_link_membership|Membership" src/components/mit-sailing/site src -S
```

Add or update the assertion so the Pricing footer link points to `/pricing`.

- [ ] **Step 2: Update footer nav**

In `src/data/mit-sailing/footerNavSeed.ts`, change:

```ts
{ labelKey: 'footer_link_membership', href: '#' },
```

to:

```ts
{ labelKey: 'footer_link_membership', to: '/pricing' },
```

- [ ] **Step 3: Write failing home comparison assertions**

In `src/components/mit-sailing/home/MitSailingHomePageView.test.tsx`, update the pricing block test so the home page compares membership types, not only audience categories:

```tsx
expect(screen.getByText('Normal')).toBeInTheDocument();
expect(screen.getByText('Pavilion racing')).toBeInTheDocument();
expect(screen.getByText('Thursday team racing')).toBeInTheDocument();
expect(
  screen.getByText('Thursday night team racing only. No Mashnee.', {
    exact: false,
  })
).toBeInTheDocument();
expect(
  screen.getByRole('link', { name: /See pricing/u })
).toHaveAttribute('href', '/pricing');
expect(screen.queryByText('Team Racing')).not.toBeInTheDocument();
```

- [ ] **Step 4: Update seeded home membership copy**

In `src/data/mit-sailing/cmsSeed.ts`, replace the home membership pricing block plans with pricing comparison cards. Keep the full price matrix on `/pricing`, but show enough pricing on the home page that a three-year member can understand the difference without digging.

Use this shape in the seeded `plans` array:

```ts
plans: [
  {
    title: 'Normal',
    description: 'Included for MIT students and MIT Recreation members',
    price: 'Included',
    frequency: 'when eligible',
    badge: 'Most common',
    highlighted: true,
    linkLabel: 'Request a card',
    linkUrl: '/onboarding',
    features: [
      'MIT students qualify automatically',
      'MIT Recreation members qualify',
      'Pavilion, classes, and ratings',
      'Mashnee access when approved',
    ],
  },
  {
    title: 'Pavilion racing',
    description: 'MIT evening racing and race classes',
    price: '$25 to $175',
    frequency: 'by season, student status, and age',
    linkLabel: 'See pricing',
    linkUrl: '/pricing',
    features: [
      'Does not include Mashnee',
      'Available when Normal is not the right fit',
      'Price changes after July 15',
    ],
  },
  {
    title: 'Thursday team racing',
    description: 'Thursday night team racing only. No Mashnee.',
    price: '$25 to $100',
    frequency: 'by student status and age',
    linkLabel: 'See pricing',
    linkUrl: '/pricing',
    features: [
      'Not MIT Sailing Team membership',
      'Limited to Thursday night team racing',
      'No Mashnee',
      'Same price schedule all season',
    ],
  },
]
```

Set the block footnote to:

```ts
footnote:
  'Prices depend on student status, age, date, and MIT Recreation eligibility. The onboarding form calculates your exact card price.',
```

Use these principles:

- Home page: quick pricing comparison, broad price ranges, and links to `/pricing`.
- Pricing page: precise card-type and pricing matrix.
- Onboarding: exact price comparison from the user's affiliation and date of birth.

If the current CMS pricing block keeps feature bullets, remove any wording that implies every plan has “Full access to all boats” when eligibility, ratings, or Mashnee approvals matter.

- [ ] **Step 5: Run relevant tests**

Run:

```shell
npm run test -- src/components/mit-sailing/site src/components/mit-sailing/home
```

Expected: PASS.

If this command is too broad or no matching tests are found by Vitest, run the specific test files identified in Step 1.

## Task 6: Site-Wide Membership Copy Audit

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/components/mit-sailing/**/*.tsx` only where membership-option copy appears
- Modify: `src/app/[locale]/(marketing)/(site)/**/*.tsx` only where membership-option copy appears
- Modify: `docs/mit-sailing/sailing-card-memberships.md`

- [ ] **Step 1: Search for obsolete membership labels in app copy**

Run:

```shell
rg -n "Normal|Pavilion racing|Summer team racing" src/locales/en.json src/components/mit-sailing 'src/app/[locale]/(marketing)/(site)' src/data/mit-sailing/cmsSeed.ts
```

Expected: FAIL before implementation because current onboarding tests and locale copy still mention stale labels or stale descriptions.

- [ ] **Step 2: Replace obsolete membership-option wording**

Replace only membership-option copy. Use these exact replacements:

```text
General sailing-card type -> Normal
Legacy racing label -> Pavilion racing
Summer team racing -> Thursday team racing
Team racing, when it means the card type -> Thursday team racing
```

Do not replace:

```text
Team Racing Chair
MITNA Team Racing, when it is a historic list/program title
legacy documentation that is explicitly describing old WordPress behavior
```

- [ ] **Step 3: Search for bare team-racing labels in member-facing app copy**

Run:

```shell
rg -n "\\bTeam racing\\b|\\bTeam Racing\\b" src/locales/en.json src/components/mit-sailing 'src/app/[locale]/(marketing)/(site)' src/data/mit-sailing/cmsSeed.ts
```

Expected: no matches for membership-option copy. If the command returns `Team Racing Chair` from MITNA history or another governance context, leave it unchanged and record it in the implementation summary as a non-membership use.

- [ ] **Step 4: Verify explicit Mashnee exclusions**

Run:

```shell
rg -n "Pavilion racing|Thursday team racing|No Mashnee|Mashnee is not included" src/locales/en.json src/components/mit-sailing src/data/mit-sailing/cmsSeed.ts docs/mit-sailing/sailing-card-memberships.md
```

Expected: the Pavilion-racing and Thursday-team-racing user-facing descriptions both have an explicit Mashnee exclusion. Normal may mention Mashnee as included when rating/approval requirements are met.

- [ ] **Step 5: Run focused copy tests**

Run:

```shell
npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/pricing/PricingPageView.test.tsx src/components/mit-sailing/home/MitSailingHomePageView.test.tsx
```

Expected: PASS.

## Task 7: Final Verification

**Files:**
- All files changed above

- [ ] **Step 1: Run targeted tests**

Run:

```shell
npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/pricing/PricingPageView.test.tsx src/components/mit-sailing/home/MitSailingHomePageView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run i18n checks**

Run:

```shell
npm run check:i18n
```

Expected: PASS.

- [ ] **Step 3: Run lint and type checks**

Run:

```shell
npm run lint
npm run check:types
```

Expected: PASS.

- [ ] **Step 4: Browser verify the rendered flow**

Start the app if needed:

```shell
npm run dev
```

Open:

- `http://localhost:3000/pricing`
- `http://localhost:3000/`
- `http://localhost:3000/about`
- `http://localhost:3000/onboarding`

Verify:

- `/pricing` clearly separates Normal, Pavilion racing, and Thursday team racing.
- `/` has a compact pricing comparison with broad price ranges, `Thursday team racing`, and no bare `Team Racing` label.
- `/about` links to `/pricing` without adding a large pricing table.
- `/onboarding` uses the compact labels and does not show bare `Team racing` as a primary label.
- On mobile width, the price badges and labels wrap without overlap.

## Implementation Notes

- Do not rename `SailingCardType.normal`, `SailingCardType.racing`, or `SailingCardType.team_racing` in this plan. That would create unnecessary schema churn.
- Do not implement Stripe subscription changes here. The existing racing subscription plan owns billing infrastructure.
- Do not add long educational paragraphs to onboarding. The public `/pricing` page is where the full explanation belongs.
- Keep visible app strings in `src/locales/en.json`.
- Keep the About-page addition short; the page is not the pricing page.

## Self-Review

- Spec coverage: onboarding labels, onboarding comparison/pricing, home-page comparison/pricing, public About explanation, a dedicated pricing/pricing page, developer docs, and README linking are all covered.
- Placeholder scan: this plan contains no `TBD`, `TODO`, or unspecified “write tests” steps.
- Type consistency: existing `SailingCardType` values remain unchanged; the new `PricingPageView` and `PricingPage` names match file names and imports.
