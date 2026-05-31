# Racing Membership Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert paid racing memberships into a July 15 annual subscription flow while keeping normal membership free for MIT students, MIT Recreation members, and sailing-team members, and giving admins maintainable pricing, search, and payment issue tools.

**Architecture:** Keep the existing sailing-card request and event-payment systems intact. Add a small membership-billing domain beside them: eligibility helpers decide whether a user can request paid racing, a pricing catalog stores editable effective-dated prices, Stripe Checkout and webhooks sync subscription/payment state, and admin pages read from local records instead of querying Stripe at page render time. Each PR must stay below the 100-file hard cap; target under 80 changed files by splitting pricing/admin setup from checkout/webhook/cancellation work and reusing existing Stripe, admin, email, and sailing-card patterns.

**Tech Stack:** Next.js App Router, Server Actions, Prisma/ZenStack, Stripe Checkout/Billing, next-intl, Vitest, Playwright.

---

## Execution Reconciliation Notes

- 2026-05-29 local execution status: this plan was restored onto `feature/sailing-card-payments-onboarding-plan` after PR #143 landed on `main`. Treat it as the candidate implementation plan, but do not start code until the PR #143 persona/runbook gates, `/grill me` policy pass, and first-slice approval are complete.
- Current `main` already includes `hasFitnessMembership` in `SailingCardOnboardingInput` as `boolean | null` and passes it through the onboarding Server Action. Steps below that say to add that field should be read as "verify and extend the existing field" rather than reintroducing a string-shaped contract.
- Linear/GitHub mirrors already exist for this feature. Do not create a fresh batch of child issues from the issue plan unless the user approves new or missing tracker items after duplicate checks.
- PR file budget is a hard constraint: 100 changed files max. Every slice should split at 70 changed files and should not be submitted above 80 unless the user explicitly approves the file-list rationale.

## Sources And Current Code Facts

**MIT Sailing code facts**
- `src/libs/mit-sailing/sailingCardValidity.ts` already treats July 15 in US Eastern as the sailing-card rollover date.
- `src/worker/sailingCardAnnualClearingJob.ts` already runs annual card clearing at midnight on July 15.
- `src/libs/mit-sailing/sailingCardMembership.ts` currently hard-codes spring/full racing prices and still permits student-affiliate racing payments.
- `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx` renders normal, racing, and team-racing card choices after the fitness question.
- `src/libs/mit-sailing/sailingCardOnboardingActions.ts` parses `hasFitnessMembership` in form values and `src/libs/mit-sailing/sailingCardOnboarding.ts` includes it in `SailingCardOnboardingInput` as `boolean | null`; central paid-racing eligibility enforcement and staff-visible verification handoff still need review.
- Event payments already provide reusable Stripe patterns in `src/libs/stripe/*`, `src/libs/mit-sailing/eventPaymentCheckout.ts`, `src/libs/mit-sailing/eventPayments.ts`, `src/app/api/stripe/webhooks/route.ts`, and `src/components/mit-sailing/admin/payments/AdminPaymentsLedgerView.tsx`.

**External patterns to adopt**
- Stripe Checkout subscription mode uses pre-created recurring Prices, supports one-time setup fee Prices in subscription Checkout, and syncs subscription changes through webhooks.
- Stripe Customer Portal is the simplest payment-method and invoice self-service surface; MIT Sailing should use an in-app cancellation form first so cancellation reason and local status are recorded before redirecting users to Stripe for payment-method updates.
- Next.js Server Actions should validate form input before mutation, call `revalidatePath` before `redirect`, and use Route Handlers for webhook raw-body processing.
- Cal.com separates payment concerns into customer lookup, Checkout creation, billing portal redirect, subscription lookup, and local payment records. It also validates safe return URLs for billing portal redirects and keeps Stripe-specific lookups in narrow modules such as `customer`, `subscriptions`, and `BillingPortalService`. Mirror that shape in smaller MIT Sailing modules instead of one large billing service.
- FTC-style negative-option best practices for subscriptions: clear material terms before payment, proof of consent, and cancellation that is at least as easy to find and complete as signup. Treat this as product trust guidance, not legal advice.
- Robinhood-style referral waitlists work by exposing rank and referral movement, but MIT Sailing already has scarcity. Do not add referral boosts in these PRs; preserve fairness and avoid growing demand.

## Product Decisions Locked For Implementation

- **Season year:** paid racing subscriptions renew on July 15 in US Eastern, matching existing sailing-card expiration and clearing.
- **Spring charge:** before July 15, Checkout charges the current season spring amount once, starts the annual subscription on a trial that ends at the next July 15 full-season renewal, and does not bill the annual Price before that date.
- **Full-season charge:** on or after July 15, Checkout charges the current season full amount once, starts the annual subscription on a trial that ends at the next July 15 renewal, and keeps every renewal anchored to July 15.
- **Free normal membership:** MIT students, users with verified MIT Recreation membership, and verified sailing-team members receive normal membership without paid racing or team-racing checkout.
- **MIT Recreation self-report:** onboarding can ask whether a user has MIT Recreation membership, but only staff verification sets `User.gymMembershipVerifiedAt`. Self-report hides paid options in the form, submits a normal sailing-card request for staff review, and makes the verification handoff visible to both the user and staff. Staff must not issue the free normal card for this path until `gymMembershipVerifiedAt` is set.
- **Sailing team verification:** add an admin-managed `User.sailingTeamMembershipVerifiedAt` timestamp plus a small admin control to set and clear it. Team membership grants free normal membership and suppresses paid racing/team-racing purchase paths.
- **Paid racing eligibility:** paid `racing` and `team_racing` are only available to users who do not already qualify for free normal membership and who choose that paid card type intentionally.
- **Paid racing issuance:** staff can issue paid `racing` or `team_racing` Sailing Cards only after the local membership payment/subscription state is paid or active. V1 must include an explicit admin override path to issue a paid card without payment when staff intentionally waive or bypass payment; the override requires an internal note and is surfaced on the admin user record.
- **Simplest override shape:** do not build a generic notes system or payment-waiver framework for V1. Store the paid-card-without-payment override on the current `SailingCardRequest` approval/issuance path with a required note, approver, and timestamp, then show that state on `/admin/cards` and `/admin/users/[id]`.
- **Override permission:** use the existing card-number assignment permission for the V1 paid-card-without-payment override. Do not add a separate permission in V1; the required note and audit fields distinguish the override.
- **Admin user blockers:** the admin user page needs one visible current-blockers alert area for card-issuance blockers, including payment issues, MIT Recreation verification, intro-class prerequisites, and other current blockers. The top blocker area is status/navigation only, with links or focus targets to the owning section; remediation controls stay in the Sailing Card/payment sections. Refunded, disputed, failed, or past-due current-season paid racing payments block paid racing/team-racing access and pavilion card issuance until the payment is paid/active again or staff records an explicit handled/override note. A V1 paid-card-without-payment override clears the payment blocker for that card issuance while preserving the fact that payment was bypassed.
- **Payment issue notes:** handled/override notes for payment issues belong on the specific membership payment issue record, not as generic user notes. The admin user page surfaces the current/latest relevant issue summary from those records.
- **Legacy paid memberships:** V1 must bring over membership payments already made through the legacy system. These are separate from Stripe and must not be represented as Stripe charges, Checkout sessions, invoices, receipt URLs, or portal-managed subscriptions. Imported legacy payments should be visible on the admin user record and the member dashboard/status, should satisfy paid racing/team-racing access for the covered card year/season when matched to the user, and should show as a normal paid state labeled "paid through legacy system" without offering a Stripe receipt.
- **Legacy payment matching:** confidently matched legacy paid memberships can attach automatically. Unmatched or ambiguous legacy payments go to an admin review list/report and do not grant access until staff resolves them.
- **Legacy payment storage:** store legacy paid memberships in the same membership payment/access model as Stripe payments with a source/method discriminator such as `legacy`. Stripe-specific fields stay nullable and empty for legacy records.
- **Legacy-to-Stripe transition:** a legacy payment covers the imported/current season only and must not create a Stripe subscription or charge the member again for that covered season. Legacy-paid members should see a non-blocking dashboard/status prompt to add payment information and set up Stripe auto-renew for the next July 15 renewal. This prompt is optional and must not block current-season card issuance when the legacy payment is a confident match.
- **Pavilion card issuance:** Sailing Card numbers are assigned manually by staff at the pavilion after the user shows MIT ID or another legal ID. If the user is taking one of the three intro classes, staff assigns the card at the end of class at the pavilion. If onboarding is complete but the intro-class prerequisite is not complete, the request remains pending with copy telling the user to take the required class and that card issuance happens during/after class at the pavilion.
- **Manual card numbers:** preserve the existing card-number rule. Auto-suggested/blank issuance starts at 60 so lower numbers are not auto-assigned, but admins with card assignment permission can manually enter any positive card number as long as it is not already assigned for that card year.
- **Admin pending search:** staff need an admin surface that shows all pending Sailing Card/onboarding requests and makes it easy to find a person by name, email, or MIT ID before issuing cards at the pavilion. Search/filtering should happen with client-side JavaScript over the loaded pending rows so typing does not reload the whole page. This is a bounded admin usability requirement, not a generic search framework.
- **Cancellation:** users can turn off auto-renew in one in-app flow without a required survey step. The server sets Stripe `cancel_at_period_end=true`; optional feedback can record a reason enum and note after or alongside the primary action.
- **Subscription consent:** before Stripe Checkout, the profile membership page shows the amount due today, the July 15 renewal amount, annual auto-renew behavior, and where to turn off auto-renew. The submit button says that the user is starting paid racing membership, not just continuing.
- **Admin pricing:** admins edit app pricing records with effective dates and change reasons. Stripe Prices are immutable, so each usable price row stores the Stripe Price ID created for that amount/interval. Checkout never uses a price row until Stripe sync succeeds.
- **Admin operations:** admins can search members by name/email/card/payment/subscription status and Stripe identifiers, filter failed/past-due/cancelled records, open Stripe Dashboard links, and mark a local issue handled with an internal note without erasing the original issue status.
- **No racing/team reset surprise:** reminders go out before July 15 and explain the charge date, amount, renewal status, and cancellation link.

## Membership Policy Matrix

| User group | Normal membership cost | Paid racing/team-racing purchase path | Staff verification | Notes |
|---|---:|---|---|---|
| MIT students | $0 | Hidden and server-rejected | MIT affiliation from account/warehouse | Membership dues are covered; staff still controls ratings and team/racing requirements separately. |
| Verified MIT Recreation members | $0 | Hidden and server-rejected | `User.gymMembershipVerifiedAt` | User-facing copy says MIT Recreation membership, not gym membership. |
| Self-reported MIT Recreation members | $0 pending review | Hidden and server-rejected during onboarding | Staff verifies before issuing card | Request records `mitRecreationMembershipSelfReported=true`. |
| Verified sailing-team members | $0 | Hidden and server-rejected | `User.sailingTeamMembershipVerifiedAt` | Membership dues are covered; this does not grant ratings by itself. |
| Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, other students, MIT faculty/staff/alum/family/affiliate, other non-students, and non-MIT | Normal membership follows existing policy; paid racing/team-racing uses nonstudent age-band pricing | Visible when no free-normal rule applies | None for paid purchase | Tests cover every non-MIT-student affiliation, both paid card types, both age bands, before and after July 15. |

## Initial Paid Racing Price Catalog

Seed these amounts from the legacy racing-card rules. Admins can replace them later through the effective-dated catalog, but implementation must not infer them from the date the seed happens to run.

| Card type | Price kind | Billing interval | Under 30 | 30 or over | Notes |
|---|---|---|---:|---:|---|
| `racing` | `spring` | `one_time` | $70 | $100 | Current-season access before July 15. |
| `racing` | `full` | `one_time` | $125 | $175 | Current-season access on or after July 15. |
| `racing` | `full` | `annual` | $125 | $175 | Auto-renewal every July 15. |
| `team_racing` | `spring` | `one_time` | $70 | $100 | Legacy team-racing pricing did not use a separate full-season amount. |
| `team_racing` | `full` | `one_time` | $70 | $100 | Keep explicit so it is easy to change later. |
| `team_racing` | `full` | `annual` | $70 | $100 | Auto-renewal every July 15 unless admins replace the catalog row. |

## Copy Vocabulary

- Use "MIT Recreation membership" in user-facing copy. Keep "gym" only for internal field names that already exist.
- Use sentence case: "normal membership", "racing membership", and "team racing membership".
- Use "turn off auto-renew" for cancellation. Avoid "cancel membership" when access continues through the paid-through date.
- All pricing copy must show the amount due today, the July 15 renewal date, whether auto-renew is on, and where to turn off auto-renew.
- Pending onboarding/card copy must say that Sailing Card numbers are issued in person at the pavilion after ID check. If the intro-class prerequisite is not done, pending copy must point users to taking an intro class and explain that staff issues cards at the pavilion at the end of class.

## Schema And File-Budget Rules

- Schema PRs must edit `zenstack/schema.zmodel` first and include one migration directory. `prisma/schema.prisma` is generated; do not manually edit it. If generation changes tracked ZenStack files, include them in the PR. `src/generated/prisma/**` is ignored and regenerated locally, not committed.
- Current `AGENTS.md` does not allow schema-generation npm scripts. Before any schema PR starts, the owner must either approve adding a correct ZenStack generation script to `AGENTS.md` or run `npx zenstack generate` as a maintainer handoff. Implementation agents must not run `npm run db:generate`; that script currently only runs Prisma generation and does not regenerate `prisma/schema.prisma` from `zenstack/schema.zmodel`.
- Every PR starts with `Task 0: Confirm exact file list and budget`. Run `git diff --name-only origin/main...HEAD | wc -l` before implementation, after schema/generation handoff, after UI wiring, and before review. If the count reaches 70 or more, split before continuing; 80 changed files is the normal stop, and 100 changed files is the hard maximum.
- Do not build a generic billing framework. No barrels, no class-based service layer, and no package-like abstractions. Each module exports narrow functions used by that PR.

## PR Breakdown

### PR 1: Eligibility, Onboarding, And Public Copy

**Goal:** Make free normal membership and paid racing eligibility correct before adding subscriptions.

**Estimated changed files:** 28-40.

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260528180000_add_sailing_card_membership_eligibility_fields/migration.sql`
- Create: `src/libs/mit-sailing/sailingCardMembershipEligibility.ts`
- Create: `src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts`
- Modify: `src/libs/mit-sailing/sailingCardRequestSchema.test.ts`
- Modify: `src/libs/mit-sailing/sailingCardMembership.ts`
- Modify: `src/libs/mit-sailing/sailingCardMembership.test.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboarding.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboarding.test.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`
- Modify: `src/libs/admin/users/adminUserActions.ts`
- Modify: `src/libs/admin/users/adminUserActions.test.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/libs/mit-sailing/cmsValidation.test.ts`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`

#### Task 1.1: Add sailing-team verification to users

- [ ] **Step 0: Confirm file budget**

Confirm the exact PR 1 file list before editing. Re-run the file-count check after the schema-generation handoff and before review. Split the admin verification control into a follow-up PR if PR 1 reaches 70 changed files.

- [ ] **Step 1: Write the schema expectation**

Add to `src/libs/mit-sailing/sailingCardRequestSchema.test.ts`:

```ts
it('stores sailing team membership verification on users', () => {
  expect(compactSchema).toContain('sailingTeamMembershipVerifiedAt DateTime?');
  expect(compactSchema).toContain('@map("sailing_team_membership_verified_at")');
});

it('stores MIT Recreation self-report on sailing card requests', () => {
  expect(compactSchema).toContain('mitRecreationMembershipSelfReported Boolean @default(false)');
  expect(compactSchema).toContain('@map("mit_recreation_membership_self_reported")');
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts`

Expected: FAIL because the field is missing.

- [ ] **Step 3: Add the field**

In `zenstack/schema.zmodel`, add this field beside `gymMembershipVerifiedAt`:

```prisma
sailingTeamMembershipVerifiedAt DateTime? @map("sailing_team_membership_verified_at")
```

Add this field to `SailingCardRequest` so staff can see the pending verification state:

```prisma
mitRecreationMembershipSelfReported Boolean @default(false) @map("mit_recreation_membership_self_reported")
```

Add an index:

```prisma
@@index([sailingTeamMembershipVerifiedAt])
```

- [ ] **Step 4: Generate and run schema tests**

Maintainer handoff: run `npx zenstack generate` once `AGENTS.md` permits it or the owner runs it outside the agent loop.

Run: `npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts`

Expected: PASS.

- [ ] **Step 5: Add the admin verification action contract**

Add action tests that only admins can mutate `sailingTeamMembershipVerifiedAt`, record the current timestamp when enabled, clear it when disabled, and revalidate the user detail page. The visible admin control is implemented in Task 1.7.

#### Task 1.2: Centralize membership eligibility

- [ ] **Step 1: Write failing eligibility tests**

Create `src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts`:

```ts
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import {
  canRequestPaidRacingMembership,
  membershipAccessForSailingCardUser,
} from '@/libs/mit-sailing/sailingCardMembershipEligibility';

describe('sailing card membership eligibility', () => {
  const baseUser = {
    gymMembershipVerifiedAt: null,
    sailingAffiliation: SailingAffiliation.MIT_ALUM,
    sailingTeamMembershipVerifiedAt: null,
  };

  it('grants free normal membership to MIT students', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      })
    ).toEqual({ kind: 'free_normal', reason: 'mit_student' });
  });

  it('grants free normal membership to verified recreation members', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      })
    ).toEqual({ kind: 'free_normal', reason: 'verified_mit_recreation_membership' });
  });

  it('keeps self-reported recreation members in pending verification', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        mitRecreationMembershipSelfReported: true,
      })
    ).toEqual({ kind: 'pending_recreation_verification' });
  });

  it('grants free normal membership to verified sailing team members', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        sailingTeamMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      })
    ).toEqual({ kind: 'free_normal', reason: 'verified_sailing_team' });
  });

  it('allows paid racing only when no free normal membership applies', () => {
    expect(
      canRequestPaidRacingMembership({
        access: membershipAccessForSailingCardUser(baseUser),
        cardType: SailingCardType.racing,
      })
    ).toBe(true);
    expect(
      canRequestPaidRacingMembership({
        access: { kind: 'free_normal', reason: 'mit_student' },
        cardType: SailingCardType.racing,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the helper**

Create `src/libs/mit-sailing/sailingCardMembershipEligibility.ts`:

```ts
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';

export type SailingCardMembershipAccess =
  | { readonly kind: 'free_normal'; readonly reason: 'mit_student' | 'verified_mit_recreation_membership' | 'verified_sailing_team' }
  | { readonly kind: 'pending_recreation_verification' }
  | { readonly kind: 'paid_racing_available' };

type SailingCardMembershipUser = {
  readonly gymMembershipVerifiedAt: Date | null;
  readonly mitRecreationMembershipSelfReported?: boolean;
  readonly sailingAffiliation: SailingAffiliation | null;
  readonly sailingTeamMembershipVerifiedAt: Date | null;
};

export function membershipAccessForSailingCardUser(
  user: SailingCardMembershipUser
): SailingCardMembershipAccess {
  if (user.sailingAffiliation === SailingAffiliation.MIT_STUDENT) {
    return { kind: 'free_normal', reason: 'mit_student' };
  }
  if (user.gymMembershipVerifiedAt !== null) {
    return { kind: 'free_normal', reason: 'verified_mit_recreation_membership' };
  }
  if (user.sailingTeamMembershipVerifiedAt !== null) {
    return { kind: 'free_normal', reason: 'verified_sailing_team' };
  }
  if (user.mitRecreationMembershipSelfReported === true) {
    return { kind: 'pending_recreation_verification' };
  }
  return { kind: 'paid_racing_available' };
}

export function canRequestPaidRacingMembership(props: {
  readonly access: SailingCardMembershipAccess;
  readonly cardType: SailingCardType;
}) {
  return (
    props.access.kind === 'paid_racing_available' &&
    props.cardType !== SailingCardType.normal
  );
}
```

Add `membershipAccessForOnboardingRequest` in the same module. It accepts the verified user facts plus `mitRecreationMembershipSelfReported` and returns a free-normal pending-review access reason when the user reports MIT Recreation membership during onboarding. Server Actions and UI use this helper so self-report and verified eligibility cannot drift.

- [ ] **Step 4: Run the test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts`

Expected: PASS.

#### Task 1.3: Correct hard-coded membership pricing behavior until the pricing catalog lands

- [ ] **Step 1: Update failing pricing tests**

In `src/libs/mit-sailing/sailingCardMembership.test.ts`, replace student paid racing expectations with:

```ts
it('does not charge MIT students for sailing card membership', () => {
  expect(
    sailingCardMembershipPriceCents({
      affiliation: SailingAffiliation.MIT_STUDENT,
      cardType: SailingCardType.racing,
      dateOfBirth: '2000-01-01',
      now: new Date('2026-05-01T12:00:00.000Z'),
    })
  ).toBe(0);
  expect(
    sailingCardMembershipPriceCents({
      affiliation: SailingAffiliation.MIT_STUDENT,
      cardType: SailingCardType.team_racing,
      dateOfBirth: '2000-01-01',
      now: new Date('2026-05-01T12:00:00.000Z'),
    })
  ).toBe(0);
});
```

Add this test:

```ts
it('keeps non-MIT student affiliates on nonstudent racing pricing', () => {
  expect(
    sailingCardMembershipPriceCents({
      affiliation: SailingAffiliation.WELLESLEY,
      cardType: SailingCardType.racing,
      dateOfBirth: '2000-01-01',
      now: new Date('2026-05-01T12:00:00.000Z'),
    })
  ).toBe(7000);
});
```

Add table-driven pricing policy tests for every `SailingAffiliation` other than `MIT_STUDENT`, covering `racing` and `team_racing`, under 30 and 30 or over, before and after July 15. The expected rule is nonstudent age-band paid racing pricing for paid card types unless a verified free-normal rule applies outside this pricing helper.

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardMembership.test.ts`

Expected: FAIL where old student-affiliate pricing assumptions remain.

- [ ] **Step 3: Simplify student pricing**

In `src/libs/mit-sailing/sailingCardMembership.ts`, remove non-MIT affiliates from the internal student-price branch. Keep `MIT_STUDENT` as the only free-by-affiliation rule. Leave spring/full nonstudent prices in place until PR 2 replaces the source of truth with the pricing catalog.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/sailingCardMembership.test.ts src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts`

Expected: PASS.

#### Task 1.4: Validate onboarding card type against fitness/team/free eligibility

- [ ] **Step 1: Write failing validation tests**

In `src/libs/mit-sailing/sailingCardOnboarding.test.ts`, add:

```ts
it('rejects paid racing for MIT students', () => {
  expect(() =>
    buildSailingCardOnboardingUpdate({
      dataWarehouseIdentity: currentStudentIdentity,
      input: {
        ...validInput,
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.racing,
        hasFitnessMembership: 'yes',
      },
      now,
    })
  ).toThrow(SailingCardOnboardingValidationError);
});

it('rejects paid racing when the user reports existing MIT Recreation membership', () => {
  expect(() =>
    buildSailingCardOnboardingUpdate({
      dataWarehouseIdentity: null,
      input: {
        ...validInput,
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        hasFitnessMembership: 'yes',
      },
      now,
    })
  ).toThrow(SailingCardOnboardingValidationError);
});
```

Add coverage that verified account facts are enforced even when the UI is bypassed:

```ts
it('rejects paid racing for verified MIT Recreation members', async () => {
  await expect(
    submitSailingCardOnboarding({
      cardType: SailingCardType.racing,
      user: { gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z') },
    })
  ).rejects.toThrow(SailingCardOnboardingValidationError);
});

it('rejects paid racing for verified sailing team members', async () => {
  await expect(
    submitSailingCardOnboarding({
      cardType: SailingCardType.team_racing,
      user: { sailingTeamMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z') },
    })
  ).rejects.toThrow(SailingCardOnboardingValidationError);
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts`

Expected: FAIL because current code records `hasFitnessMembership`, but paid racing and verified sailing-team restrictions are not yet centrally rejected.

- [ ] **Step 3: Extend onboarding input and validator**

In `src/libs/mit-sailing/sailingCardOnboarding.ts`, verify the existing input includes:

```ts
readonly hasFitnessMembership: boolean | null;
```

Add or extend a helper only for input-level self-report validation:

```ts
function validateCardTypeEligibility(props: {
  readonly affiliation: SailingAffiliation;
  readonly cardType: SailingCardType;
  readonly hasFitnessMembership: boolean | null;
}) {
  if (props.cardType === SailingCardType.normal) {
    return;
  }
  if (
    props.affiliation === SailingAffiliation.MIT_STUDENT ||
    props.hasFitnessMembership === true
  ) {
    throw new SailingCardOnboardingValidationError({ cardType: 'invalid' });
  }
}
```

Call it immediately after `validateRequiredInputs`.

- [ ] **Step 4: Pass the field through the Server Action**

In `src/libs/mit-sailing/sailingCardOnboardingActions.ts`, verify `parseSailingCardOnboardingFormData` passes the existing boolean/null field through to `submitSailingCardOnboarding`; do not regress it to a string contract:

```ts
hasFitnessMembership: parseFitnessMembership(values.hasFitnessMembership),
```

In the Server Action, load the current user's `sailingAffiliation`, `gymMembershipVerifiedAt`, and `sailingTeamMembershipVerifiedAt`, then call `membershipAccessForOnboardingRequest({ verified user facts, mitRecreationMembershipSelfReported: parsed.hasFitnessMembership === true })` and `canRequestPaidRacingMembership`. Do not duplicate the central eligibility logic in the Server Action. Persist the self-reported MIT Recreation answer on `SailingCardRequest` or an adjacent request-review field so staff can see that verification is required before issuing the card. Add an action-level test that a crafted form with `hasFitnessMembership=yes` and `cardType=racing` is rejected even when the UI is bypassed.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`

Expected: PASS.

#### Task 1.5: Make onboarding choices simple and hard to misuse

- [ ] **Step 1: Write component tests for hidden paid choices**

In the onboarding form component test file, add assertions:

```ts
it('shows only normal membership after the user selects existing MIT Recreation membership', async () => {
  renderOnboardingForm({ affiliation: SailingAffiliation.MIT_ALUM });
  await user.click(screen.getByLabelText('fitness_membership_yes'));
  expect(screen.getByRole('radio', { name: /normal/i })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: /racing/i })).not.toBeInTheDocument();
});
```

Use the existing test translation helper instead of hard-coded production copy if the local test suite uses translation keys.

Add interaction and accessibility assertions:

- If a user previously selected `racing` or `team_racing` and then selects existing MIT Recreation membership, the form resets `cardType` to `normal`.
- The submitted form never includes a stale hidden paid card type after eligibility changes.
- Verified `gymMembershipVerifiedAt` and `sailingTeamMembershipVerifiedAt` users see only normal membership, because the UI receives and uses the same central eligibility state as the Server Action instead of relying only on affiliation and form state.
- The card type radio group uses `fieldset`/`legend` or equivalent accessible group labeling.
- Help and validation copy is connected with `aria-describedby`.
- Keyboard navigation still reaches the normal membership choice and submit button in order.

- [ ] **Step 2: Run the failing component test**

Run the focused onboarding component test with `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`.

Expected: FAIL because paid choices still render.

- [ ] **Step 3: Filter visible card types**

In `SailingCardOnboardingCardRequestFields.tsx`, compute visible card types from the central eligibility state, affiliation, and `hasFitnessMembership` form state. When free normal membership applies, show only `SailingCardType.normal`, reset stale paid selections to `normal`, and show concise help text that paid racing is not needed for their membership path. If the user self-reports MIT Recreation membership, show a short verification note: "Staff will verify MIT Recreation membership before issuing your card."

- [ ] **Step 4: Update copy**

In `src/locales/en.json`, update onboarding strings:

```json
"card_type_paid_not_needed": "Normal membership is the right option for you.",
"card_type_paid_not_needed_help": "Your eligibility covers membership dues. Staff will verify any racing or team requirements separately.",
"card_type_recreation_pending_help": "Choose normal membership. Staff will verify MIT Recreation membership before issuing your card.",
"fitness_membership_help": "If you already have MIT Recreation membership, choose yes and continue with normal membership.",
"fitness_membership_verification": "Staff will verify MIT Recreation membership before issuing your card.",
"fitness_membership_auto_mit_student": "MIT students already qualify for normal membership."
```

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`

Expected: PASS.

#### Task 1.6: Update public home pricing copy

- [ ] **Step 1: Update seed and locale copy**

Modify `src/data/mit-sailing/cmsSeed.ts` and `src/locales/en.json` to say:

- Normal membership is free for MIT students, verified MIT Recreation members, and verified sailing-team members.
- Paid racing membership is only for sailors who need racing access and do not already qualify for free normal membership.
- Normal membership covers dues; racing access, team racing, and ratings may still require staff approval.
- Sign in to see the current racing membership price and renewal details. Do not link to `/profile/membership` in public copy until that route exists.

Add CMS validation or locale tests that the seeded public pricing copy includes "verified MIT Recreation" and "verified sailing-team" wording so the page does not imply self-report is approval.

- [ ] **Step 2: Run i18n and CMS tests**

Run: `npm run check:i18n`

Run focused CMS validation tests: `npm run test -- src/libs/mit-sailing/cmsValidation.test.ts`

Expected: PASS.

#### Task 1.7: Add staff visibility for verification-dependent free membership

- [ ] **Step 1: Write admin/review tests**

Add focused tests for the existing sailing-card request admin or member profile surface:

- Self-reported MIT Recreation membership appears as "MIT Recreation verification needed".
- Onboarding completion and dashboard/profile status show "MIT Recreation verification needed", "No payment needed now", and "Staff will verify before issuing your card" for self-reported MIT Recreation members.
- Admins can set and clear `sailingTeamMembershipVerifiedAt`.
- A verified sailing-team member no longer sees paid racing/team-racing purchase paths.

- [ ] **Step 2: Add the smallest admin control**

Reuse the existing member/request review surface. Add an inline admin action to set or clear sailing-team verification and display the MIT Recreation self-report state for staff. Preserve the pavilion workflow by keeping pending requests easy to find: staff must be able to view all pending Sailing Card/onboarding requests and search/filter by name, email, or MIT ID before issuing a card number. Implement this as client-side filtering over the loaded pending queue so typing does not reload the admin page. Do not introduce a separate team-management system or generic search framework in this PR.

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'`

Run: `npm run check:i18n`.

Expected: PASS.

- [ ] **Step 4: Run PR 1 verification**

Run:

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts src/libs/mit-sailing/sailingCardMembership.test.ts src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts src/libs/mit-sailing/cmsValidation.test.ts src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx src/libs/admin/users/adminUserActions.test.ts 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
npm run check:i18n
```

Expected: all commands pass.

### PR 2A/2B: Billing Foundation, Pricing Catalog, And Stripe Price Sync

**Goal:** Add the local billing schema foundation, then let admins maintain effective-dated membership prices in the app and sync immutable Stripe Prices without starting paid subscriptions yet.

**Estimated changed files:** 30-45 total, implemented as two review units by default.

**Default split:** PR 2A covers schema, date helpers, pricing read helpers, and seed parity. PR 2B covers admin pricing writes/UI and Stripe Price sync. Schema + admin UI + Stripe side effects in one PR is a split trigger even if the file count is under 70.

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: `prisma/migrations/20260528181000_add_sailing_card_membership_billing/migration.sql`
- Modify: `src/libs/mit-sailing/sailingCardRequestSchema.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipBillingDates.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipBillingDates.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricing.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricing.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricingSeed.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricingSeed.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipStripePrices.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipStripePrices.test.ts`
- Create: `src/app/[locale]/(marketing)/(site)/admin/membership-prices/page.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/membership-prices/adminMembershipPricesPage.test.tsx`
- Create: `src/components/mit-sailing/admin/membership-prices/AdminMembershipPricesView.tsx`
- Create: `src/components/mit-sailing/admin/membership-prices/AdminMembershipPricesView.test.tsx`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricingActions.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPricingActions.test.ts`
- Modify: `src/locales/en.json`

#### Task 2.0: Define current racing price catalog from existing rules

- [ ] **Step 0: Confirm file budget**

Confirm the exact PR 2A schema, migration, pricing read, and test files before editing. PR 2B starts with its own file-list check for admin pricing UI/actions and Stripe Price sync.

- [ ] **Step 1: Write parity tests**

Create `src/libs/mit-sailing/membershipBilling/membershipPricingSeed.test.ts` asserting the seeded catalog matches current `sailingCardMembershipPriceCents` behavior for:

- `racing` spring and full, under 30 and 30 or over.
- `team_racing`, under 30 and 30 or over.
- June 1 and July 15 dates in US Eastern.
- Every `SailingAffiliation` except `MIT_STUDENT` uses nonstudent age-band paid racing pricing.
- The seed output is identical whether run on June 1, July 15, or any later date because spring/full rows use fixed US Eastern reference instants rather than runtime `now`.

- [ ] **Step 2: Add seed/backfill helper**

Create `membershipPricingSeed.ts` as a pure initial catalog fixture first. Do not upsert DB rows until Task 2.1 adds the billing models and generation handoff is complete. The later DB seed/backfill helper writes rows with the required change reason: "Initial catalog from legacy racing-card pricing." Do not call Stripe from this seed helper. Stripe Price sync happens only in Task 2.4. Create rows for:

- `spring` + `one_time`
- `full` + `one_time`
- `full` + `annual`

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipPricingSeed.test.ts src/libs/mit-sailing/sailingCardMembership.test.ts`

Expected: PASS.

#### Task 2.1: Add membership billing schema

- [ ] **Step 1: Write schema tests**

Add a focused schema test that expects these models/enums in generated schema:

```ts
expect(compactSchema).toContain('model SailingCardMembershipPrice');
expect(compactSchema).toContain('model SailingCardSubscription');
expect(compactSchema).toContain('model SailingCardMembershipPayment');
expect(compactSchema).toContain('model SailingCardMembershipRefund');
expect(compactSchema).toContain('model SailingCardMembershipNotification');
expect(compactSchema).toContain('enum SailingCardSubscriptionStatus');
expect(compactSchema).toContain('enum SailingCardMembershipPriceKind');
expect(compactSchema).toContain('enum SailingCardMembershipPaymentStatus');
expect(compactSchema).toContain('enum SailingCardMembershipPaymentIssueKind');
expect(compactSchema).toContain('enum SailingCardMembershipPaymentKind');
expect(compactSchema).toContain('enum SailingCardMembershipAgeBand');
expect(compactSchema).toContain('enum SailingCardMembershipBillingInterval');
expect(compactSchema).toContain('enum SailingCardMembershipCancellationReason');
expect(compactSchema).toContain('enum SailingCardMembershipNotificationKind');
expect(compactSchema).toContain('effectiveAt DateTime @map("effective_at")');
expect(compactSchema).toContain('initialMembershipPriceId String @map("initial_membership_price_id")');
expect(compactSchema).toContain('renewalMembershipPriceId String @map("renewal_membership_price_id")');
expect(compactSchema).toContain('consentAcceptedAt DateTime? @map("consent_accepted_at")');
expect(compactSchema).toContain('lastStripeSubscriptionEventId String? @map("last_stripe_subscription_event_id")');
expect(compactSchema).toContain('recipientEmail String @map("recipient_email")');
```

- [ ] **Step 2: Add schema models**

Add enums:

```prisma
enum SailingCardMembershipPriceKind {
  spring
  full
}

enum SailingCardMembershipAgeBand {
  under_30
  thirty_or_over
}

enum SailingCardMembershipBillingInterval {
  one_time
  annual
}

enum SailingCardSubscriptionStatus {
  incomplete
  incomplete_expired
  trialing
  active
  past_due
  canceled
  unpaid
}

enum SailingCardMembershipPaymentIssueKind {
  duplicate_subscription
  refunded_current_season
  disputed_current_season
}

enum SailingCardMembershipPaymentKind {
  initial_spring
  initial_full
  annual_renewal
  adjustment
}

enum SailingCardMembershipPaymentStatus {
  pending
  checkout_created
  paid
  past_due
  refunded
  disputed
  cancelled
}

enum SailingCardMembershipCancellationReason {
  not_sailing_next_season
  using_free_membership
  cost
  duplicate_or_mistake
  other
}

enum SailingCardMembershipNotificationKind {
  renewal_30_days
  renewal_14_days
  renewal_3_days
}
```

Add models:

```prisma
model SailingCardMembershipPrice {
  id String @id() @default(cuid())
  cardType SailingCardType @map("card_type")
  priceKind SailingCardMembershipPriceKind @map("price_kind")
  ageBand SailingCardMembershipAgeBand @map("age_band")
  billingInterval SailingCardMembershipBillingInterval @map("billing_interval")
  amountCents Int @map("amount_cents")
  currency String @default("usd")
  active Boolean @default(true)
  effectiveAt DateTime @map("effective_at")
  retiredAt DateTime? @map("retired_at")
  changeReason String @map("change_reason") @db.Text()
  stripePriceId String? @unique() @map("stripe_price_id")
  stripeSyncError String? @map("stripe_sync_error") @db.Text()
  stripeSyncedAt DateTime? @map("stripe_synced_at")
  createdByUserId String? @map("created_by_user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt() @map("updated_at")
  createdBy User? @relation("SailingCardMembershipPriceCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@unique([cardType, priceKind, ageBand, billingInterval, effectiveAt])
  @@index([cardType, priceKind, ageBand, billingInterval, active, effectiveAt])
  @@index([createdByUserId])
  @@map("sailing_card_membership_prices")
}

model SailingCardSubscription {
  id String @id() @default(cuid())
  userId String @unique() @map("user_id")
  currentFullPriceId String? @map("current_full_price_id")
  cardType SailingCardType @map("card_type")
  status SailingCardSubscriptionStatus
  stripeStatus String? @map("stripe_status")
  autoRenew Boolean @default(true) @map("auto_renew")
  stripeCustomerId String @map("stripe_customer_id")
  stripeSubscriptionId String @unique() @map("stripe_subscription_id")
  stripeSubscriptionItemId String? @map("stripe_subscription_item_id")
  lastStripeSubscriptionEventId String? @map("last_stripe_subscription_event_id")
  lastStripeSubscriptionEventCreatedAt DateTime? @map("last_stripe_subscription_event_created_at")
  currentPeriodStart DateTime? @map("current_period_start")
  currentPeriodEnd DateTime? @map("current_period_end")
  cancelAtPeriodEnd Boolean @default(false) @map("cancel_at_period_end")
  cancellationReason SailingCardMembershipCancellationReason? @map("cancellation_reason")
  cancellationNote String? @map("cancellation_note") @db.Text()
  cancellationRequestedAt DateTime? @map("cancellation_requested_at")
  cancelledAt DateTime? @map("cancelled_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt() @map("updated_at")
  currentFullPrice SailingCardMembershipPrice? @relation(fields: [currentFullPriceId], references: [id], onDelete: SetNull)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  payments SailingCardMembershipPayment[]
  notifications SailingCardMembershipNotification[]

  @@index([status, autoRenew])
  @@index([currentPeriodEnd])
  @@index([stripeCustomerId])
  @@map("sailing_card_subscriptions")
}

model SailingCardMembershipPayment {
  id String @id() @default(cuid())
  userId String @map("user_id")
  subscriptionId String? @map("subscription_id")
  initialMembershipPriceId String @map("initial_membership_price_id")
  renewalMembershipPriceId String @map("renewal_membership_price_id")
  activeCheckoutKey String? @unique() @map("active_checkout_key")
  cardType SailingCardType @map("card_type")
  priceKind SailingCardMembershipPriceKind @map("price_kind")
  paymentKind SailingCardMembershipPaymentKind @map("payment_kind")
  amountCents Int @map("amount_cents")
  currency String @default("usd")
  status SailingCardMembershipPaymentStatus @default(pending)
  consentShownAt DateTime? @map("consent_shown_at")
  consentAcceptedAt DateTime? @map("consent_accepted_at")
  consentLocale String? @map("consent_locale")
  consentTermsVersion String? @map("consent_terms_version")
  consentTermsSnapshot String? @map("consent_terms_snapshot") @db.Text()
  consentAmountDueTodayCents Int? @map("consent_amount_due_today_cents")
  consentRenewalAmountCents Int? @map("consent_renewal_amount_cents")
  consentRenewalAt DateTime? @map("consent_renewal_at")
  consentAutoRenewTextKey String? @map("consent_auto_renew_text_key")
  consentSubmitButtonTextKey String? @map("consent_submit_button_text_key")
  consentCancellationPathTextKey String? @map("consent_cancellation_path_text_key")
  consentTermsHash String? @map("consent_terms_hash")
  issueKind SailingCardMembershipPaymentIssueKind? @map("issue_kind")
  refundedAmountCents Int @default(0) @map("refunded_amount_cents")
  disputeStatus String? @map("dispute_status")
  stripeHostedInvoiceUrl String? @map("stripe_hosted_invoice_url") @db.Text()
  stripeInvoicePdfUrl String? @map("stripe_invoice_pdf_url") @db.Text()
  stripeRefundId String? @map("stripe_refund_id")
  stripeDisputeId String? @map("stripe_dispute_id")
  duplicateStripeSubscriptionId String? @map("duplicate_stripe_subscription_id")
  stripeCustomerId String? @map("stripe_customer_id")
  stripeCheckoutSessionId String? @unique() @map("stripe_checkout_session_id")
  stripeCheckoutSessionUrl String? @map("stripe_checkout_session_url") @db.Text()
  stripeCheckoutSessionExpiresAt DateTime? @map("stripe_checkout_session_expires_at")
  stripeSubscriptionId String? @map("stripe_subscription_id")
  stripeInvoiceId String? @map("stripe_invoice_id")
  stripeInvoiceLineItemId String? @map("stripe_invoice_line_item_id")
  stripePaymentIntentId String? @map("stripe_payment_intent_id")
  stripeChargeId String? @map("stripe_charge_id")
  lastStripePaymentEventId String? @map("last_stripe_payment_event_id")
  lastStripeInvoiceEventId String? @map("last_stripe_invoice_event_id")
  lastStripePaymentEventCreatedAt DateTime? @map("last_stripe_payment_event_created_at")
  lastStripeInvoiceEventCreatedAt DateTime? @map("last_stripe_invoice_event_created_at")
  stripeReceiptUrl String? @map("stripe_receipt_url") @db.Text()
  issueHandledNote String? @map("issue_handled_note") @db.Text()
  issueHandledByUserId String? @map("issue_handled_by_user_id")
  issueHandledAt DateTime? @map("issue_handled_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt() @map("updated_at")
  initialMembershipPrice SailingCardMembershipPrice @relation("SailingCardMembershipPaymentInitialPrice", fields: [initialMembershipPriceId], references: [id], onDelete: Restrict)
  renewalMembershipPrice SailingCardMembershipPrice @relation("SailingCardMembershipPaymentRenewalPrice", fields: [renewalMembershipPriceId], references: [id], onDelete: Restrict)
  user User @relation(fields: [userId], references: [id], onDelete: Restrict)
  subscription SailingCardSubscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  issueHandledBy User? @relation("SailingCardMembershipPaymentIssueHandledBy", fields: [issueHandledByUserId], references: [id], onDelete: SetNull)
  refunds SailingCardMembershipRefund[]
  refunds SailingCardMembershipRefund[]

  @@index([userId, createdAt])
  @@index([subscriptionId])
  @@index([initialMembershipPriceId])
  @@index([renewalMembershipPriceId])
  @@index([status, createdAt])
  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
  @@index([duplicateStripeSubscriptionId])
  @@index([stripeInvoiceId])
  @@index([stripePaymentIntentId])
  @@index([stripeChargeId])
  @@index([stripeRefundId])
  @@index([stripeDisputeId])
  @@index([issueKind, status, createdAt])
  @@index([issueKind, issueHandledAt])
  @@unique([stripeInvoiceId, stripeInvoiceLineItemId])
  @@index([issueHandledByUserId])
  @@map("sailing_card_membership_payments")
}

model SailingCardMembershipRefund {
  id String @id() @default(cuid())
  paymentId String @map("payment_id")
  stripeRefundId String @unique() @map("stripe_refund_id")
  amountCents Int @map("amount_cents")
  status String
  reason String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt() @map("updated_at")
  payment SailingCardMembershipPayment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@map("sailing_card_membership_refunds")
}

model SailingCardMembershipNotification {
  id String @id() @default(cuid())
  subscriptionId String @map("subscription_id")
  kind SailingCardMembershipNotificationKind
  recipientEmail String @map("recipient_email")
  renewalAmountCents Int? @map("renewal_amount_cents")
  renewalAt DateTime? @map("renewal_at")
  autoRenew Boolean? @map("auto_renew")
  templateVersion String @map("template_version")
  cancelLinkPath String? @map("cancel_link_path")
  providerMessageId String? @map("provider_message_id")
  deliveryError String? @map("delivery_error") @db.Text()
  sentAt DateTime? @map("sent_at")
  createdAt DateTime @default(now()) @map("created_at")
  subscription SailingCardSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, kind])
  @@map("sailing_card_membership_notifications")
}
```

- [ ] **Step 3: Run schema tests and type generation**

Add inverse relation fields for every new relation on `User` and `SailingCardMembershipPrice`, then run the maintainer-approved ZenStack generation step and the focused schema test. Include generated `prisma/schema.prisma` and any changed tracked `zenstack/**` artifacts in the PR file budget.

Expected: PASS.

#### Task 2.2: Implement July 15 billing dates

- [ ] **Step 1: Write date tests**

Create `membershipBillingDates.test.ts`:

```ts
import {
  membershipBillingAnchorForCheckout,
  membershipAccessThroughDate,
  membershipPriceKindForDate,
  nextMembershipRenewalAt,
} from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';

describe('membership billing dates', () => {
  it('uses spring pricing before July 15 Eastern', () => {
    expect(membershipPriceKindForDate(new Date('2026-07-14T20:00:00.000Z'))).toBe('spring');
    expect(membershipPriceKindForDate(new Date('2026-07-15T03:59:59.999Z'))).toBe('spring');
  });

  it('uses full pricing on July 15 Eastern', () => {
    expect(membershipPriceKindForDate(new Date('2026-07-15T04:00:00.000Z'))).toBe('full');
  });

  it('anchors spring checkout to the next July 15 Eastern', () => {
    expect(
      membershipBillingAnchorForCheckout(new Date('2026-05-01T12:00:00.000Z')).toISOString()
    ).toBe('2026-07-15T04:00:00.000Z');
  });

  it('anchors purchases on or after July 15 to the following July 15 renewal', () => {
    expect(
      membershipBillingAnchorForCheckout(new Date('2026-07-16T12:00:00.000Z')).toISOString()
    ).toBe('2027-07-15T04:00:00.000Z');
  });

  it('returns access-through and next-renewal dates for profile copy', () => {
    expect(nextMembershipRenewalAt(new Date('2026-12-01T12:00:00.000Z')).toISOString()).toBe(
      '2027-07-15T04:00:00.000Z'
    );
    expect(membershipAccessThroughDate(new Date('2027-07-14T12:00:00.000Z'))).toBe(
      '2027-07-14'
    );
  });
});
```

- [ ] **Step 2: Implement date helpers**

Create `membershipBillingDates.ts` using `EVENTS_TIME_ZONE` and the existing date-only helpers from sailing-card validity where possible. Return Unix seconds for Stripe only at the Checkout boundary; keep internal helpers as `Date`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipBillingDates.test.ts`

Expected: PASS.

#### Task 2.3: Implement pricing catalog reads and admin writes

- [ ] **Step 1: Write pricing tests**

Create `membershipPricing.test.ts` covering:

- Active full racing under-30 price is selected on/after July 15.
- Active spring racing under-30 price is selected before July 15.
- Before July 15, checkout pricing returns both the spring price due today and the full renewal price due on July 15.
- Spring age band is calculated from the purchase date. Full-renewal age band is calculated from the July 15 billing anchor, including a date of birth that crosses age 30 between purchase and July 15, a birthday exactly on July 15 Eastern, and birthdays one day before and after the anchor.
- Age band is computed from the relevant US Eastern calendar date; `thirty_or_over` starts on the 30th birthday. Include tests for birthdays on July 15 and July 16, plus UTC times that cross Eastern midnight.
- Inactive prices are ignored.
- Future `effectiveAt` prices are ignored until their effective date.
- Retired prices are ignored after `retiredAt`.
- Future price changes keep the current checkout price active until `effectiveAt`.
- Price changes create a new active row and set the previous matching row's `retiredAt` to the new row's `effectiveAt`, not to the write time.
- Duplicate effective dates and overlapping active rows for the same card type, price kind, age band, and billing interval fail validation before checkout selection can become ambiguous.
- Existing payments keep their initial and renewal price IDs, amount, and currency snapshot after later price changes.
- Invalid amounts below Stripe minimum return field error.
- Blank price-change reasons fail validation.

- [ ] **Step 2: Implement pricing helpers**

Create `membershipPricing.ts` with:

```ts
export function membershipAgeBandForDateOfBirth(props: {
  readonly dateOfBirth: string;
  readonly now: Date;
}): SailingCardMembershipAgeBand;

export async function getActiveMembershipPrice(options: {
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly dateOfBirth: string;
  readonly now: Date;
  readonly priceKind: SailingCardMembershipPriceKind;
}): Promise<SailingCardMembershipPrice | null>;

export async function getCheckoutMembershipPrices(options: {
  readonly cardType: SailingCardType;
  readonly dateOfBirth: string;
  readonly now: Date;
}): Promise<{
  readonly dueTodayPrice: SailingCardMembershipPrice;
  readonly renewalPrice: SailingCardMembershipPrice;
} | null>;

export async function replaceActiveMembershipPrice(options: {
  readonly amountCents: number;
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly changeReason: string;
  readonly createdByUserId: string;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly ageBand: SailingCardMembershipAgeBand;
  readonly effectiveAt: Date;
}): Promise<SailingCardMembershipPrice>;
```

Use the existing sailing-card date-only parser before age-band math; do not construct age bands from arbitrary JavaScript `Date` values. Use a transaction for retiring the previous matching row at the new row's `effectiveAt` plus creating the new row. Do not call Stripe from this helper. Keep historical rows for audit and reminders; never mutate amount/currency on a row that may already be referenced by a payment or subscription.

- [ ] **Step 3: Add admin pricing UI**

Create a compact admin page that lists active prices by card type, price kind, and age band. The edit form uses native number inputs, preserves dollars-to-cents conversion server-side, and shows the Stripe Price sync state.

The default admin page shows current active prices and sync state first. Retired/history rows and "subscriptions still using an older full-season Stripe Price" diagnostics live behind a history/details disclosure with a link to the filtered membership payments page. Pricing forms use dollar-prefix inputs, server-rendered cents preview, effective-date preview, a "will replace current price on {date}" summary, and disabled save until amount, effective date, and reason are valid. If a new row has not synced to Stripe, show that checkout will not use it until Stripe sync succeeds and that the previous synced price remains the checkout price.

- [ ] **Step 4: Add admin pricing action tests**

Create `src/libs/mit-sailing/membershipBilling/membershipPricingActions.test.ts` covering:

- non-admin users cannot replace prices
- dollars are converted to integer cents server-side
- `changeReason` is required
- `effectiveAt` must be a valid future-or-current date in US Eastern
- the previous matching row is retired inside the same transaction
- duplicate effective dates and overlapping active rows for the same price key are rejected
- `createdByUserId` is stored
- synced rows cannot have `stripePriceId`, amount, currency, billing interval, card type, price kind, or age band edited in place
- manual Stripe Price ID entry is rejected

Implement `membershipPricingActions.ts` as thin Server Actions that call the pricing helper after authorization and validation.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipPricing.test.ts src/libs/mit-sailing/membershipBilling/membershipPricingActions.test.ts`

Expected: PASS.

#### Task 2.4: Implement Stripe Price sync

- [ ] **Step 1: Write Stripe sync tests**

In `membershipPricing.test.ts` or a separate `membershipStripePrices.test.ts`, mock Stripe and assert:

- Existing `stripePriceId` is reused.
- Missing `stripePriceId` creates a Stripe recurring annual Price for `full` + `annual` prices.
- Missing `spring` + `one_time` and `full` + `one_time` prices create one-time Stripe Prices.
- Product names and Price nicknames/descriptions render clearly in Checkout for spring current-season access and annual July 15 renewal.
- Price creation uses `idempotencyKey: membership-price-sync-${price.id}` and stable lookup keys, so retrying sync does not create duplicate usable Prices.
- The local row is updated with the Stripe Price ID.
- Stripe sync failure keeps the row visible to admins with `stripeSyncError` and no `stripeSyncedAt`.
- Checkout selection helpers only return rows with a non-null `stripePriceId` and no sync error.
- Sync does not replace Stripe Prices on historical rows that already have `stripePriceId`.

- [ ] **Step 2: Implement sync helper**

Create a helper that accepts a Stripe client dependency and creates immutable Prices with metadata:

```ts
metadata: {
  domain: 'sailing_card_membership',
  appPriceId: price.id,
  cardType: price.cardType,
  priceKind: price.priceKind,
  ageBand: price.ageBand,
  billingInterval: price.billingInterval,
}
```

Use annual recurring interval only for `full` + `annual` prices. Reuse a small set of Stripe Products per card type, with names such as "MIT Sailing racing membership" and "MIT Sailing team racing membership"; use Price nicknames or product data that Checkout actually displays, such as "Spring racing membership through July 14" and "Annual racing membership renewal every July 15." Admin pricing can create a local row before Stripe succeeds, but the admin UI must show it as "not ready" and Checkout must not use it until `stripePriceId` and `stripeSyncedAt` are present.

- [ ] **Step 3: Run PR 2 verification**

Run:

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts src/libs/mit-sailing/membershipBilling/membershipBillingDates.test.ts src/libs/mit-sailing/membershipBilling/membershipPricingSeed.test.ts src/libs/mit-sailing/membershipBilling/membershipPricing.test.ts src/libs/mit-sailing/membershipBilling/membershipStripePrices.test.ts src/libs/mit-sailing/membershipBilling/membershipPricingActions.test.ts src/components/mit-sailing/admin/membership-prices/AdminMembershipPricesView.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/membership-prices/adminMembershipPricesPage.test.tsx'
npm run check:i18n
```

Expected: all commands pass.

### PR 3: Stripe Webhook Dispatcher Hardening

**Goal:** Refactor the existing Stripe webhook processor so event payments and membership billing can share idempotent event claiming without one domain consuming events needed by another.

**Estimated changed files:** 8-14.

**Files:**
- Modify: `src/libs/stripe/stripeWebhookEvents.ts`
- Modify: `src/libs/stripe/stripeWebhookEvents.test.ts`
- Modify: `src/app/api/stripe/webhooks/route.ts`
- Modify: `src/app/api/stripe/webhooks/route.test.ts`

#### Task 3.1: Refactor webhook dispatch without changing event-payment behavior

- [ ] **Step 1: Write dispatcher regression tests**

Add tests proving duplicate Stripe event IDs remain idempotent, existing event-payment receipt behavior still works, and non-event-payment Stripe events are not marked processed before the membership domain can handle them. Because real membership handlers land later, add a fake second-domain handler test plus an all-unhandled test so the dispatcher contract is verified before membership code exists. Add partial-failure tests where the first domain handler succeeds, the second domain handler throws, the Stripe event remains retryable, and retrying does not duplicate the first handler's side effects.

- [ ] **Step 2: Implement the dispatcher seam**

Keep this PR limited to the webhook route, existing event-payment handler extraction, dispatcher result shape, and tests. Do not add membership subscription models or membership webhook handlers in this PR.

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/libs/stripe/stripeWebhookEvents.test.ts src/app/api/stripe/webhooks/route.test.ts`

Expected: PASS.

### PR 4A: Subscription Checkout, Profile Billing, And Billing Portal

**Goal:** Let eligible users choose paid racing or team racing, start the subscription through Stripe Checkout, and manage payment method/invoices through Stripe Portal. Membership webhooks and cancellation move to PR 4B so review stays small.

**Estimated changed files:** 24-36.

**Files:**
- Create: `src/libs/mit-sailing/membershipBilling/membershipStripeCustomers.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipStripeCheckout.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipStripeCheckout.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipSubscriptions.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipSubscriptions.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipBillingPortalActions.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipBillingPortalActions.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.test.ts`
- Create: `src/app/[locale]/(auth)/profile/membership/page.tsx`
- Create: `src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.ts`
- Create: `src/components/mit-sailing/profile/ProfileMembershipBillingView.tsx`
- Create: `src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx`
- Create: `src/app/[locale]/(auth)/profile/membership/profileMembershipPage.test.tsx`
- Modify: `src/libs/Env.ts`
- Modify: `src/app/[locale]/(auth)/layout.tsx`
- Modify: `src/app/[locale]/(auth)/profile/layout.tsx`
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/locales/en.json`

#### Task 4A.0: Confirm file budget

- [ ] **Step 1: Confirm exact file paths**

Before editing, confirm the listed route, action, component, navigation, and test files still match the current code. If navigation requires touching more than the two listed layout files, split navigation into the PR 4B follow-up instead of expanding PR 4A.

#### Task 4A.1: Implement subscription state helpers

- [ ] **Step 1: Write subscription-state tests**

Create `src/libs/mit-sailing/membershipBilling/membershipSubscriptions.test.ts` covering active, trialing, incomplete, past-due, cancel-at-period-end, canceled, and duplicate-completion profile states. Include canonical active subscription selection, duplicate Stripe subscription completion recorded on the pending payment as `issueKind: duplicate_subscription` with `duplicateStripeSubscriptionId`, and the "paid renewal may be unnecessary" state when free-normal eligibility appears on a user with an active paid subscription.

- [ ] **Step 2: Implement subscription helpers**

Create `membershipSubscriptions.ts` with small helpers for profile state mapping, canonical active subscription lookup, and duplicate-completion issue recording. Checkout and webhooks must call these helpers instead of re-implementing subscription state rules.

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipSubscriptions.test.ts`

Expected: PASS.

#### Task 4A.2: Build membership Checkout creation

- [ ] **Step 1: Write Checkout tests**

Create `membershipStripeCheckout.test.ts` asserting:

- Before July 15 and more than 48 hours before the July 15 anchor, the Checkout Session is `mode: 'subscription'`, includes the full annual renewal Price and the spring one-time Price, and sets `subscription_data.trial_end` to the July 15 Unix timestamp. Do not set `subscription_data.billing_cycle_anchor`, and do not pass proration behavior in this Checkout shape unless Stripe test mode proves the parameter combination is supported.
- Before July 15, the Stripe test asserts the initial invoice total equals only the spring one-time amount and that no recurring full-season charge or proration is due before July 15 in US Eastern.
- Within 48 hours of July 15, Checkout uses an explicit fallback: either a two-step one-time Checkout plus server-created July 15 subscription/schedule after successful payment, or a blocked/rerouted flow with approved copy that tells the user to return after the rollover. Add tests at exactly 48 hours, 47 hours 59 minutes, and July 15 00:00 Eastern.
- On/after July 15, the Checkout Session includes the full annual renewal Price and the full one-time current-season Price, and sets `subscription_data.trial_end` to the following July 15 so the first renewal remains anchored to July 15 instead of the Checkout anniversary.
- Stripe Product/Price display names distinguish "Spring racing membership through July 14" from "Annual racing membership renewal every July 15" in Checkout.
- The selected `cardType` can be `racing` or `team_racing`, and each path uses the correct active Price.
- Metadata includes `userId`, local payment ID, initial local price ID, renewal local price ID, and domain `sailing_card_membership`.
- Checkout Session metadata and `subscription_data.metadata` both include `domain`, `userId`, `localPaymentId`, `initialMembershipPriceId`, and `renewalMembershipPriceId`, so `invoice.paid` can link through subscription metadata even when it arrives before `checkout.session.completed`.
- The request uses `subscription_data.trial_end` as the July 15 anchor and does not set `subscription_data.billing_cycle_anchor`. Assert `billing_cycle_anchor` is absent in request-construction tests.
- Checkout creation records a consent snapshot before redirecting to Stripe: shown time, accepted time, terms version, amount due today, renewal amount, renewal date, selected card type, submit button text key, cancellation path text key, auto-renew disclosure key, and a stable hash or key set for the displayed terms.
- Free-normal users cannot create Checkout.
- Users with pending current-year or latest `mitRecreationMembershipSelfReported` status cannot create Checkout; profile copy shows "MIT Recreation verification needed" until staff verifies or clears the request.
- Users with active subscriptions, cancel-at-period-end subscriptions, or incomplete pending Checkout sessions cannot start a duplicate purchase; the page routes them to manage the current membership.
- Two rapid Checkout submissions for the same user/card type/season/initial price/renewal price reuse one pending local membership payment/session path, enforced by `activeCheckoutKey`. The second request rereads the existing row and returns its stored non-expired `stripeCheckoutSessionUrl`.
- If a second Stripe subscription somehow completes, the pure subscription-state helper identifies the existing canonical `SailingCardSubscription` and returns a duplicate-completion result. PR 4B webhook handling records the duplicate and neutralizes the extra Stripe subscription.
- Initial spring/full one-time charges and later annual renewals create distinct local payment rows by `paymentKind`; invoice handlers store `stripeInvoiceLineItemId` when Stripe provides it so admins can reconcile multi-line invoices.

- [ ] **Step 2: Implement customer lookup**

Create `membershipStripeCustomers.ts` following Cal.com’s shape but using a real column or membership subscription row, not arbitrary JSON metadata:

```ts
export async function getOrCreateMembershipStripeCustomer(options: {
  readonly email: string;
  readonly name: string | null;
  readonly stripe: Stripe;
  readonly userId: string;
}): Promise<string>;
```

Prefer a stored customer ID from the latest subscription/payment. Fall back to Stripe customer search by email only when no local customer exists, then store the customer ID on the local payment/subscription created in the transaction.

- [ ] **Step 3: Implement Checkout helper**

Create `membershipStripeCheckout.ts`:

```ts
export async function createMembershipCheckoutSession(options: {
  readonly cardType: SailingCardType;
  readonly locale: string;
  readonly now: Date;
  readonly returnUrl: string;
  readonly stripe?: Stripe;
  readonly userId: string;
}): Promise<{ readonly url: string } | null>;
```

Use the existing `getStripeClient`, `Env.NEXT_PUBLIC_APP_URL`, and event-payment idempotency style. Split Checkout tests into three bites: date/price selection, pending payment/session idempotency, and Stripe Checkout request construction. Create or reuse a pending `SailingCardMembershipPayment` in a transaction before calling Stripe, store the accepted initial and renewal price IDs, amount due today, currency, card type, price kind, payment kind, `activeCheckoutKey`, `stripeCheckoutSessionUrl`, and `stripeCheckoutSessionExpiresAt` locally, then use the local payment ID as the Stripe idempotency-key source and metadata value. Store the metadata on both the Checkout Session and `subscription_data.metadata`. Store `stripeSubscriptionItemId` on webhook completion in PR 4B so future price changes can update active auto-renew subscriptions before renewal with `proration_behavior: 'none'`.

The implementation must prove in Stripe test mode that spring Checkout does not create a prorated recurring charge before July 15. If Checkout Session parameters cannot express that safely, switch this task to a two-step flow: one-time Checkout for spring/full access plus a server-created subscription anchored to July 15 after successful payment. Do not ship a path where the initial invoice can include both spring and annual charges.

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipStripeCheckout.test.ts`

Expected: PASS.

#### Task 4A.3: Add user-facing membership subscription page

- [ ] **Step 1: Add route and action tests**

Add tests that assert:

- Eligible users see the paid racing call to action with amount and July 15 renewal date.
- July 14 Eastern, July 15 00:00 Eastern, and after-July-15 component tests show the correct amount due today, next renewal date, and next renewal amount.
- Before Checkout, consent copy includes: "Today: {springAmount}", "Renews automatically on July 15, 2026 for {fullAmount}", "Then renews every July 15 until auto-renew is off", and "Turn off auto-renew from Profile > Membership before the renewal date."
- On and after July 15, consent copy includes: "Today: {fullAmount}" and the next July 15 renewal amount/date.
- The primary button says "Continue to Stripe and start paid racing membership" or the team racing equivalent for the selected card type.
- Eligible users can choose `racing` or `team_racing` when both paid options are available.
- Free-normal users see current eligibility and no paid Checkout button.
- Submitted Checkout action redirects to Stripe URL.
- The saved consent acceptance snapshot exactly matches the terms block shown before the member leaves for Stripe, including amount, renewal date, auto-renew text, cancellation path, selected card type, and submit button text.
- The profile/dashboard and onboarding completion state link to `/profile/membership`.
- No user-facing onboarding or profile surface displays stale one-time racing prices from `sailingCardMembershipPriceCents` after this PR. Onboarding completion links eligible paid users to `/profile/membership` and can pass/preselect the requested paid card type without showing the old price card as the payment path.
- Public/home copy updates after the membership route exists: authenticated users can go directly to membership details, and unauthenticated users are sent through sign-in with a redirect back to membership details.
- The page has clear states for free-normal, eligible unpaid, active, cancel-at-period-end, past-due, and canceled users.
- If free-normal eligibility appears on a user with an active paid subscription, the page flags that paid renewal may be unnecessary. PR 4B adds the one-step turn-off-auto-renew flow.
- Past-due/unpaid states show failed payment status, amount due if known, payment-method portal action, and whether racing access is still active or blocked.
- Public home pricing copy is updated after this route exists to link authenticated users to `/profile/membership` and say: "Sign in to check your eligibility, price, and renewal date."

State hierarchy for the profile page:

| State | Top status | Primary action |
|---|---|---|
| `free_normal` | "Normal membership is covered." | None unless another profile task is pending. |
| `eligible_unpaid` | "Paid racing membership is available." | Continue to Stripe. |
| `active_paid` | "Paid racing membership is active through {date}." | Update payment method or invoice action; cancellation arrives in PR 4B. |
| `free_normal_active_paid` | "Paid renewal may be unnecessary." | PR 4B turn-off-auto-renew action. |
| `past_due` | "Payment needs attention." | Update payment method. |
| `canceled` | "Auto-renew is off." | Restart paid racing membership only when eligible. |

- [ ] **Step 2: Create page/action/component**

Use:

- `src/app/[locale]/(auth)/profile/membership/page.tsx`
- `src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.ts`
- `src/components/mit-sailing/profile/ProfileMembershipBillingView.tsx`

Keep copy short:

- amount due today
- next renewal date
- next renewal amount
- auto-renew disclosure
- cancellation link location
- access-through date
- renewal status for active subscribers; the `Turn off auto-renew` action is added in PR 4B

Use a radio group or segmented control for paid card type selection. The terms shown beside the primary Checkout button must update when the selected card type changes.

`ProfileMembershipBillingView` layout rule: top status summary, one primary action, one compact "Today / Renews / Auto-renew" terms block, then secondary payment-method and invoice actions. If only one paid card type is available, do not show a selector. Add tests for fieldset/legend or equivalent group labels, visible labels, `aria-describedby` for help/errors, disabled/loading submit state, and keyboard order through card type, reason, note, and submit. Add mobile-width render assertions for single-column stacking, no unintended horizontal scrolling, and no broken button wrapping.

Use `useActionState` only where the component needs inline server validation errors.

- [ ] **Step 3: Add billing portal action**

Create `membershipBillingPortalActions.ts` with one Server Action that creates a Stripe Billing Portal session for the stored customer ID and returns to `/profile/membership`. Use a dedicated membership portal configuration ID from `Env` that disables subscription cancellation and plan changes, while allowing payment-method and invoice recovery. Keep auto-renew cancellation in the MIT Sailing page so the cancellation reason is recorded locally. Add tests that the portal session passes the configuration ID, does not pass `flow_data` for subscription cancel/update, and uses a fixed safe return path. Add a small admin diagnostic or health-check helper that retrieves the configured portal settings in Stripe test mode and flags cancellation/plan-change drift.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx 'src/app/[locale]/(auth)/profile/membership/profileMembershipPage.test.tsx' src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.test.ts src/libs/mit-sailing/membershipBilling/membershipBillingPortalActions.test.ts`

Run: `npm run check:i18n`.

Expected: PASS.

#### Task 4A.4: Run PR 4A verification

- [ ] **Step 1: Run commands**

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/membershipBilling/membershipStripeCheckout.test.ts src/libs/mit-sailing/membershipBilling/membershipSubscriptions.test.ts src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.test.ts src/libs/mit-sailing/membershipBilling/membershipBillingPortalActions.test.ts src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx 'src/app/[locale]/(auth)/profile/membership/profileMembershipPage.test.tsx'
npm run check:i18n
```

Expected: all commands pass.

### PR 4B: Membership Webhooks And Cancellation

**Goal:** Sync Stripe subscription/payment lifecycle into local membership state and give users one-step in-app auto-renew cancellation.

**Estimated changed files:** 18-30.

**Files:**
- Create: `src/libs/mit-sailing/membershipBilling/membershipWebhookEvents.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipWebhookEvents.test.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipCancellationActions.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipCancellationActions.test.ts`
- Modify: `src/components/mit-sailing/profile/ProfileMembershipBillingView.tsx`
- Modify: `src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx`
- Modify: `src/app/api/stripe/webhooks/route.ts`
- Modify: `src/app/api/stripe/webhooks/route.test.ts`
- Modify: `src/locales/en.json`

#### Task 4B.0: Confirm file budget

- [ ] **Step 1: Confirm exact file paths**

Before editing, list the exact webhook, cancellation action, profile component, route, and test files. Split cancellation UI from webhook sync if PR 4B reaches 70 changed files.

#### Task 4B.1: Sync Stripe webhooks into local subscription/payment state

- [ ] **Step 1: Write webhook tests**

Extend `src/app/api/stripe/webhooks/route.test.ts` and add `membershipWebhookEvents.test.ts` for:

- `checkout.session.completed` creates or links `SailingCardSubscription`.
- Spring Checkout creates a local subscription with Stripe status `trialing`; racing access is active only when the spring one-time payment is paid.
- `customer.subscription.updated` updates status, period dates, and cancellation flags.
- `customer.subscription.deleted` marks subscription canceled.
- `invoice.paid` records paid membership payment.
- `invoice.payment_failed` marks payment/subscription past due.
- `invoice.paid` arriving before `checkout.session.completed` can upsert/link by Stripe subscription ID, customer ID, Checkout metadata, and invoice subscription metadata.
- `customer.subscription.updated` arriving before `checkout.session.completed` does not lose the subscription state and is reconciled after Checkout completion.
- Stale Stripe events are ignored using `event.created` and the stored `lastStripeSubscriptionEventCreatedAt`, `lastStripePaymentEventCreatedAt`, or `lastStripeInvoiceEventCreatedAt` field for the relevant Stripe object. Store the matching `lastStripeSubscriptionEventId`, `lastStripePaymentEventId`, or `lastStripeInvoiceEventId`, and add same-timestamp/event-id replay tests.
- Initial spring invoice updates the existing pending payment; later renewal invoices create new full-price payments from the recurring subscription item Price.
- `charge.refunded`, `refund.updated`, and `charge.dispute.*` update membership payments to terminal refunded/disputed states.
- Partial refunds update `refundedAmountCents` without marking the whole payment refunded until the full amount is refunded.
- `charge.dispute.closed` records dispute outcome in `disputeStatus` so admins can distinguish won, lost, warning, and closed disputes.
- Refunding or disputing the current-season payment blocks racing access, marks the payment issue for admin review, and does not leave the member silently active.
- `membershipSubscriptions.test.ts` proves refunded, fully refunded, disputed, and lost-dispute current-season payments return a non-active racing access/profile state and are queryable in admin issue filters.
- Duplicate Stripe event IDs are idempotent through existing `StripeWebhookEvent`.
- `customer.subscription.updated` is not marked processed by an event-payment no-op before membership handling runs.
- `checkout.session.expired` clears `activeCheckoutKey` and marks the pending payment canceled without touching active subscriptions.
- A non-canonical duplicate Stripe subscription is immediately canceled or set to `cancel_at_period_end=true`, the Stripe outcome is recorded, and any duplicate initial charge is flagged for refund/admin review.

- [ ] **Step 2: Implement membership webhook handler**

Create `membershipWebhookEvents.ts` with small event-specific handlers. Use the PR 3 dispatcher, add the membership handler, and register it beside the existing event-payment handler. Do not refactor existing event-payment behavior beyond the integration point. Do not let a domain no-op consume an event that another domain still needs.

- [ ] **Step 3: Run webhook tests**

Run:

```bash
npm run test -- src/app/api/stripe/webhooks/route.test.ts src/libs/mit-sailing/membershipBilling/membershipWebhookEvents.test.ts
```

Expected: PASS.

#### Task 4B.2: Add cancellation flow

- [ ] **Step 1: Write cancellation tests**

Add tests for:

- The primary `Turn off auto-renew` action works without requiring a reason.
- Optional feedback reason and note are stored when provided.
- Active subscription sets `cancel_at_period_end=true`.
- Local `autoRenew=false`, reason, note, `cancellationRequestedAt`, and access-through date are stored.
- Users cannot cancel another user's subscription.
- The profile page shows "Auto-renew is off", the access-through date, and that the user will not be charged on July 15 unless auto-renew is restarted.
- The `Turn off auto-renew` action is visible on `/profile/membership` without opening Stripe or a modal.
- `/profile/membership?focus=auto-renew` focuses the cancellation heading or form, the button has an accessible name, optional feedback is grouped with `fieldset`/`legend`, success focus moves to the confirmation, and errors use an announced alert.
- Stripe update failure leaves `autoRenew=true` locally and shows an inline error.
- A later `customer.subscription.updated` webhook reconciles local cancellation fields when Stripe succeeds outside the app.
- A later `customer.subscription.updated` with `cancel_at_period_end=false` after a prior cancellation restart makes the profile/admin status show auto-renew on. Historical cancellation reason/note remain audit fields and are not displayed as the current status.

- [ ] **Step 2: Implement action and UI**

Add a simple in-app form on the membership profile page. Reason enum values:

```ts
'not_sailing_next_season' | 'using_free_membership' | 'cost' | 'duplicate_or_mistake' | 'other'
```

Do not add retention offers or multi-step cancellation. After success, show status, access-through date, and the next charge suppression clearly.

Acceptance criteria:

- The action is visible on the membership page whenever auto-renew is on.
- The first click path can complete without a required reason. If feedback is shown inline, the reason select/radio group and note are optional.
- The button text is direct: "Turn off auto-renew".
- There is no second confirmation step.
- Success copy shows the exact access-through date.
- If the user becomes eligible for free normal membership while a paid subscription is active, the membership page and admin view flag that paid renewal may be unnecessary and offer the same one-step auto-renew cancellation path.

- [ ] **Step 3: Run PR 4B verification**

Run:

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/membershipBilling/membershipWebhookEvents.test.ts src/libs/mit-sailing/membershipBilling/membershipCancellationActions.test.ts src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx src/app/api/stripe/webhooks/route.test.ts
npm run check:i18n
```

Expected: all commands pass.

### PR 5: Admin Payment Operations And Search

**Goal:** Give staff a clear operational surface for membership payments and payment issues after subscriptions exist.

**Estimated changed files:** 24-36.

**Files:**
- Create: `src/libs/admin/membershipPayments/adminMembershipPaymentQueries.ts`
- Create: `src/libs/admin/membershipPayments/adminMembershipPaymentQueries.test.ts`
- Create: `src/components/mit-sailing/admin/membership-payments/AdminMembershipPaymentsView.tsx`
- Create: `src/components/mit-sailing/admin/membership-payments/AdminMembershipPaymentsView.test.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/membership-payments/page.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/membership-payments/adminMembershipPaymentsPage.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/page.tsx`
- Modify: `src/locales/en.json`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPaymentActions.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipPaymentActions.test.ts`

#### Task 5.1: Add admin membership-payment search query

- [ ] **Step 0: Confirm PR file budget**

Before implementation, enumerate the exact query, action, route, component, and test files expected for PR 5. Run `git diff --name-only origin/main...HEAD | wc -l` after the query/page work and before remediation. If the count is approaching 80, split admin query and remediation into separate PRs instead of widening PR 5.

- [ ] **Step 1: Write query tests**

Create `adminMembershipPaymentQueries.test.ts` covering filters:

- query by member name/email
- query by Stripe customer, subscription, Checkout session, invoice, PaymentIntent, and charge IDs
- card type
- subscription status
- payment status
- auto-renew on/off
- cancellation reason/date
- card year / renewal date
- failed/past-due only
- refunded/disputed current-season issues by `issueKind`, `refundedAmountCents`, `disputeStatus`, refund ID, and dispute ID
- local helper behavior for `parseAdminMembershipPaymentFilters`, `membershipPaymentSearchWhere`, `membershipPaymentIssueForRow`, and selecting the matched or issue payment when it is not the latest payment
- pagination and deterministic sort order

- [ ] **Step 2: Implement query module**

Return rows with:

```ts
{
  id,
  user: { id, name, email, sailingCardNumber, sailingCardYear },
  subscription: { status, autoRenew, currentPeriodEnd, cancelAtPeriodEnd, cancellationReason, cancellationNote, cancellationRequestedAt, stripeCustomerId, stripeSubscriptionId },
  latestPayment: { status, amountCents, createdAt, updatedAt, stripeCustomerId, stripeCheckoutSessionId, stripeSubscriptionId, duplicateStripeSubscriptionId, stripeInvoiceId, stripePaymentIntentId, stripeChargeId, stripeHostedInvoiceUrl, stripeInvoicePdfUrl, stripeReceiptUrl, stripeRefundId, stripeDisputeId, issueKind, refundedAmountCents, disputeStatus, issueHandledAt, issueHandledNote, issueHandledBy: { id, name, email } | null },
  matchedPayment: { status, amountCents, createdAt, stripeCustomerId, stripeSubscriptionId, stripeInvoiceId, stripePaymentIntentId, stripeChargeId, issueKind } | null,
  issue: 'past_due' | 'failed_payment' | 'cancelled_renewal' | 'duplicate_subscription' | 'refunded_current_season' | 'disputed_current_season' | null,
}
```

Keep the filter parser, Prisma `where` builder, and issue derivation as small local helpers in `adminMembershipPaymentQueries.ts`. Do not introduce a reusable generic search framework.

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/libs/admin/membershipPayments/adminMembershipPaymentQueries.test.ts`

Expected: PASS.

#### Task 5.2: Build admin membership payments page

- [ ] **Step 1: Add route and component**

Use the existing admin payments ledger visual pattern: health summary, compact filters, dense list/table rows, Stripe links, and empty state. Avoid nested cards. Include Stripe Dashboard links for customer, subscription, Checkout session, invoice, payment, charge, hosted invoice, invoice PDF, receipt, refund, and dispute when present.

- [ ] **Step 2: Add admin index link**

Add "Membership payments" to `src/app/[locale]/(marketing)/(site)/admin/page.tsx` with a short blurb.

- [ ] **Step 3: Add i18n keys**

Add `AdminMembershipPayments` namespace in `src/locales/en.json`.

- [ ] **Step 4: Run UI/i18n tests**

Run: `npm run test -- src/components/mit-sailing/admin/membership-payments/AdminMembershipPaymentsView.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/membership-payments/adminMembershipPaymentsPage.test.tsx'`

Run: `npm run check:i18n`.

Expected: PASS.

#### Task 5.3: Add payment issue remediation

- [ ] **Step 1: Write action tests**

Create tests asserting:

- Marking an issue handled requires an internal note.
- Admin user ID and handled timestamp are recorded in `issueHandledByUserId` and `issueHandledAt`.
- The original payment `status` remains `past_due`, `disputed`, or the relevant issue state after handling.
- Paid/refunded terminal states cannot be marked handled.
- Handled rows still show the original issue type, who handled it, and the note.
- The action revalidates admin membership payment pages.
- `refreshMembershipPaymentFromStripe` updates local subscription status, latest invoice/payment status, and Stripe identifiers without writing handled notes or actor fields.
- `markMembershipPaymentIssueHandled` writes only the handled note, actor, timestamp, and revalidation side effects without mutating Stripe-derived status or IDs.
- non-admin users cannot call `refreshMembershipPaymentFromStripe` or `markMembershipPaymentIssueHandled`, and the admin route denies non-admin access.

- [ ] **Step 2: Implement action**

Create `membershipPaymentActions.ts` mirroring `eventPayments.ts` manual handled transitions, but do not change `status` to `handled`. Keep state transitions explicit and throw `TypeError` for invalid domain transitions. Split the implementation into two narrow actions, `refreshMembershipPaymentFromStripe` and `markMembershipPaymentIssueHandled`; do not build a generalized reconciliation framework in this PR.

- [ ] **Step 3: Wire action into admin page**

Each issue row shows core status by default. Stripe artifacts, refresh action, and remediation fields live in an inline per-row disclosure/action area. Only the active row shows the note field. No modal for the first version. Add tests for `aria-expanded`, unique disclosure labels such as "Show Stripe details for {member}", one active remediation row, no horizontal overflow at mobile width, persistent filters, and visible core status before disclosure.

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipPaymentActions.test.ts`

Expected: PASS.

#### Task 5.4: Run PR 5 verification

- [ ] **Step 1: Run commands**

```bash
npm run lint
npm run check:types
npm run test -- src/libs/admin/membershipPayments/adminMembershipPaymentQueries.test.ts src/libs/mit-sailing/membershipBilling/membershipPaymentActions.test.ts src/components/mit-sailing/admin/membership-payments/AdminMembershipPaymentsView.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/membership-payments/adminMembershipPaymentsPage.test.tsx'
npm run check:i18n
```

Expected: all commands pass.

### PR 6: Renewal Reminders And Renewal Price Updates

**Goal:** Send July 15 renewal reminders, handle free-normal eligibility before renewal, and update active subscriptions to the effective full annual Stripe Price before billing.

**Estimated changed files:** 18-28.

**Files:**
- Create: `src/libs/mit-sailing/membershipBilling/membershipRenewalReminderJob.ts`
- Create: `src/libs/mit-sailing/membershipBilling/membershipRenewalReminderJob.test.ts`
- Create: `src/libs/email/membership-renewal-emails.ts`
- Create: `src/libs/email/membership-renewal-emails.test.ts`
- Create: `src/worker/membershipRenewalEmailJob.ts`
- Create: `src/worker/membershipRenewalEmailJob.test.ts`
- Modify: `src/worker/workerDispatch.ts`
- Modify: `src/worker/workerDispatch.test.ts`
- Modify: `src/worker/index.ts`
- Modify: `src/components/mit-sailing/profile/ProfileMembershipBillingView.tsx`
- Modify: `src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx`
- Modify: `src/locales/en.json`

#### Task 6.1: Add renewal reminder job and emails

- [ ] **Step 1: Write reminder tests**

Cover reminder eligibility for 30, 14, and 3 days before July 15:

- active auto-renew subscriptions get reminders
- canceled-at-period-end subscriptions do not
- reminders include amount, charge date, and cancel link
- reminder cancel links go directly to `/profile/membership?focus=auto-renew`, and the membership page reveals or focuses the turn-off-auto-renew form for that URL
- reminders use the subscription's current full price snapshot or the accepted renewal price, not a newly edited price row that has not been applied to the subscription
- active paid subscribers who now qualify for free normal membership do not receive generic renewal reminders; before renewal, the job sets `cancel_at_period_end=true` / `autoRenew=false` or otherwise blocks the paid renewal unless the member gives fresh explicit consent to paid racing renewal
- special free-normal renewal copy explains that paid renewal was turned off or blocked because normal membership is now covered, with a link to restart paid racing only if they intentionally need it
- duplicate reminders for the same subscription/window are skipped
- active auto-renew subscriptions can be moved to the currently effective full Stripe Price before reminders with `proration_behavior: 'none'`
- renewal price updates select the currently effective `full + annual` price by the member's age on the upcoming July 15 Eastern date, including a subscriber who moves from `under_30` to `thirty_or_over`
- renewal price updates only swap to a Price with the same product, annual interval, currency, and tax behavior; tests assert no invoice or proration is created and the July 15 anchor/current period end remains unchanged.

- [ ] **Step 2: Use the PR 2 notification model**

Use `SailingCardMembershipNotification` from the PR 2 schema. Do not add schema churn in this PR.

- [ ] **Step 3: Implement job**

Follow existing worker registration style. The job should run daily during June and July, compute US Eastern dates, and enqueue/send reminders.

- [ ] **Step 4: Add email templates**

Add email-template/i18n keys for subject, amount line, renewal date, auto-renew status, and direct turn-off-auto-renew link text. Snapshot `recipientEmail`, `renewalAmountCents`, `renewalAt`, `templateVersion`, `cancelLinkPath`, `providerMessageId`, and `sentAt` on `SailingCardMembershipNotification`; tests assert the stored snapshot matches the amount/date/link actually sent. The rendered copy should be equivalent to:

- "Your racing membership renews on July 15."
- "Amount: {amount}."
- "You can turn off auto-renew before July 15 from your membership page."
- "Turn off auto-renew before July 15: {directLink}."

Do not embed these strings directly in job code.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipRenewalReminderJob.test.ts`

Expected: PASS.

#### Task 6.2: Run PR 6 verification

- [ ] **Step 1: Run commands**

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/membershipBilling/membershipRenewalReminderJob.test.ts
npm run check:i18n
```

Expected: all commands pass.

## Impeccable Product/UX Requirements For All PRs

- Product register applies: quiet, task-focused, familiar controls.
- No hard-coded visible strings. Use `src/locales/en.json`.
- No nested cards, no decorative gradients, no modal-first cancellation.
- Onboarding reveals only relevant choices. Free-normal users should not have to understand paid racing.
- Payment copy must show amount, charge timing, renewal behavior, and cancellation path before Checkout.
- Admin tables should be dense, searchable, and action-oriented.
- Cancellation must be one obvious action from the membership profile page and must not contain retention hoops.
- Use existing MIT color tokens and shared components.
- Mobile must remain single-column and readable.

## Review Plan

Run three batches of three sub-agent reviews. Each batch can run its three experts in parallel. At least one expert in every batch must explicitly load `impeccable` and apply the product-register lens. After each batch, update this plan before starting the next batch.

**Batch 1 completed**

1. Impeccable product UX expert: reviewed onboarding, profile membership, cancellation simplicity, copy vocabulary, and discoverability.
2. Stripe subscription/payment-operations expert: reviewed trial-based July 15 billing, webhook dispatcher/idempotency, concurrent Checkout, subscription-item price updates, refund/dispute coverage, and cancellation consistency.
3. Cal.com-inspired maintainability/admin-ops expert: reviewed effective-dated pricing, local billing record boundaries, Stripe portal action, admin remediation, and PR size.

**Batch 2 completed**

4. Domain/pricing expert with `impeccable`: reviewed spring/full lookup shape, age-band date rules, initial price catalog seed parity, July 15 boundary cases, pending MIT Recreation verification, and public copy timing.
5. Stripe architecture expert: reviewed trialing statuses, post-July-15 annual anchors, duplicate subscriptions, Billing Portal configuration, out-of-order webhooks, invoice mapping, Price/Product naming, and refund/dispute access.
6. Testing/maintainability expert: reviewed schema/generated-file budgeting, exact test paths, self-report schema, PR 3 verification coverage, duplicate subscription representation, and PR 4 split risk.

**Batch 3 completed**

7. Impeccable final UX expert: reviewed the full PR set for profile status/action hierarchy, accessible controls, mobile readability, admin disclosure patterns, pricing mistake prevention, membership-link discoverability, and low user effort.
8. Compliance/trust expert: reviewed consent evidence, Stripe artifacts, refund/dispute records, renewal reminders, free-normal eligibility before renewal, and the direct turn-off-auto-renew path.
9. Review-size/refactoring expert: reviewed the webhook dispatcher split, admin/reminder split, PR boundaries, local-only seed wording, and no-generic-billing-framework rule.

## Issue Plan

Existing Linear/GitHub mirrors cover this multi-PR plan. Before creating any new child issue, duplicate-check the existing project/umbrella and ask for approval. The planned implementation slices are:

1. `PR 1: Normalize sailing-card membership eligibility and pricing copy`
2. `PR 2A: Add billing foundation schema, dates, and pricing reads`
3. `PR 2B: Add admin pricing writes and Stripe Price sync`
4. `PR 3: Harden Stripe webhook dispatch for multi-domain payments`
5. `PR 4A: Add racing membership checkout, profile billing, and billing portal`
6. `PR 4B: Add racing membership webhooks and auto-renew cancellation`
7. `PR 5: Add racing membership admin payment search and issue handling`
8. `PR 6: Add racing membership renewal reminders and renewal price updates`

Each issue should link to this plan and include the relevant PR scope, dependencies, exact file-list checkpoint, non-goals, split trigger, acceptance criteria, verification commands, and for schema PRs the ZenStack generation/migration handoff deliverables.

## Self-Review

- Spec coverage: normal membership eligibility, paid racing subscriptions, July 15 renewal, onboarding/home copy, admin pricing, member payment search, issue remediation, cancellation, reminders, Cal.com-inspired module boundaries, Stripe/Next best practices, waitlist-referral deferral, and PR file budget are all mapped to tasks.
- Placeholder scan: no implementation task uses placeholder markers. Schema generation is explicitly called out as a maintainer handoff until the command policy permits the correct ZenStack generation step; generated `prisma/schema.prisma` is not manually edited.
- Type consistency: model and helper names are reused consistently across tasks. PR 1 intentionally keeps hard-coded prices only as a bridge until PR 2 replaces pricing reads with `SailingCardMembershipPrice`.
