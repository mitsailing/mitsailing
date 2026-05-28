# Legal Agreement Ledger Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the shared legal agreement acceptance ledger across event registration and sailing-card administration after sailing-card onboarding introduces the ledger.

**Architecture:** Keep agreement text/version owned in code for V1 and write immutable acceptance rows whenever a user affirmatively accepts the swim agreement/liability release. Preserve existing flow-specific timestamp columns as denormalized compatibility fields until all readers are migrated. Do not move newsletter marketing consent into this ledger; newsletter consent already has separate regulatory metadata and no displayed legal agreement text.

**Tech Stack:** Next.js Server Actions, TypeScript, Prisma/ZenStack, Postgres, Vitest, Playwright, next-intl, existing request header helpers/patterns, no new compliance package.

**GitHub Issue:** https://github.com/mitsailing/mitsailing/issues/112

---

## Dependencies

- The onboarding finish plan should first introduce the V1 ledger model and helper:
  - `docs/superpowers/plans/2026-05-26-finish-sailing-card-onboarding.md`
  - `LegalAgreementAcceptance`
  - shared agreement constants for `sailing_swim_agreement`
  - server helper that records `userId`, agreement version/hash/label, `acceptedAt`, `source`, optional source record, IP address, and user agent.
- This plan begins after that helper exists. If the helper does not exist yet, complete the onboarding ledger task before starting this plan.

## Source Findings

- Event registration currently requires `swimAgreementAccepted === 'true'` in `src/libs/mit-sailing/eventRegistrationActions.ts` and stores `EventRegistration.swimAgreementAcceptedAt`.
- Event UI renders a swim agreement switch/checkbox in `src/components/mit-sailing/events/EventRegistrationFormClient.tsx`.
- Event admin roster displays the timestamp from `swimAgreementAcceptedAt` in `src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx`.
- Sailing-card onboarding currently stores initials/timestamp on `User`; the onboarding finish plan replaces the UI with checkbox acceptance and ledger writes.
- Admin sailing-card queue and user detail currently display swim initials from `User.sailingCardSwimAgreementInitials`.
- Newsletter signup stores `consentedAt`, `consentIpAddress`, and `consentUserAgent` on newsletter subscriber records. That is a separate marketing consent model, not a clickwrap legal-agreement acceptance ledger.

## File Structure

- Modify `zenstack/schema.zmodel`: Add optional source-record fields to `LegalAgreementAcceptance` if not already present; add relation/indexes needed by event registration queries.
- Modify `prisma/schema.prisma`: Keep generated Prisma schema in sync.
- Modify current onboarding migration or add a new migration depending on whether onboarding ledger has already merged.
- Modify generated files through `npm run build-local`.
- Modify `src/libs/legal/legalAgreementAcceptance.ts`: Add reusable source values and `recordLegalAgreementAcceptanceInTx`.
- Modify `src/libs/legal/legalAgreementAcceptance.test.ts`: Prove hashing, metadata truncation, source record handling, and append-only create data.
- Modify `src/libs/mit-sailing/eventRegistrationActions.ts`: Write a ledger row in the same transaction that creates the event registration.
- Modify `src/libs/mit-sailing/eventRegistrationActions.test.ts`: Prove event registration creates an acceptance ledger row and still rejects missing checkbox acceptance.
- Modify `src/components/mit-sailing/events/EventRegistrationFormClient.tsx`: Keep current UI behavior, but use shared swim agreement copy/label where possible.
- Modify `src/components/mit-sailing/events/EventRegistrationForm.test.tsx`: Prove the shared label is rendered and the existing checkbox behavior remains.
- Modify `src/libs/admin/events/eventAdminQueries.ts`: Load linked ledger acceptance metadata for event registrations where useful.
- Modify `src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx`: Display agreement accepted time from existing timestamp and add version/hash affordance only if available from query.
- Modify `src/libs/admin/cards/adminSailingCardUiQueries.ts`: Load latest sailing-card onboarding agreement acceptance for card queue/user summaries.
- Modify `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`: Replace “Initials” display with agreement acceptance status/version.
- Modify `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`: Replace swim-initials detail with agreement accepted timestamp/version.
- Modify `src/locales/en.json`: Add admin labels for legal agreement acceptance and update stale “swim initials” copy.
- Modify `src/libs/mit-sailing/sailingCardValidity.ts`: Stop treating missing initials as incomplete once onboarding ledger acceptance is the source of truth.
- Modify `src/libs/mit-sailing/sailingCardValidity.test.ts`: Prove yearly onboarding completion depends on agreement acceptance timestamp/ledger-derived field, not initials.
- Modify `src/libs/mit-sailing/sailingCardAnnualClearing.ts`: Clear denormalized agreement fields only if those fields still exist; never delete ledger rows.
- Modify `src/libs/mit-sailing/sailingCardAnnualClearing.test.ts`: Prove annual clearing preserves ledger evidence.
- Create `docs/legal-agreement-ledger.md`: Document agreement keys, source values, retention behavior, and why newsletter consent is separate.

## Resolved Design Decisions

- Use one append-only ledger table for legal agreement acceptances.
- For V1, agreement text and version live in code, not a staff-editable CMS/admin UI.
- Event registration writes to the ledger but keeps `EventRegistration.swimAgreementAcceptedAt` for existing reports and admin lists.
- Sailing-card onboarding writes to the ledger and exposes a denormalized accepted timestamp on user/card admin views.
- Do not collect initials.
- Do not delete or mutate ledger acceptance rows during annual clearing.
- Do not migrate newsletter subscription consent into the legal agreement ledger.

---

## Task 1: Harden The Ledger Model For Multiple Sources

**Files:**
- Modify: `zenstack/schema.zmodel`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/<ledger-migration>/migration.sql`
- Generated: `src/generated/prisma/enums.ts`
- Generated: `zenstack/models.ts`
- Generated: `zenstack/input.ts`
- Generated: `zenstack/schema.ts`

- [ ] **Step 1: Add failing schema policy test**

Create or append to `src/libs/legal/legalAgreementSchema.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('zenstack/schema.zmodel', 'utf8');

describe('legal agreement schema', () => {
  it('keeps legal acceptance rows source-addressable and append-only', () => {
    expect(schema).toContain('model LegalAgreementAcceptance');
    expect(schema).toContain('source LegalAgreementAcceptanceSource');
    expect(schema).toContain('sourceRecordId');
    expect(schema).toContain('agreementBodySha256');
    expect(schema).toContain('@@index([source, sourceRecordId])');
    expect(schema).toContain("@@deny('update,delete', true)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails if the model is incomplete**

Run:

```bash
npm run test -- src/libs/legal/legalAgreementSchema.test.ts
```

Expected: FAIL until the schema includes source record tracking and append-only policy.

- [ ] **Step 3: Add source enum and source record fields**

In `zenstack/schema.zmodel`, ensure the ledger has this shape:

```prisma
enum LegalAgreementAcceptanceSource {
  SAILING_CARD_ONBOARDING
  EVENT_REGISTRATION

  @@map("legal_agreement_acceptance_source")
}

model LegalAgreementAcceptance {
  id                  String                         @id @default(cuid())
  userId              String                         @map("user_id")
  agreementKey        String                         @map("agreement_key") @db.VarChar(80)
  agreementVersion    String                         @map("agreement_version") @db.VarChar(40)
  agreementTitle      String                         @map("agreement_title") @db.VarChar(160)
  agreementBodySha256 String                         @map("agreement_body_sha256") @db.VarChar(64)
  checkboxLabel       String                         @map("checkbox_label") @db.Text
  acceptedAt          DateTime                       @map("accepted_at")
  source              LegalAgreementAcceptanceSource
  sourceRecordId      String?                        @map("source_record_id")
  ipAddress           String?                        @map("ip_address") @db.VarChar(80)
  userAgent           String?                        @map("user_agent") @db.Text
  createdAt           DateTime                       @default(now()) @map("created_at")
  user                User                           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, agreementKey, agreementVersion])
  @@index([source, sourceRecordId])
  @@deny('update,delete', true)
  @@allow('read', auth() != null && userId == auth().id)
  @@allow('read', auth().appRole == 'admin' || auth().appRole == 'dock_master')
  @@map("legal_agreement_acceptances")
}
```

Also add `legalAgreementAcceptances LegalAgreementAcceptance[]` to `model User`.

- [ ] **Step 4: Update Prisma schema and migration**

If onboarding ledger is still unmerged, update the onboarding ledger migration in place. If onboarding ledger already merged, add a new migration that creates `legal_agreement_acceptance_source`, adds `source_record_id`, and adds the `source/source_record_id` index.

- [ ] **Step 5: Regenerate generated files**

Run:

```bash
npm run build-local
```

Expected: generated Prisma/ZenStack files include `LegalAgreementAcceptanceSource`.

- [ ] **Step 6: Run schema test**

Run:

```bash
npm run test -- src/libs/legal/legalAgreementSchema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit schema hardening**

```bash
git add zenstack/schema.zmodel prisma/schema.prisma prisma/migrations src/generated/prisma zenstack src/libs/legal/legalAgreementSchema.test.ts
git commit -m "feat: harden legal agreement acceptance ledger"
```

---

## Task 2: Centralize Agreement Copy And Recording Helpers

**Files:**
- Modify: `src/libs/legal/legalAgreementContent.ts`
- Modify: `src/libs/legal/legalAgreementAcceptance.ts`
- Modify: `src/libs/legal/legalAgreementAcceptance.test.ts`

- [ ] **Step 1: Add failing helper tests**

Append to `src/libs/legal/legalAgreementAcceptance.test.ts`:

```ts
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import {
  buildLegalAgreementAcceptanceCreate,
  legalAgreementBodySha256,
  truncateLegalAgreementMetadata,
} from '@/libs/legal/legalAgreementAcceptance';
import { sailingSwimAgreement } from '@/libs/legal/legalAgreementContent';

it('builds event registration acceptance create data', () => {
  expect(
    buildLegalAgreementAcceptanceCreate({
      acceptedAt: new Date('2026-05-27T12:00:00.000Z'),
      agreement: sailingSwimAgreement,
      ipAddress: '203.0.113.10',
      source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
      sourceRecordId: 'registration-1',
      userAgent: 'Playwright',
      userId: 'user-1',
    })
  ).toMatchObject({
    acceptedAt: new Date('2026-05-27T12:00:00.000Z'),
    agreementBodySha256: legalAgreementBodySha256(sailingSwimAgreement.body),
    agreementKey: 'sailing_swim_agreement',
    agreementVersion: sailingSwimAgreement.version,
    checkboxLabel: sailingSwimAgreement.checkboxLabel,
    source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
    sourceRecordId: 'registration-1',
    userId: 'user-1',
  });
});

it('truncates request metadata before persistence', () => {
  expect(truncateLegalAgreementMetadata('x'.repeat(90))).toHaveLength(80);
  expect(truncateLegalAgreementMetadata(null)).toBeNull();
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
npm run test -- src/libs/legal/legalAgreementAcceptance.test.ts
```

Expected: FAIL until helper supports `sourceRecordId` and the enum source.

- [ ] **Step 3: Implement shared agreement content**

Ensure `src/libs/legal/legalAgreementContent.ts` exports:

```ts
export type LegalAgreementContent = {
  readonly body: string;
  readonly checkboxLabel: string;
  readonly key: string;
  readonly title: string;
  readonly version: string;
};

export const sailingSwimAgreement = {
  key: 'sailing_swim_agreement',
  title: 'Swim agreement and liability release',
  version: '2026-05-27',
  checkboxLabel: 'I have read and agree to the swim agreement and liability release.',
  body: [
    'I certify that I can swim and understand that boating and sailing involve inherent risks.',
    'I agree to follow MIT Sailing staff instructions, safety rules, and equipment-use requirements.',
    'I understand this acknowledgement is required before my sailing card request can be reviewed.',
  ].join('\n\n'),
} as const satisfies LegalAgreementContent;
```

Legal should replace this body with approved language before production launch if this text is not already approved.

- [ ] **Step 4: Implement acceptance helper**

In `src/libs/legal/legalAgreementAcceptance.ts`, expose:

```ts
import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import type { LegalAgreementContent } from '@/libs/legal/legalAgreementContent';

export const truncateLegalAgreementMetadata = (value: string | null) =>
  value === null ? null : value.slice(0, 80);

export const legalAgreementBodySha256 = (body: string) =>
  createHash('sha256').update(body).digest('hex');

export const buildLegalAgreementAcceptanceCreate = (props: {
  readonly acceptedAt: Date;
  readonly agreement: LegalAgreementContent;
  readonly ipAddress: string | null;
  readonly source: LegalAgreementAcceptanceSource;
  readonly sourceRecordId: string | null;
  readonly userAgent: string | null;
  readonly userId: string;
}): Prisma.LegalAgreementAcceptanceUncheckedCreateInput => ({
  acceptedAt: props.acceptedAt,
  agreementBodySha256: legalAgreementBodySha256(props.agreement.body),
  agreementKey: props.agreement.key,
  agreementTitle: props.agreement.title,
  agreementVersion: props.agreement.version,
  checkboxLabel: props.agreement.checkboxLabel,
  ipAddress: truncateLegalAgreementMetadata(props.ipAddress),
  source: props.source,
  sourceRecordId: props.sourceRecordId,
  userAgent: props.userAgent,
  userId: props.userId,
});
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
npm run test -- src/libs/legal/legalAgreementAcceptance.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit helper updates**

```bash
git add src/libs/legal/legalAgreementContent.ts src/libs/legal/legalAgreementAcceptance.ts src/libs/legal/legalAgreementAcceptance.test.ts
git commit -m "feat: centralize legal agreement acceptance helpers"
```

---

## Task 3: Write Event Registration Acceptances To The Ledger

**Files:**
- Modify: `src/libs/mit-sailing/eventRegistrationActions.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationActions.test.ts`

- [ ] **Step 1: Add failing event action test**

Append a test near the successful registration tests in `src/libs/mit-sailing/eventRegistrationActions.test.ts`:

```ts
it('records swim agreement acceptance in the legal ledger', async () => {
  mocks.registrationCreate.mockResolvedValue({
    id: 'registration-1',
    eventId: 'event-1',
    userId: 'user-1',
  });
  const formData = validRegistrationFormData();
  formData.set('swimAgreementAccepted', 'true');
  const { registerForEventAction } = await import(
    '@/libs/mit-sailing/eventRegistrationActions'
  );

  await expect(
    registerForEventAction('en', 'intro-sail', idleState, formData)
  ).rejects.toThrow('NEXT_REDIRECT');

  expect(mocks.legalAgreementAcceptanceCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      agreementKey: 'sailing_swim_agreement',
      source: 'EVENT_REGISTRATION',
      sourceRecordId: 'registration-1',
      userId: 'user-1',
    }),
  });
});
```

Adjust mock names to match the existing test harness after inspecting it; the assertion must prove the ledger row is created in the same mutation path as the registration.

- [ ] **Step 2: Run the event action test to verify it fails**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: FAIL until registration writes the ledger row.

- [ ] **Step 3: Update event registration transaction**

In `src/libs/mit-sailing/eventRegistrationActions.ts`, import:

```ts
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import { buildLegalAgreementAcceptanceCreate } from '@/libs/legal/legalAgreementAcceptance';
import { sailingSwimAgreement } from '@/libs/legal/legalAgreementContent';
```

Inside the existing registration create transaction, after the registration id is known, add:

```ts
await tx.legalAgreementAcceptance.create({
  data: buildLegalAgreementAcceptanceCreate({
    acceptedAt: options.now,
    agreement: sailingSwimAgreement,
    ipAddress: options.ipAddress,
    source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
    sourceRecordId: registration.id,
    userAgent: options.userAgent,
    userId: currentUser.id,
  }),
});
```

If the current helper options do not already carry IP/user-agent, add them at the Server Action boundary using the same `headers()` pattern as `src/libs/newsletter/newsletterActions.ts`.

- [ ] **Step 4: Keep missing checkbox behavior unchanged**

Verify this existing branch still returns `swim_agreement_required` before any registration or ledger write:

```ts
const swimAgreement = formData.get('swimAgreementAccepted');
if (swimAgreement !== 'true') {
  return publicEventRegistrationFormErrorState({
    code: 'swim_agreement_required',
    fieldErrors: { [swimAgreementFieldName]: 'swim_agreement_required' },
    fieldNames,
    formData,
  });
}
```

- [ ] **Step 5: Run event action tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit event registration ledger write**

```bash
git add src/libs/mit-sailing/eventRegistrationActions.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
git commit -m "feat: record event agreement acceptance"
```

---

## Task 4: Share Swim Agreement Copy In Event UI

**Files:**
- Modify: `src/components/mit-sailing/events/EventRegistrationFormClient.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationForm.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing UI test for disclosure text**

Append to `src/components/mit-sailing/events/EventRegistrationForm.test.tsx`:

```ts
it('renders readable swim agreement copy before acceptance', () => {
  renderRegistrationForm();

  expect(
    screen.getByRole('button', { name: 'Swim agreement and liability release' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('switch', {
      name: 'I have read and agree to the swim agreement and liability release.',
    })
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI test to verify it fails**

Run:

```bash
npm run test -- src/components/mit-sailing/events/EventRegistrationForm.test.tsx
```

Expected: FAIL until the event form exposes the readable agreement disclosure and updated label.

- [ ] **Step 3: Render `<details>` around agreement copy**

In `SwimAgreementField`, render a compact disclosure above the switch:

```tsx
<details className="rounded-md border border-border bg-muted/30 p-3">
  <summary className="cursor-pointer text-sm font-medium text-foreground">
    {props.labels.swimAgreementHeading}
  </summary>
  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
    {props.labels.swimAgreementBody}
  </p>
</details>
```

Add `swimAgreementBody` to `EventRegistrationFormLabels` and its server translation builder.

- [ ] **Step 4: Update translations**

In `src/locales/en.json`, update event registration labels:

```json
"registration_swim_agreement_heading": "Swim agreement and liability release",
"registration_swim_agreement_label": "I have read and agree to the swim agreement and liability release.",
"registration_swim_agreement_body": "I certify that I can swim and understand that boating and sailing involve inherent risks.\n\nI agree to follow MIT Sailing staff instructions, safety rules, and equipment-use requirements.\n\nI understand this acknowledgement is required before registering."
```

- [ ] **Step 5: Run UI tests**

Run:

```bash
npm run test -- src/components/mit-sailing/events/EventRegistrationForm.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit event UI copy**

```bash
git add src/components/mit-sailing/events/EventRegistrationFormClient.tsx src/components/mit-sailing/events/EventRegistrationForm.test.tsx src/locales/en.json
git commit -m "feat: show event swim agreement copy"
```

---

## Task 5: Update Admin Event Reporting

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.test.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing query test for ledger metadata**

In `src/libs/admin/events/eventAdminQueries.test.ts`, add a registration fixture with a related acceptance row and assert the view model includes:

```ts
expect(result.registrations[0]).toMatchObject({
  legalAgreement: {
    agreementVersion: '2026-05-27',
    acceptedAt: new Date('2026-05-01T12:01:00Z'),
  },
});
```

- [ ] **Step 2: Run query tests to verify they fail**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminQueries.test.ts
```

Expected: FAIL until event admin queries load ledger metadata by `source=EVENT_REGISTRATION` and `sourceRecordId=registration.id`.

- [ ] **Step 3: Load ledger metadata**

In `eventAdminQueries.ts`, after registrations are loaded, fetch:

```ts
const acceptances = await prisma.legalAgreementAcceptance.findMany({
  where: {
    source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
    sourceRecordId: { in: registrations.map((row) => row.id) },
  },
  select: {
    acceptedAt: true,
    agreementVersion: true,
    sourceRecordId: true,
  },
});
```

Map by `sourceRecordId` and attach `legalAgreement` to the registration view model.

- [ ] **Step 4: Update roster display**

Keep the visible accepted date unchanged, but include version text when available:

```tsx
<RosterField label={props.t('registration_swim_agreement')}>
  <span>{formatEasternDateTime(props.registration.swimAgreementAcceptedAt)}</span>
  {props.registration.legalAgreement ? (
    <span className="block text-xs text-muted-foreground">
      {props.t('registration_agreement_version', {
        version: props.registration.legalAgreement.agreementVersion,
      })}
    </span>
  ) : null}
</RosterField>
```

- [ ] **Step 5: Run admin event tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminQueries.test.ts src/components/mit-sailing/admin/events/AdminEventRegistrationsView.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit admin event reporting**

```bash
git add src/libs/admin/events/eventAdminQueries.ts src/libs/admin/events/eventAdminQueries.test.ts src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx src/components/mit-sailing/admin/events/AdminEventRegistrationsView.test.tsx src/locales/en.json
git commit -m "feat: show event agreement acceptance metadata"
```

---

## Task 6: Update Sailing-Card Admin And Validity Readers

**Files:**
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.ts`
- Modify: `src/libs/admin/cards/adminSailingCardUiQueries.test.ts`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx`
- Modify: `src/libs/mit-sailing/sailingCardValidity.ts`
- Modify: `src/libs/mit-sailing/sailingCardValidity.test.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing validity test**

In `src/libs/mit-sailing/sailingCardValidity.test.ts`, replace initials-based completion with:

```ts
it('requires sailing-card agreement acceptance for completed onboarding', () => {
  expect(
    hasCompletedYearlySailingCardOnboarding({
      ...completeUser,
      sailingCardAgreementAcceptedAt: null,
    })
  ).toBe(false);
  expect(
    hasCompletedYearlySailingCardOnboarding({
      ...completeUser,
      sailingCardAgreementAcceptedAt: new Date('2026-05-27T12:00:00Z'),
    })
  ).toBe(true);
});
```

Use the actual field name introduced by onboarding ledger work.

- [ ] **Step 2: Run validity tests to verify they fail**

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingCardValidity.test.ts
```

Expected: FAIL until validity uses the agreement accepted timestamp instead of initials.

- [ ] **Step 3: Update card/admin query tests**

In admin card and admin user page tests, replace expectations for “Initials” / `AK` with agreement accepted/version labels:

```ts
expect(screen.getByText('Agreement accepted')).toBeInTheDocument();
expect(screen.getByText('Version 2026-05-27')).toBeInTheDocument();
```

- [ ] **Step 4: Update readers and UI**

Replace stale swim-initials display fields with:

```ts
agreementAcceptedAt: row.sailingCardAgreementAcceptedAt,
agreementVersion: latestAcceptance?.agreementVersion ?? null,
```

In UI, render accepted date and version. Keep the queue action enabled only when agreement accepted timestamp is present.

- [ ] **Step 5: Run card/admin tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingCardValidity.test.ts src/libs/admin/cards/adminSailingCardUiQueries.test.ts src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/adminUserPages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit sailing-card reader migration**

```bash
git add src/libs/mit-sailing/sailingCardValidity.ts src/libs/mit-sailing/sailingCardValidity.test.ts src/libs/admin/cards/adminSailingCardUiQueries.ts src/libs/admin/cards/adminSailingCardUiQueries.test.ts src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/[id]/page.tsx src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/users/adminUserPages.test.tsx src/locales/en.json
git commit -m "fix: read sailing-card agreement acceptance"
```

---

## Task 7: Preserve Ledger Evidence During Annual Clearing

**Files:**
- Modify: `src/libs/mit-sailing/sailingCardAnnualClearing.ts`
- Modify: `src/libs/mit-sailing/sailingCardAnnualClearing.test.ts`

- [ ] **Step 1: Add failing preservation test**

In `src/libs/mit-sailing/sailingCardAnnualClearing.test.ts`, assert annual clearing does not call `legalAgreementAcceptance.deleteMany` and does not clear ledger rows:

```ts
it('preserves legal agreement acceptance rows during annual clearing', async () => {
  await clearAnnualSailingCardFields({
    db: mockDb,
    now: new Date('2026-10-01T04:00:00Z'),
  });

  expect(mocks.legalAgreementAcceptanceDeleteMany).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run annual clearing tests to verify behavior**

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingCardAnnualClearing.test.ts
```

Expected: PASS if clearing never touches ledger rows; otherwise FAIL until fixed.

- [ ] **Step 3: Keep only denormalized yearly fields in clearing**

If clearing includes agreement fields, clear only denormalized `User` fields needed to force yearly re-acceptance. Never delete from `legalAgreementAcceptances`.

- [ ] **Step 4: Commit annual clearing safeguard**

```bash
git add src/libs/mit-sailing/sailingCardAnnualClearing.ts src/libs/mit-sailing/sailingCardAnnualClearing.test.ts
git commit -m "test: preserve agreement ledger during annual clearing"
```

---

## Task 8: Document Scope And Non-Goals

**Files:**
- Create: `docs/legal-agreement-ledger.md`
- Modify: `docs/superpowers/plans/2026-05-27-legal-agreement-ledger-adoption.md`

- [ ] **Step 1: Create operator documentation**

Create `docs/legal-agreement-ledger.md`:

```md
# Legal Agreement Ledger

MIT Sailing records legal agreement acceptances in `legal_agreement_acceptances`.

## Agreement keys

- `sailing_swim_agreement`: Swim agreement and liability release used by sailing-card onboarding and event registration.

## Sources

- `SAILING_CARD_ONBOARDING`: User accepted while requesting yearly sailing-card review.
- `EVENT_REGISTRATION`: User accepted while registering for an event.

## Retention

Acceptance rows are append-only. Annual sailing-card clearing may reset yearly status fields on `user`, but must not delete ledger rows.

## Newsletter consent

Newsletter consent remains in newsletter subscriber/subscription tables. It records marketing email consent and unsubscribe state, not acceptance of a displayed legal agreement.

## Agreement text

For V1, agreement text and version live in code. If MIT Sailing needs staff-managed legal text later, add immutable agreement-version publishing instead of editing existing acceptance rows.
```

- [ ] **Step 2: Add plan cross-reference**

At the top of this plan, add the GitHub issue number once created.

- [ ] **Step 3: Commit docs**

```bash
git add docs/legal-agreement-ledger.md docs/superpowers/plans/2026-05-27-legal-agreement-ledger-adoption.md
git commit -m "docs: document legal agreement ledger adoption"
```

---

## Final Verification

- [ ] Run focused tests:

```bash
npm run test -- src/libs/legal src/libs/mit-sailing/eventRegistrationActions.test.ts src/components/mit-sailing/events/EventRegistrationForm.test.tsx src/libs/admin/events/eventAdminQueries.test.ts src/components/mit-sailing/admin/events/AdminEventRegistrationsView.test.tsx src/libs/mit-sailing/sailingCardValidity.test.ts src/libs/mit-sailing/sailingCardAnnualClearing.test.ts
```

- [ ] Run type and lint checks:

```bash
npm run check:types
npm run lint
```

- [ ] Run e2e only after the onboarding and event registration flows are both migrated:

```bash
npm run test:e2e
```

## Self-Review

- Spec coverage: The plan covers event registration, event admin reporting, sailing-card admin/status readers, annual clearing retention, and documentation. Newsletter consent is explicitly evaluated and excluded because it is marketing consent, not legal agreement clickwrap acceptance.
- Placeholder scan: No implementation step says TBD or “implement later”; where test harness names may differ, the step states the required assertion and file owner.
- Type consistency: `LegalAgreementAcceptanceSource.EVENT_REGISTRATION`, `sourceRecordId`, `agreementBodySha256`, `agreementVersion`, and `sailing_swim_agreement` are used consistently across schema, helpers, event actions, and admin readers.
