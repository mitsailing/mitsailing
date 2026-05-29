# Membership Payment Admin Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the simplest V1 membership payment/access status foundation that lets staff and members see Stripe, legacy, and staff-bypassed paid racing status without generic notes or a broad admin search framework.

**Architecture:** Extend the membership billing model with a payment source discriminator and keep legacy records in the same access/status path as Stripe records. Keep card issuance manual and pavilion-centered: `/admin/cards` loads pending rows once, filters client-side, and records payment bypass on the Sailing Card request approval path when staff intentionally issue a paid card without payment. The top of `/admin/users/[id]` shows status and links only; actions stay in the owning sections.

**Tech Stack:** Next.js App Router, React client components, Server Actions, ZenStack/Prisma, PostgreSQL, next-intl, Vitest, Playwright.

---

## Scope And PR Budget

This plan is an insert into the broader Sailing Card payments/onboarding plan. Keep each implementation PR below the 100-file hard cap, split at 70 changed files, and target under 80 files.

Recommended split:

1. **Schema/status PR:** membership payment source/status fields, request bypass fields, status helpers, and legacy-match representation.
2. **Admin card PR:** `/admin/cards` client-side filtering and paid-card-without-payment issuance controls.
3. **Admin/member status PR:** `/admin/users/[id]` current blockers and member dashboard membership status.
4. **Legacy import PR:** legacy source-table discovery, confident match import, and unmatched review report.

Schema work must edit `zenstack/schema.zmodel` first. Do not hand-edit `prisma/schema.prisma`; use the maintainer-approved ZenStack generation handoff.

## File Map

Schema and migrations:

- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260529183000_membership_payment_admin_status/migration.sql`

Membership status domain:

- Create or update: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.ts`
- Create or update: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`
- Create or update: `src/libs/mit-sailing/membershipBilling/legacyMembershipPayments.ts`
- Create or update: `src/libs/mit-sailing/membershipBilling/legacyMembershipPayments.test.ts`

Admin cards:

- Modify: `src/libs/admin/cards/adminSailingCardActions.ts`
- Modify: `src/libs/admin/cards/adminSailingCardActions.test.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.test.ts`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/cards/page.tsx`

Admin user/member status:

- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Create or update: `src/libs/admin/users/adminUserMembershipStatus.ts`
- Create or update: `src/libs/admin/users/adminUserMembershipStatus.test.ts`
- Create or update: `src/app/[locale]/(auth)/profile/membership/page.tsx`
- Create or update: `src/components/auth/profile/ProfileMembershipStatus.tsx`
- Create or update: `src/components/auth/profile/ProfileMembershipStatus.test.tsx`

Legacy review:

- Create: `src/libs/legacy-sync/legacyMembershipPaymentImport.ts`
- Create: `src/libs/legacy-sync/legacyMembershipPaymentImport.test.ts`
- Create: `src/libs/admin/membership/legacyMembershipPaymentReview.ts`
- Create: `src/libs/admin/membership/legacyMembershipPaymentReview.test.ts`

Locale and e2e:

- Modify: `src/locales/en.json`
- Add or update: `tests/e2e/SailingCardMembershipPayments.e2e.ts`

## Task 0: File Budget And Legacy Source Discovery

**Files:**
- Read: `zenstack/schema.zmodel`
- Read: `src/libs/legacy-sync/legacyMysqlSync.ts`
- Read: `docs/superpowers/specs/2026-05-29-membership-payment-admin-status-design.md`
- Optional local evidence: legacy mirror table list from the `legacy` schema

- [ ] **Step 1: Confirm branch and file budget**

Run:

```bash
git status --short --branch
git diff --name-only origin/main...HEAD | wc -l
```

Expected: current branch is a `feature/` branch and changed-file count is below 70 before implementation.

- [ ] **Step 2: Confirm existing card-number behavior**

Read `src/libs/admin/cards/adminSailingCardQueries.ts` and `src/libs/admin/cards/adminSailingCardActions.ts`.

Expected facts:

- blank/auto assignment starts at `60`;
- manual assignment accepts any positive integer;
- duplicate numbers are rejected per `sailingCardYear`.

- [ ] **Step 3: Discover legacy membership payment source tables**

Use the existing legacy MySQL mirror. If the local `legacy` schema is not populated, run the repo's documented legacy sync process or ask Andrew for a synced local DB. Inspect table names and columns for membership/racing/card payment evidence.

Useful read-only SQL once `DATABASE_URL` points at local dev:

```sql
select table_name
from information_schema.tables
where table_schema = 'legacy'
order by table_name;
```

Then inspect likely source tables by listing their columns in one result set:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'legacy'
  and (
    table_name ilike '%card%'
    or table_name ilike '%member%'
    or table_name ilike '%pay%'
    or table_name ilike '%race%'
  )
order by table_name, ordinal_position;
```

Expected: identify the exact source table and matching fields before implementing import logic. If no source table can be identified, stop the legacy import PR and record the blocker in Linear MIT-6.

## Task 1: Add Membership Payment Source And Request Bypass Schema

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260529183000_membership_payment_admin_status/migration.sql`
- Test: existing schema/model tests near `src/libs/mit-sailing/*Schema*.test.ts`, or create `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`

- [ ] **Step 1: Write failing schema/status tests**

Create or update `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts` with tests for the public status contract:

```ts
import {
  membershipPaymentAccessStatus,
  type MembershipPaymentAccessRecord,
} from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';

describe('membershipPaymentAccessStatus', () => {
  it('treats a paid legacy record as current paid access without a receipt', () => {
    const record = {
      cardType: 'racing',
      cardYear: 2027,
      source: 'legacy',
      status: 'paid',
      stripeReceiptUrl: null,
    } satisfies MembershipPaymentAccessRecord;

    expect(membershipPaymentAccessStatus({ cardYear: 2027, record })).toEqual({
      access: 'paid',
      labelKey: 'membership_status_paid_legacy',
      receiptHref: null,
      setupAutoRenewPrompt: true,
    });
  });

  it('does not grant access for ambiguous legacy matches', () => {
    const record = {
      cardType: 'racing',
      cardYear: 2027,
      source: 'legacy',
      status: 'needs_review',
      stripeReceiptUrl: null,
    } satisfies MembershipPaymentAccessRecord;

    expect(membershipPaymentAccessStatus({ cardYear: 2027, record })).toMatchObject({
      access: 'blocked',
      blocker: 'legacy_review_required',
    });
  });
});
```

Expected: FAIL because the helper and types do not exist.

- [ ] **Step 2: Add schema fields**

In `zenstack/schema.zmodel`, add payment source/status enums to the membership payment model introduced by the broader billing foundation. If the model does not exist yet, add the minimal foundation model in the schema/status PR:

```prisma
enum SailingCardMembershipPaymentSource {
  stripe
  legacy

  @@map("sailing_card_membership_payment_source")
}

enum SailingCardMembershipPaymentStatus {
  pending
  paid
  past_due
  handled
  cancelled
  refunded
  disputed
  needs_review

  @@map("sailing_card_membership_payment_status")
}
```

The membership payment model includes:

```prisma
source SailingCardMembershipPaymentSource
status SailingCardMembershipPaymentStatus @default(pending)
cardYear Int @map("card_year")
cardType SailingCardType @map("card_type")
legacySourceTable String? @map("legacy_source_table")
legacySourceId String? @map("legacy_source_id")
stripeReceiptUrl String? @map("stripe_receipt_url") @db.Text
issueHandledNote String? @map("issue_handled_note") @db.Text
issueHandledByUserId String? @map("issue_handled_by_user_id")
issueHandledAt DateTime? @map("issue_handled_at")
```

On `SailingCardRequest`, add the V1 paid-card-without-payment override fields:

```prisma
paymentBypassNote String? @map("payment_bypass_note") @db.Text
paymentBypassByUserId String? @map("payment_bypass_by_user_id")
paymentBypassAt DateTime? @map("payment_bypass_at")
paymentBypassBy User? @relation("SailingCardRequestPaymentBypassBy", fields: [paymentBypassByUserId], references: [id], onDelete: SetNull)
```

Add the inverse relation on `User`:

```prisma
paymentBypassedSailingCardRequests SailingCardRequest[] @relation("SailingCardRequestPaymentBypassBy")
```

- [ ] **Step 3: Generate schema artifacts**

Use the maintainer-approved ZenStack generation handoff. Do not manually edit `prisma/schema.prisma`.

Expected generated artifacts include `prisma/schema.prisma` with the new enums, model fields, and relation.

- [ ] **Step 4: Add migration constraints**

In the migration SQL, enforce source-specific integrity:

```sql
alter table sailing_card_membership_payments
  add constraint sailing_card_membership_payments_legacy_no_stripe_chk
  check (
    source <> 'legacy'
    or (
      stripe_receipt_url is null
      and stripe_checkout_session_id is null
      and stripe_invoice_id is null
      and stripe_subscription_id is null
    )
  );
```

Also enforce that bypass notes are meaningful when present:

```sql
alter table sailing_card_requests
  add constraint sailing_card_requests_payment_bypass_note_chk
  check (
    payment_bypass_at is null
    or length(trim(payment_bypass_note)) >= 3
  );
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm run test -- src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts
npm run check:types
```

Expected: tests pass after helper implementation in Task 2; typecheck passes after generated artifacts are present.

## Task 2: Implement Membership Payment Access Status Helpers

**Files:**
- Create: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.ts`
- Test: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`

- [ ] **Step 1: Implement minimal types and status mapping**

Add:

```ts
export type MembershipPaymentSource = 'legacy' | 'stripe';
export type MembershipPaymentStatus =
  | 'cancelled'
  | 'disputed'
  | 'handled'
  | 'needs_review'
  | 'paid'
  | 'past_due'
  | 'pending'
  | 'refunded';

export type MembershipPaymentAccessRecord = {
  readonly cardType: 'racing' | 'team_racing';
  readonly cardYear: number;
  readonly source: MembershipPaymentSource;
  readonly status: MembershipPaymentStatus;
  readonly stripeReceiptUrl: string | null;
};

export type MembershipPaymentAccessStatus =
  | {
      readonly access: 'paid';
      readonly labelKey:
        | 'membership_status_paid_legacy'
        | 'membership_status_paid_stripe';
      readonly receiptHref: string | null;
      readonly setupAutoRenewPrompt: boolean;
    }
  | {
      readonly access: 'blocked';
      readonly blocker:
        | 'legacy_review_required'
        | 'payment_disputed'
        | 'payment_past_due'
        | 'payment_refunded';
    }
  | { readonly access: 'none' };

export function membershipPaymentAccessStatus(props: {
  readonly cardYear: number;
  readonly record: MembershipPaymentAccessRecord | null;
}): MembershipPaymentAccessStatus {
  if (props.record === null || props.record.cardYear !== props.cardYear) {
    return { access: 'none' };
  }
  if (props.record.status === 'needs_review') {
    return { access: 'blocked', blocker: 'legacy_review_required' };
  }
  if (props.record.status === 'disputed') {
    return { access: 'blocked', blocker: 'payment_disputed' };
  }
  if (props.record.status === 'past_due') {
    return { access: 'blocked', blocker: 'payment_past_due' };
  }
  if (props.record.status === 'refunded') {
    return { access: 'blocked', blocker: 'payment_refunded' };
  }
  if (props.record.status === 'paid' || props.record.status === 'handled') {
    return {
      access: 'paid',
      labelKey:
        props.record.source === 'legacy'
          ? 'membership_status_paid_legacy'
          : 'membership_status_paid_stripe',
      receiptHref:
        props.record.source === 'stripe' ? props.record.stripeReceiptUrl : null,
      setupAutoRenewPrompt: props.record.source === 'legacy',
    };
  }
  return { access: 'none' };
}
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts
```

Expected: PASS.

## Task 3: Add Client-Side Pending Queue Search

**Files:**
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing component test**

Add a test that renders two pending rows, types into the search input, and confirms the table filters without navigation:

```ts
it('filters pending card requests by name, email, and MIT ID without navigation', async () => {
  const user = userEvent.setup();
  renderQueue({
    rows: [
      row({ email: 'ada@example.edu', mitId: '111111111', name: 'Ada Lovelace' }),
      row({ email: 'grace@example.edu', mitId: '222222222', name: 'Grace Hopper' }),
    ],
  });

  await user.type(screen.getByRole('searchbox', { name: /search pending/i }), '222');

  expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
});
```

Expected: FAIL because there is no searchbox.

- [ ] **Step 2: Add search state and filtering**

In `AdminSailingCardQueue.tsx`, add `useState` and a normalized filter:

```ts
const [search, setSearch] = useState('');
const normalizedSearch = search.trim().toLowerCase();
const visibleRows =
  normalizedSearch === ''
    ? props.rows
    : props.rows.filter((row) =>
        [row.name, row.email, row.mitId ?? '']
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      );
```

Render an input above the table:

```tsx
<div className="border-b border-border px-5 py-4">
  <Label htmlFor="admin-card-pending-search">
    {t('pending_search_label')}
  </Label>
  <Input
    className="mt-2 max-w-md"
    id="admin-card-pending-search"
    name="pendingSearch"
    onChange={(event) => setSearch(event.currentTarget.value)}
    type="search"
    value={search}
  />
</div>
```

Use `visibleRows` instead of `props.rows` for rendering and empty-state logic.

- [ ] **Step 3: Add locale keys**

In `src/locales/en.json` under `AdminCards`, add:

```json
"pending_search_label": "Search pending requests",
"empty_search_results": "No pending requests match that search."
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx
```

Expected: PASS.

## Task 4: Add Paid-Card-Without-Payment Override To Card Issuance

**Files:**
- Modify: `src/libs/admin/cards/adminSailingCardActions.ts`
- Modify: `src/libs/admin/cards/adminSailingCardActions.test.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.ts`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing server-action tests**

Add tests that paid card issuance without paid access fails unless a bypass note is present:

```ts
it('requires a bypass note to issue paid racing without payment', async () => {
  mockPendingRequest({ cardType: SailingCardType.racing });
  mockCurrentMembershipAccess({ access: 'none' });

  await expectIssueCardFormError({
    formData: formData({ cardNumber: '110' }),
    formError: 'payment_required',
  });
});

it('records a bypass note when issuing paid racing without payment', async () => {
  mockPendingRequest({ cardType: SailingCardType.racing });
  mockCurrentMembershipAccess({ access: 'none' });

  await issueSailingCardAction('en', 'user-1', idleState, formData({
    cardNumber: '110',
    paymentBypassNote: 'Director approved comped racing access.',
  }));

  expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        paymentBypassNote: 'Director approved comped racing access.',
        paymentBypassByUserId: 'admin-1',
        paymentBypassAt: expect.any(Date),
      }),
    })
  );
});
```

Expected: FAIL because the form error and fields do not exist.

- [ ] **Step 2: Parse and validate bypass note**

Add:

```ts
function parsePaymentBypassNote(formData: FormData) {
  const raw = formDataString(formData, 'paymentBypassNote').trim();
  return raw === '' ? null : raw;
}

function paidCardRequiresPayment(cardType: SailingCardType) {
  return (
    cardType === SailingCardType.racing ||
    cardType === SailingCardType.team_racing
  );
}
```

Extend `AdminSailingCardFormError` with:

```ts
| 'payment_required'
```

When `paidCardRequiresPayment(request.cardType)` and current membership access is not paid, require `paymentBypassNote !== null`.

- [ ] **Step 3: Store bypass fields on request approval**

In the `sailingCardRequest.updateMany` approval data, set:

```ts
paymentBypassAt: shouldBypassPayment ? now : null,
paymentBypassByUserId: shouldBypassPayment ? session.user.id : null,
paymentBypassNote: shouldBypassPayment ? paymentBypassNote : null,
```

Keep user card fields unchanged; this is still manual card issuance.

- [ ] **Step 4: Add UI note field only for paid unpaid rows**

Extend the pending row DTO with payment access status. In the issue form, render a textarea when the row is paid `racing`/`team_racing` and access is not paid:

```tsx
<Label htmlFor={`${props.userId}-paymentBypassNote`}>
  {t('payment_bypass_note_label')}
</Label>
<Textarea
  id={`${props.userId}-paymentBypassNote`}
  name="paymentBypassNote"
  placeholder={t('payment_bypass_note_placeholder')}
/>
```

Do not show this field for free normal cards or paid cards with active paid/legacy access.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- src/libs/admin/cards/adminSailingCardActions.test.ts src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx
```

Expected: PASS.

## Task 5: Add Admin User Current Blockers

**Files:**
- Create: `src/libs/admin/users/adminUserMembershipStatus.ts`
- Create: `src/libs/admin/users/adminUserMembershipStatus.test.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing status helper tests**

Create tests for blocker composition:

```ts
it('returns payment blocker before card issuance', () => {
  expect(
    adminUserMembershipBlockers({
      cardRequest: { cardType: 'racing', paymentBypassNote: null },
      membershipAccess: { access: 'blocked', blocker: 'payment_disputed' },
      recreationVerificationRequired: false,
    })
  ).toEqual([
    {
      href: '#membership-payment-status',
      key: 'admin_user_blocker_payment_disputed',
      tone: 'error',
    },
  ]);
});
```

Expected: FAIL because helper does not exist.

- [ ] **Step 2: Implement pure blocker helper**

Add:

```ts
export type AdminUserMembershipBlocker = {
  readonly href: '#membership-payment-status' | '#sailing-card-status';
  readonly key:
    | 'admin_user_blocker_intro_class'
    | 'admin_user_blocker_mit_recreation'
    | 'admin_user_blocker_payment_disputed'
    | 'admin_user_blocker_payment_past_due'
    | 'admin_user_blocker_payment_refunded';
  readonly tone: 'error' | 'warning';
};
```

Implement `adminUserMembershipBlockers` as a pure function that returns status/link rows only. It must not return actions.

- [ ] **Step 3: Render top status area**

In `/admin/users/[id]/page.tsx`, render the current blockers after `AdminPageHeader` and before detail cards:

```tsx
{blockers.length > 0 ? (
  <section aria-labelledby="admin-user-current-blockers" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <h2 className="m-0 font-semibold" id="admin-user-current-blockers">
      {t('current_blockers_heading')}
    </h2>
    <ul className="mt-2 space-y-1 p-0">
      {blockers.map((blocker) => (
        <li className="list-none" key={blocker.key}>
          <a className="font-medium underline" href={blocker.href}>
            {t(blocker.key)}
          </a>
        </li>
      ))}
    </ul>
  </section>
) : null}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/libs/admin/users/adminUserMembershipStatus.test.ts 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
```

Expected: PASS.

## Task 6: Add Member Membership Status Display

**Files:**
- Create or update: `src/app/[locale]/(auth)/profile/membership/page.tsx`
- Create: `src/components/auth/profile/ProfileMembershipStatus.tsx`
- Create: `src/components/auth/profile/ProfileMembershipStatus.test.tsx`
- Modify: `src/components/auth/profile/ProfileSideNav.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing component tests**

Test legacy paid display:

```ts
it('shows legacy payment as paid without a receipt link', () => {
  render(
    <ProfileMembershipStatus
      status={{
        access: 'paid',
        labelKey: 'membership_status_paid_legacy',
        receiptHref: null,
        setupAutoRenewPrompt: true,
      }}
    />
  );

  expect(screen.getByText(/paid through legacy system/i)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /receipt/i })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /set up auto-renew/i })).toBeInTheDocument();
});
```

Expected: FAIL because component does not exist.

- [ ] **Step 2: Implement display component**

Add a small component that accepts `MembershipPaymentAccessStatus` and renders:

- paid legacy: normal paid status, no receipt, optional auto-renew link;
- paid Stripe: normal paid status and receipt link when present;
- blocked: warning/error text;
- none: payment setup/status copy.

- [ ] **Step 3: Add profile route**

Add `/profile/membership` using existing profile layout conventions. It should load the current user's membership access status server-side and render `ProfileMembershipStatus`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/components/auth/profile/ProfileMembershipStatus.test.tsx
npm run check:i18n
```

Expected: PASS.

## Task 7: Import Confident Legacy Payments And Review Ambiguous Rows

**Files:**
- Create: `src/libs/legacy-sync/legacyMembershipPaymentImport.ts`
- Create: `src/libs/legacy-sync/legacyMembershipPaymentImport.test.ts`
- Create: `src/libs/admin/membership/legacyMembershipPaymentReview.ts`
- Create: `src/libs/admin/membership/legacyMembershipPaymentReview.test.ts`

- [ ] **Step 1: Write matching tests from discovered source fields**

After Task 0 identifies the source table/fields, write tests with three fixtures:

```ts
it('imports a confident legacy payment match as paid legacy access', () => {
  expect(importLegacyMembershipPayment(legacyRow({
    amountCents: 7000,
    cardType: 'racing',
    email: 'sailor@example.edu',
    legacyId: 'old-123',
    seasonYear: 2027,
  }))).toMatchObject({
    source: 'legacy',
    status: 'paid',
    legacySourceId: 'old-123',
    stripeReceiptUrl: null,
  });
});

it('routes unmatched legacy payment rows to review', () => {
  expect(importLegacyMembershipPayment(legacyRow({
    email: 'unknown@example.edu',
    legacyId: 'old-404',
  }))).toMatchObject({
    reviewReason: 'no_user_match',
    status: 'needs_review',
  });
});

it('routes ambiguous legacy payment rows to review', () => {
  expect(importLegacyMembershipPayment(legacyRow({
    email: 'shared@example.edu',
    legacyId: 'old-409',
  }))).toMatchObject({
    reviewReason: 'ambiguous_user_match',
    status: 'needs_review',
  });
});
```

Expected: FAIL until the source-specific mapping exists.

- [ ] **Step 2: Implement source-specific mapping**

Map the discovered legacy row fields into the membership payment/access model. Do not invent Stripe ids. Do not attach ambiguous rows to users.

Required output fields:

```ts
{
  cardType,
  cardYear,
  legacySourceId,
  legacySourceTable,
  source: 'legacy',
  status: 'paid' | 'needs_review',
  stripeReceiptUrl: null,
  userId: matchedUserIdOrNull,
}
```

- [ ] **Step 3: Add review query helper**

Expose unmatched/ambiguous rows through `legacyMembershipPaymentReview.ts` for a future admin review UI/report. The helper returns only review rows and must not grant access.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyMembershipPaymentImport.test.ts src/libs/admin/membership/legacyMembershipPaymentReview.test.ts
```

Expected: PASS.

## Task 8: End-To-End Verification

**Files:**
- Add or update: `tests/e2e/SailingCardMembershipPayments.e2e.ts`

- [ ] **Step 1: Add e2e coverage**

Add Playwright coverage for:

- admin filters pending card queue by MIT ID without navigation;
- admin manually assigns card number `110`;
- duplicate card number for the same year fails;
- paid racing without payment requires a bypass note;
- legacy-paid member sees paid legacy status and no receipt link.

- [ ] **Step 2: Run local gates**

Run:

```bash
npm run lint
npm run check:types
npm run check:i18n
npm run test
npm run test:e2e
```

Expected: all pass before PR readiness is claimed.

## Self-Review

- Spec coverage: covers same membership payment/access model, legacy display, optional auto-renew prompt, unmatched review, admin blockers, JS pending search, manual card-number rules, and payment-bypass override.
- Placeholder scan: this plan intentionally has one legacy source discovery gate because the old-system membership payment table is not yet identified. Import code starts only after that table is discovered.
- Type consistency: source/status names are `legacy`, `stripe`, `paid`, `needs_review`, and the bypass fields are `paymentBypassNote`, `paymentBypassByUserId`, and `paymentBypassAt`.
