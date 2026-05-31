# Membership Payment Admin Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the simplest V1 membership payment/access status foundation that lets staff and members see Stripe, legacy, event/deposit, and staff-bypassed paid racing status in one admin payment history without generic notes or a broad admin search framework.

**Architecture:** Broaden the existing event payment storage into one `Payment` model/table with a simple `purpose` value: `event` or `membership`. Event/deposit rows keep using event fields. Membership rows use membership fields such as `cardYear`, `cardType`, `source`, and Stripe subscription/invoice ids. Database checks enforce which fields belong to which purpose. Do not add adapter classes, repository layers, or a second Stripe event processor. Stripe sync stays in the existing webhook route and updates the same payment table. Keep card issuance manual and Pavilion-staff centered: staff start in `/admin/users`, search by the person in front of them, open `/admin/users/[id]`, then review card/payment/agreement state and issue or expire the card there. Records still use the sailing-card request approval path when staff intentionally issue a paid card without payment; the UI entry point is the admin user profile, not a standalone card queue.

**Tech Stack:** Next.js App Router, React client components, Server Actions, ZenStack/Prisma, PostgreSQL, next-intl, Vitest, Playwright.

---

## Scope And PR Budget

This plan is an insert into the broader Sailing Card payments/onboarding plan. Keep each implementation PR below the 100-file hard cap, split at 70 changed files, and target under 80 files.

Recommended split:

1. **Schema/status PR:** rename/broaden event payment to shared payment storage, add payment purpose/source/status fields, request bypass fields, status helpers, and legacy-match representation.
2. **Admin user card PR:** `/admin/users` client-side people search/filters and `/admin/users/[id]` paid-card-without-payment issuance controls.
3. **Admin/member status PR:** `/admin/users/[id]` current blockers, shared payment history, card status, and member dashboard membership status.
4. **Legacy import PR:** legacy source-table discovery, confident match import, and unmatched review report.

Schema work must edit `zenstack/schema.zmodel` first. Do not hand-edit `prisma/schema.prisma`; use the maintainer-approved ZenStack generation handoff.

Keep this plan junior-readable. If a task starts needing adapter classes, repository layers, or a second Stripe event processor, stop and simplify the task before coding. A plain `purpose` switch is acceptable.

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

Shared payment domain:

- Modify: `src/libs/mit-sailing/eventPayments.ts`
- Modify: `src/libs/mit-sailing/eventPayments.test.ts`
- Create or update: `src/libs/mit-sailing/payments/paymentStatus.ts`
- Create or update: `src/libs/mit-sailing/payments/paymentStatus.test.ts`

Stripe sync touch points:

- Modify only if needed: `src/libs/stripe/stripeWebhookEvents.ts`
- Modify only if needed: `src/libs/stripe/stripeWebhookEvents.test.ts`
- Modify only if needed: `src/app/api/stripe/webhooks/route.ts`
- Modify only if needed: `src/app/api/stripe/webhooks/route.test.ts`

Admin card issuance:

- Modify: `src/libs/admin/cards/adminSailingCardActions.ts`
- Modify: `src/libs/admin/cards/adminSailingCardActions.test.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.test.ts`
- Rename/modify: `src/components/mit-sailing/admin/cards/AdminSailingCardControls.tsx`
- Rename/modify: `src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx`
- Delete: `src/app/[locale]/(marketing)/(site)/admin/cards/page.tsx`
- Delete: `src/app/[locale]/(marketing)/(site)/admin/cards/adminCardsPage.test.tsx`

Admin user/member status:

- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Create or update: `src/libs/admin/users/adminUserMembershipStatus.ts`
- Create or update: `src/libs/admin/users/adminUserMembershipStatus.test.ts`
- Create or update: `src/libs/admin/users/adminUserPaymentHistory.ts`
- Create or update: `src/libs/admin/users/adminUserPaymentHistory.test.ts`
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
- Add: `src/components/mit-sailing/admin/catalog/AdminCatalogTable.test.tsx`
- Add: `tests/e2e/SailingCardMembershipPayments.e2e.ts`

## Task 0: File Budget And Legacy Source Discovery

**Files:**
- Read: `zenstack/schema.zmodel`
- Read: `src/libs/legacy-sync/legacyMysqlSync.ts`
- Read: `docs/superpowers/specs/2026-05-29-membership-payment-admin-status-design.md`
- Optional local evidence: legacy mirror table list from the `legacy` schema

- [x] **Step 1: Confirm branch and file budget**

Run:

```bash
git status --short --branch
git diff --name-only origin/main...HEAD | wc -l
```

Expected: current branch is a `feature/` branch and changed-file count is below 70 before implementation.

- [x] **Step 2: Confirm existing card-number behavior**

Read `src/libs/admin/cards/adminSailingCardQueries.ts` and `src/libs/admin/cards/adminSailingCardActions.ts`.

Expected facts:

- blank/auto assignment starts at `60`;
- manual assignment accepts any positive integer;
- duplicate numbers are rejected per `sailingCardYear`.

Result: confirmed in `src/libs/admin/cards/adminSailingCardQueries.ts`,
`src/libs/admin/cards/adminSailingCardQueries.test.ts`,
`src/libs/admin/cards/adminSailingCardActions.ts`, and
`src/libs/admin/cards/adminSailingCardActions.test.ts`.

- [x] **Step 3: Discover legacy membership payment source tables**

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

Expected: use `legacy.payments` as the confident legacy payment source. V1 matching uses `category = 'Racing'` plus canonical descriptions matching `Racing Card YYYY-YYYY for ...`. Rows from `sailing-wp/reports/payments_missing_user.csv` are review-only unless staff resolves them.

## Task 1: Broaden Event Payment Into Shared Payment Schema

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260529183000_membership_payment_admin_status/migration.sql`
- Test: existing schema/model tests near `src/libs/mit-sailing/*Schema*.test.ts`, or create `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`

- [x] **Step 1: Write failing schema/status tests**

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

Result: covered by
`src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`
and `src/libs/mit-sailing/payments/paymentSchemaContract.test.ts`.

- [x] **Step 2: Add shared payment purpose and membership fields**

In `zenstack/schema.zmodel`, broaden the existing `EventPayment` model into one shared payment model. Prefer a clear model name such as `Payment` if the changed-file count stays below the PR budget; otherwise keep the existing model name for the first PR and rename in a follow-up PR. The table must have one purpose column and must store both event/deposit and membership rows.

```prisma
enum PaymentPurpose {
  event
  membership

  @@map("payment_purpose")
}

enum PaymentSource {
  stripe
  legacy
  admin_override

  @@map("payment_source")
}

enum PaymentStatus {
  pending
  checkout_created
  paid
  past_due
  handled
  cancelled
  refunded
  disputed
  needs_review

  @@map("payment_status")
}
```

The shared payment model keeps current event fields and adds membership fields:

```prisma
purpose PaymentPurpose @default(event)
source PaymentSource @default(stripe)
status PaymentStatus @default(pending)

// Existing event/deposit payment fields. Nullable only because membership rows do not have them.
eventId String? @map("event_id")
registrationId String? @map("registration_id")
selectedFeeId String? @map("selected_fee_id")
selectedFeeDescription String? @map("selected_fee_description")

// Membership rows.
cardYear Int? @map("card_year")
cardType SailingCardType? @map("card_type")
legacySourceTable String? @map("legacy_source_table")
legacySourceId String? @map("legacy_source_id")
stripeCustomerId String? @map("stripe_customer_id")
stripeCheckoutSessionId String? @unique @map("stripe_checkout_session_id")
stripeSubscriptionId String? @unique @map("stripe_subscription_id")
stripeInvoiceId String? @unique @map("stripe_invoice_id")
stripeReceiptUrl String? @map("stripe_receipt_url") @db.Text
issueHandledNote String? @map("issue_handled_note") @db.Text
issueHandledByUserId String? @map("issue_handled_by_user_id")
issueHandledAt DateTime? @map("issue_handled_at")
```

Keep Stripe fields directly on the shared payment model. Do not create a separate generic `StripePayment`, `PaymentOwner`, or `PaymentSyncTarget` table for V1.

Event relations become optional because membership rows have no event registration. Preserve existing event behavior with database checks and application tests rather than fake event rows.

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

- [x] **Step 3: Generate schema artifacts**

Use the maintainer-approved ZenStack generation handoff. Do not manually edit `prisma/schema.prisma`.

Expected generated artifacts include `prisma/schema.prisma` with the new enums, model fields, and relation.

Result: generated artifacts are present in `prisma/schema.prisma` and
`zenstack/schema.ts`.

- [x] **Step 4: Add migration constraints**

In the migration SQL, enforce purpose-specific integrity:

```sql
alter table payments
  add constraint payments_event_fields_chk
  check (
    purpose <> 'event'
    or (
      event_id is not null
      and registration_id is not null
      and selected_fee_id is not null
      and selected_fee_description is not null
    )
  );

alter table payments
  add constraint payments_membership_fields_chk
  check (
    purpose <> 'membership'
    or (
      event_id is null
      and registration_id is null
      and selected_fee_id is null
      and selected_fee_description is null
      and card_year is not null
      and card_type is not null
    )
  );

alter table payments
  add constraint payments_legacy_no_stripe_chk
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

- [x] **Step 5: Run focused verification**

Run:

```bash
npm run test -- src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts
npm run check:types
```

Expected: tests pass after helper implementation in Task 2; typecheck passes after generated artifacts are present.

Result: focused payment/status tests and `npm run check:types` passed on
May 29, 2026.

## Task 2: Implement Membership Payment Access Status Helpers

**Files:**
- Create: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.ts`
- Test: `src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts`

- [x] **Step 1: Implement minimal types and status mapping**

Add:

```ts
export type MembershipPaymentSource = 'admin_override' | 'legacy' | 'stripe';
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

- [x] **Step 2: Run focused tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/membershipBilling/membershipPaymentStatus.test.ts
```

Expected: PASS.

## Task 3: Add Client-Side User Search For Pavilion Staff

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/page.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCatalogTable.tsx`
- Add: `src/components/mit-sailing/admin/catalog/AdminCatalogTable.test.tsx`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write failing component test**

Add a test that renders two admin user rows, types into the users search input,
and confirms staff can filter by name, email, MIT ID, sailing card number, or
role without navigation. Add exact-match filters for email status and banned
state because those are secondary staff triage states, not default table
columns.

Expected: FAIL because the users catalog table has no client-side search or
filters.

- [x] **Step 2: Add search state and filtering**

In `AdminCatalogTable.tsx`, add optional search and filter props, normalized
client-side filtering, and stable labels. Configure `/admin/users` with search
fields `email`, `name`, `mitId`, `sailingCardNumber`, and `appRole`. Configure
email-delivery and banned as filters, not visible columns.

- [x] **Step 3: Add locale keys**

In `src/locales/en.json` under `AdminUsers`, add labels for MIT ID, sailing card
number, users search, email status filter, and banned filter.

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/AdminCatalogTable.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
```

Expected: PASS.

## Task 4: Add Paid-Card-Without-Payment Override To Card Issuance

**Files:**
- Modify: `src/libs/admin/cards/adminSailingCardActions.ts`
- Modify: `src/libs/admin/cards/adminSailingCardActions.test.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.ts`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardControls.tsx`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write failing server-action tests**

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

- [x] **Step 2: Parse and validate bypass note**

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

- [x] **Step 3: Store bypass fields on request approval**

In the `sailingCardRequest.updateMany` approval data, set:

```ts
paymentBypassAt: shouldBypassPayment ? now : null,
paymentBypassByUserId: shouldBypassPayment ? session.user.id : null,
paymentBypassNote: shouldBypassPayment ? paymentBypassNote : null,
```

Keep user card fields unchanged; this is still manual card issuance.

- [x] **Step 4: Add UI note field only for paid unpaid rows**

Expose the payment access status to the issue form rendered on
`/admin/users/[id]`. In the issue form, render a textarea when the pending
request is paid `racing`/`team_racing` and access is not paid:

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

Do not show this field for free normal cards or paid cards with active
paid/legacy access. Do not add a standalone card admin page for this action.

- [x] **Step 5: Run focused tests**

Run:

```bash
npm run test -- src/libs/admin/cards/adminSailingCardActions.test.ts src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx
```

Expected: PASS.

## Task 5: Add Admin User Current Blockers And Payment History

**Files:**
- Create: `src/libs/admin/users/adminUserMembershipStatus.ts`
- Create: `src/libs/admin/users/adminUserMembershipStatus.test.ts`
- Create: `src/libs/admin/users/adminUserPaymentHistory.ts`
- Create: `src/libs/admin/users/adminUserPaymentHistory.test.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write failing status helper tests**

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

- [x] **Step 2: Implement pure blocker helper**

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

- [x] **Step 3: Write failing payment history tests**

Create `src/libs/admin/users/adminUserPaymentHistory.test.ts` with rows for:

- successful event payment;
- failed or disputed event payment;
- successful membership Stripe payment;
- successful legacy membership payment with no receipt link;
- failed membership Stripe payment.

Expected: FAIL because the helper/query does not exist.

- [x] **Step 4: Implement read-only payment history query**

Create `src/libs/admin/users/adminUserPaymentHistory.ts`. Query shared payment rows for one user, map them into a small UI DTO, then sort newest first.

Use a plain union in TypeScript:

```ts
export type AdminUserPaymentHistoryRow = {
  readonly amountCents: number;
  readonly createdAt: Date;
  readonly currency: string;
  readonly detailHref: string | null;
  readonly id: string;
  readonly receiptHref: string | null;
  readonly purpose: 'event' | 'membership';
  readonly status:
    | 'cancelled'
    | 'disputed'
    | 'handled'
    | 'needs_review'
    | 'paid'
    | 'past_due'
    | 'pending'
    | 'refunded';
  readonly title: string;
};
```

Do not create a database view or adapter layer for V1. This is just an admin user-page display query over the shared payment table.

- [x] **Step 5: Render top status area**

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

- [x] **Step 6: Render payment history section**

On `/admin/users/[id]`, add a staff-only section showing all rows from `adminUserPaymentHistory`. Include source label, title, status, amount, date, receipt link when present, and owning-record link when present.

The section is read-only. Do not add refund, override, cancellation, or retry controls in this task.

- [x] **Step 7: Run focused tests**

Run:

```bash
npm run test -- src/libs/admin/users/adminUserMembershipStatus.test.ts src/libs/admin/users/adminUserPaymentHistory.test.ts 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
```

Expected: PASS.

## Task 6: Add Member Membership Status Display

**Files:**
- Create or update: `src/app/[locale]/(auth)/profile/membership/page.tsx`
- Create: `src/components/auth/profile/ProfileMembershipStatus.tsx`
- Create: `src/components/auth/profile/ProfileMembershipStatus.test.tsx`
- Modify: `src/components/auth/profile/ProfileSideNav.tsx`
- Modify: `src/locales/en.json`

- [x] **Step 1: Write failing component tests**

V1 update: implemented the member-facing payment view at `/profile/payments`
rather than adding a second `/profile/membership` route in this PR. The view
shows event and membership payment status, including legacy paid rows with no
Stripe receipt link.

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

- [x] **Step 2: Implement display component**

Add a small component that accepts `MembershipPaymentAccessStatus` and renders:

- paid legacy: normal paid status, no receipt, optional auto-renew link;
- paid Stripe: normal paid status and receipt link when present;
- blocked: warning/error text;
- none: payment setup/status copy.

- [x] **Step 3: Add profile route**

Add `/profile/membership` using existing profile layout conventions. It should load the current user's membership access status server-side and render `ProfileMembershipStatus`.

- [x] **Step 4: Run focused tests**

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

- [x] **Step 1: Write matching tests from discovered source fields**

V1 evidence update: the local legacy mirror is the source of truth, not
WordPress. `legacy.payments` has `settled`; local racing-card rows include many
`settled = '0'` rows. This PR treats `settled != '1'` racing rows as
`needs_review` rather than paid access. Legacy damage-deposit rows are detected
by `omarsid` prefix `BD-` or description containing `Damage Deposit` and are
review-only because returned/voided/final deposit state cannot be proven from
the available legacy columns.

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

- [x] **Step 2: Implement source-specific mapping**

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

- [x] **Step 3: Add review query helper**

Expose unmatched/ambiguous rows through `legacyMembershipPaymentReview.ts` for a future admin review UI/report. The helper returns only review rows and must not grant access.

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyMembershipPaymentImport.test.ts src/libs/admin/membership/legacyMembershipPaymentReview.test.ts
```

Expected: PASS.

## Task 8: End-To-End Verification

**Files:**
- Add: `tests/e2e/SailingCardMembershipPayments.e2e.ts`

- [x] **Step 1: Classify e2e coverage**

Current status: focused unit/component coverage exists for users search,
manual card `110`, duplicate card protection, payment-bypass note requirement,
legacy paid/no receipt, current admin payment blockers, and legacy review-only
classification. Playwright coverage now exists in
`tests/e2e/SailingCardMembershipPayments.e2e.ts` for the Pavilion-staff journey:
admin searches `/admin/users` by MIT ID, opens the user profile, assigns card
`110`, sees duplicate-card failure, records a paid-card-without-payment bypass
note, and confirms legacy-paid/no-receipt membership status.

Decision for PR #145: the full membership-payment/card journey is in this PR.
Further MIT-6 follow-up can deepen legacy import edge cases, but the missing
Playwright journey is no longer a merge-readiness gap.

- [x] **Step 2: Run local gates**

Run:

```bash
npm run lint
npm run check:types
npm run check:i18n
npm run test
npm run test:e2e
```

Expected: all pass before PR readiness is claimed.

Result: `npm run test:e2e` passed on May 29, 2026 with 93 passed and 2
skipped after the Pavilion-staff user-profile card issuance flow replaced the
standalone card-admin route.

Result: `npm run lint`, `npm run check:types`, `npm run check:i18n`,
`npm run test`, and `npm run test:e2e` all passed locally on May 29, 2026.

May 31, 2026 hardening update: the Pavilion-staff journey now keeps card
assignment and correction on `/admin/users/[id]`, adds `/admin/users` card
status filtering, removes the banned filter from the staff list, rejects
same-number card corrections without writing duplicate audit history, and keeps
onboarding form values through profile/pricing navigation. `npm run lint`,
`npm run check:types`, `npm run check:deps`, `npm run check:i18n`,
`npm run test`, and `npm run test:e2e` passed locally; e2e result was 93
passed, 2 skipped.

May 31, 2026 analyzer hardening update: current CodeRabbit event-payment,
worker, fixture, onboarding-storage, and ZenStack policy findings were
rechecked against current code and fixed/classified. Checkout now distinguishes
`needs_review` from handled payments, claims checkout rows before creating
Stripe sessions, scopes checkout display to the latest approved registration,
refreshes/cancels open payment snapshots on registration edits, filters admin
digest markers to rows that appear in the email, keeps e2e payment fixture
amounts aligned with event fees, and mirrors payment/bypass evidence checks in
ZenStack policy. `npm run lint`, `npm run check:types`, `npm run check:deps`,
`npm run check:i18n`, `git diff --check`, `npm run test`, and
`npm run test:e2e` passed locally; `npm run test` result was 2231 passed, 18
skipped, and e2e result was 93 passed, 2 skipped.

May 31, 2026 PR-analyzer closure update: remaining live Codacy/CodeRabbit
threads were rechecked against current code and fixed. The admin user profile
now uses the latest decisive membership payment row so newer blocked rows do not
hide behind older paid rows, blocker banners receive the actual pending/bypassed
card request, `/admin/users` treats sailing card number as a numeric column, and
team-racing payment-bypass coverage matches racing coverage. The legacy payment
import now refreshes persisted user IDs after `createMany(skipDuplicates)` and
parses prefixed negative adjustment strings as non-payments. Sonar's three new
issues were migration-only duplicate-literal findings and were handled with
targeted `NOSONAR` comments on enum-label lines. The Docker PR worker smoke
wait now verifies an actual SQL connection to the target `smoke` database before
running migrations.

## Self-Review

- Spec coverage: covers one shared payment table, legacy display, optional auto-renew prompt, unmatched review, admin blockers, admin user payment history, users search, manual card-number rules, and payment-bypass override.
- Placeholder scan: legacy source discovery is complete enough for V1 import planning: use `legacy.payments` with `category = 'Racing'`, canonical `Racing Card YYYY-YYYY for ...` descriptions, and `settled = '1'` for confident paid matches. Unsettled racing rows and all detected legacy damage deposits are review-only; deposit returned/voided/final state cannot be proven from the mirrored legacy schema.
- Type consistency: purpose/source/status names are `event`, `membership`, `legacy`, `stripe`, `admin_override`, `paid`, `needs_review`, and the bypass fields are `paymentBypassNote`, `paymentBypassByUserId`, and `paymentBypassAt`.
