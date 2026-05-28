# Sailing Card Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox status markers and must be completed in order unless a step explicitly says it can run in parallel.

## Goal

Move MIT Sailing account creation to a simple email/password signup, then collect yearly sailing-card onboarding data in `/onboarding`. A user can use the site after signup, can register for intro events without a current card, and needs a current sailing card only for events that explicitly require one. Dock staff, dock masters, and admins can review onboarding submissions, verify yearly swim agreement initials, and issue card numbers. Card numbers reset every sailing-card year ending July 15 in US Eastern time. Admin access must never be blocked by sailing-card state.

## Clarification Update: Yearly Renewal

- Legacy signup and July renewal behavior were checked against the available legacy trees under `/Users/andrewkelley/GitHub/sailing-wp/old` and `/Users/andrewkelley/GitHub/sailing-wp-main/old`; the originally provided `/Users/andrewkelley/GitHub/mitsailing-wp/old` path was not present locally.
- The new app does not implement virtual membership.
- Signup stays minimal. Profile, safety, affiliation, swim agreement, phone, and emergency contact fields belong on `/onboarding`.
- `/onboarding` is both first-run onboarding and yearly renewal. Member-facing authenticated flows redirect users with missing yearly onboarding state to `/onboarding`; `/admin` remains permission-gated and is not blocked by card or onboarding state.
- Annual renewal clearing is handled by the app worker at midnight on July 15 America/New_York. It clears only yearly sailing-card fields and writes `UserAudit` rows with `userId: null`; stable profile/contact fields are preserved.

## Architecture

The current sailing-card state lives on `User`. There is no `members` table and no separate card-history table in the first implementation. Historical visibility comes from the existing `UserAudit` model, which records card issuance, revocation, and expiration changes.

The only new non-user table is `MitDataWarehousePerson`, a local read-only cache of MIT Data Warehouse identity rows. It replaces the old `dw` table shape and supports onboarding rules that derive first name, last name, class year, and MIT affiliation from a valid MIT ID. This is source data, not member data.

Sailing-card eligibility is derived from fields on `User`: card number, card year, expiration date, issued date, and swim-agreement initials. There is no broad `cardStatus` enum. Onboarding pending state is derived from `sailingCardRequestedAt` being present while the user does not have a current issued card.

Event registration uses an explicit event setting:

- `NONE`: no sailing card required. Intro classes use this.
- `CURRENT_CARD`: active unexpired sailing card with an assigned number required.

Admin and staff workflows are server-side actions gated by the existing app permissions. `/admin` routes remain reachable to authorized users even when their own sailing card is missing or expired.

## Tech Stack

- Next.js App Router with server components, server actions, and `next-intl`
- TypeScript with generated Prisma and ZenStack models
- Prisma singleton from `src/libs/DB.ts`
- Zod for form schemas
- Vitest and Testing Library for focused unit/component tests
- Playwright for final route-level verification where existing e2e helpers apply

## CodeRabbit-Style Bug-Hunt Gates

Do not wait until the PR review to discover preventable bugs. After each phase below, stop implementation and run the matching bug-hunt gate before starting the next phase. Each gate has three parts:

1. Run the focused tests and static checks listed in the gate.
2. Ask a fresh review sub-agent to review only the files changed in that phase, using the exact prompt in the gate.
3. Fix every confirmed critical, major, security, authorization, data-loss, migration, concurrency, date/time, cache/revalidation, i18n, accessibility, and missing-test finding before moving on.

The review sub-agent must return findings first, with file and line references. It must not rewrite code. It must not comment on unrelated files. It must treat "needs more tests" as actionable only when it names a concrete missing behavior and the file where the test belongs.

If the CodeRabbit CLI is authenticated in the execution environment, run this command after the sub-agent gate and before committing the phase:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md
```

Expected: `CodeRabbit raised 0 issues.` When CodeRabbit raises issues, triage them before moving to the next phase. If CodeRabbit cannot run because authentication is unavailable, record that in the phase notes and do not claim the branch is CodeRabbit-clean.

---

## Task 1: Add The Data Model

**Files**

- `zenstack/schema.zmodel`
- `prisma/schema.prisma`
- `prisma/migrations/20260521000000_add_sailing_card_onboarding/migration.sql`

**Schema changes**

Add these enums near the existing enum declarations:

```prisma
enum SailingAffiliation {
  MIT_STUDENT
  MIT_FACULTY
  MIT_STAFF
  MIT_ALUM
  MIT_FAMILY
  MIT_AFFILIATE
  NON_MIT
}

enum MitDataWarehousePersonType {
  STUDENT
  FACULTY
  STAFF
  ALUM
  AFFILIATE
  OTHER
}

enum EventSailingCardRequirement {
  NONE
  CURRENT_CARD
}
```

Add these fields to `User` in `zenstack/schema.zmodel`, keeping existing fields in place:

```prisma
firstName                           String?
lastName                            String?
sailingAffiliation                  SailingAffiliation?
mitId                               String?                        @unique
mitClassYear                        String?
mitDataWarehouseVerifiedAt          DateTime?
sailingCardNumber                   Int?
sailingCardYear                     Int?
sailingCardExpiresOn                DateTime?                      @db.Date
sailingCardRequestedAt              DateTime?
sailingCardIssuedAt                 DateTime?
sailingCardIssuedByUserId           String?
sailingCardSwimAgreementInitials    String?
sailingCardSwimAgreementInitialedAt DateTime?
sailingCardIssuedBy                 User?                          @relation("SailingCardIssuer", fields: [sailingCardIssuedByUserId], references: [id], onDelete: SetNull)
sailingCardsIssued                  User[]                         @relation("SailingCardIssuer")
```

Add these indexes to `User`:

```prisma
@@unique([sailingCardYear, sailingCardNumber])
@@index([sailingCardRequestedAt])
@@index([sailingCardExpiresOn])
@@index([sailingAffiliation])
```

Add the MIT DW cache model:

```prisma
model MitDataWarehousePerson {
  mitId        String                     @id
  firstName    String
  lastName     String
  kerberos     String?
  classYear    String?
  personType   MitDataWarehousePersonType
  loadedAt     DateTime
  createdAt    DateTime                   @default(now())
  updatedAt    DateTime                   @updatedAt

  @@index([personType])
  @@map("mit_data_warehouse_people")
}
```

Add this field to `Event`:

```prisma
sailingCardRequirement EventSailingCardRequirement @default(NONE)
```

The migration SQL must:

1. Create the three enums.
2. Add nullable `users` columns listed above.
3. Add `users_sailingCardIssuedByUserId_fkey` with `ON DELETE SET NULL`.
4. Add unique indexes for `users_mitId_key` and `(sailingCardYear, sailingCardNumber)`.
5. Add non-unique indexes for requested, expires, and affiliation fields.
6. Create `mit_data_warehouse_people`.
7. Add `events.sailingCardRequirement` with default `NONE`, then keep the default.

**Tests first**

This task is schema-only, so the first red check is type generation usage. After the schema edit, run:

```bash
npm run check:types
```

Expected before the implementation imports the new fields: generated model drift may be reported. After generated artifacts are refreshed by the repo's Prisma/ZenStack generation workflow, the command must pass again at the final verification step.

**Acceptance**

- `User` holds current card data.
- `UserAudit` remains the source of old-card visibility.
- MIT DW data is separate source data, not a member table.
- `Event` can explicitly declare whether a card is required.

---

## Task 2: Add Sailing-Card Domain Helpers

**Files**

- `src/libs/mit-sailing/sailingAffiliations.ts`
- `src/libs/mit-sailing/sailingAffiliations.test.ts`
- `src/libs/mit-sailing/sailingCardValidity.ts`
- `src/libs/mit-sailing/sailingCardValidity.test.ts`
- `src/libs/mit-sailing/mitDataWarehouse.ts`
- `src/libs/mit-sailing/mitDataWarehouse.test.ts`

**Tests first**

Create `src/libs/mit-sailing/sailingAffiliations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import {
  getSailingAffiliationRule,
  getSailingAffiliationOptions,
  isManualNameAllowed,
  isMitIdAsked,
  isMitIdRequired,
} from '@/libs/mit-sailing/sailingAffiliations';

describe('sailingAffiliations', () => {
  it('requires mit id for current mit people', () => {
    expect(isMitIdRequired(SailingAffiliation.MIT_STUDENT)).toBe(true);
    expect(isMitIdRequired(SailingAffiliation.MIT_FACULTY)).toBe(true);
    expect(isMitIdRequired(SailingAffiliation.MIT_STAFF)).toBe(true);
  });

  it('makes mit id optional for alumni and family', () => {
    expect(isMitIdAsked(SailingAffiliation.MIT_ALUM)).toBe(true);
    expect(isMitIdRequired(SailingAffiliation.MIT_ALUM)).toBe(false);
    expect(isManualNameAllowed(SailingAffiliation.MIT_ALUM)).toBe(true);
    expect(isManualNameAllowed(SailingAffiliation.MIT_FAMILY)).toBe(true);
  });

  it('does not ask non mit users for mit id', () => {
    expect(isMitIdAsked(SailingAffiliation.NON_MIT)).toBe(false);
    expect(isMitIdRequired(SailingAffiliation.NON_MIT)).toBe(false);
    expect(isManualNameAllowed(SailingAffiliation.NON_MIT)).toBe(true);
  });

  it('returns a stable ordered option list', () => {
    expect(getSailingAffiliationOptions().map((option) => option.value)).toEqual([
      SailingAffiliation.MIT_STUDENT,
      SailingAffiliation.MIT_FACULTY,
      SailingAffiliation.MIT_STAFF,
      SailingAffiliation.MIT_ALUM,
      SailingAffiliation.MIT_FAMILY,
      SailingAffiliation.MIT_AFFILIATE,
      SailingAffiliation.NON_MIT,
    ]);
  });

  it('returns rule metadata by affiliation', () => {
    expect(getSailingAffiliationRule(SailingAffiliation.MIT_STUDENT).mitIdMode).toBe('required');
  });
});
```

Create `src/libs/mit-sailing/sailingCardValidity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  getCurrentSailingCardYear,
  getSailingCardExpirationDate,
  getSailingCardStatus,
  hasCurrentSailingCard,
  normalizeSailingCardInitials,
} from '@/libs/mit-sailing/sailingCardValidity';

describe('sailingCardValidity', () => {
  it('uses the current year before july 15 eastern', () => {
    expect(getCurrentSailingCardYear(new Date('2026-07-14T15:00:00-04:00'))).toBe(2026);
  });

  it('uses the next year on july 15 eastern', () => {
    expect(getCurrentSailingCardYear(new Date('2026-07-15T00:01:00-04:00'))).toBe(2027);
  });

  it('sets expiration to july 15 eastern for the card year', () => {
    expect(getSailingCardExpirationDate(2027).toISOString()).toBe('2027-07-15T04:00:00.000Z');
  });

  it('requires number year issued date expiration and swim initials for current card', () => {
    const now = new Date('2026-08-01T12:00:00-04:00');
    expect(hasCurrentSailingCard({
      sailingCardNumber: 61,
      sailingCardYear: 2027,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: now,
      sailingCardSwimAgreementInitials: 'AK',
    }, now)).toBe(true);
  });

  it('does not accept expired card', () => {
    expect(hasCurrentSailingCard({
      sailingCardNumber: 61,
      sailingCardYear: 2026,
      sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2025-08-01T12:00:00-04:00'),
      sailingCardSwimAgreementInitials: 'AK',
    }, new Date('2026-07-15T00:01:00-04:00'))).toBe(false);
  });

  it('derives pending review from requested date without issued card', () => {
    expect(getSailingCardStatus({
      sailingCardNumber: null,
      sailingCardYear: null,
      sailingCardExpiresOn: null,
      sailingCardIssuedAt: null,
      sailingCardRequestedAt: new Date('2026-05-01T12:00:00-04:00'),
      sailingCardSwimAgreementInitials: 'AK',
    }, new Date('2026-05-02T12:00:00-04:00'))).toBe('pending_review');
  });

  it('normalizes initials', () => {
    expect(normalizeSailingCardInitials(' ak ')).toBe('AK');
  });
});
```

Create `src/libs/mit-sailing/mitDataWarehouse.test.ts` with a mocked Prisma client object:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import { lookupMitDataWarehouseIdentity } from '@/libs/mit-sailing/mitDataWarehouse';

describe('mitDataWarehouse', () => {
  it('returns normalized identity for matching mit id', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: 'ada',
          classYear: '2027',
          personType: MitDataWarehousePersonType.STUDENT,
        }),
      },
    };

    await expect(lookupMitDataWarehouseIdentity({
      db,
      mitId: ' 123-45-6789 ',
    })).resolves.toEqual({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: '2027',
      personType: MitDataWarehousePersonType.STUDENT,
    });
  });

  it('returns null for invalid mit id shape', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(lookupMitDataWarehouseIdentity({ db, mitId: 'abc' })).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });
});
```

**Implementation**

`src/libs/mit-sailing/sailingAffiliations.ts`:

```ts
import { SailingAffiliation } from '@/generated/prisma/enums';

export type MitIdMode = 'required' | 'optional' | 'hidden';

export type SailingAffiliationRule = {
  readonly value: SailingAffiliation;
  readonly translationKey: string;
  readonly mitIdMode: MitIdMode;
  readonly allowManualName: boolean;
};

const sailingAffiliationRules = [
  {
    value: SailingAffiliation.MIT_STUDENT,
    translationKey: 'affiliations.mit_student',
    mitIdMode: 'required',
    allowManualName: false,
  },
  {
    value: SailingAffiliation.MIT_FACULTY,
    translationKey: 'affiliations.mit_faculty',
    mitIdMode: 'required',
    allowManualName: false,
  },
  {
    value: SailingAffiliation.MIT_STAFF,
    translationKey: 'affiliations.mit_staff',
    mitIdMode: 'required',
    allowManualName: false,
  },
  {
    value: SailingAffiliation.MIT_ALUM,
    translationKey: 'affiliations.mit_alum',
    mitIdMode: 'optional',
    allowManualName: true,
  },
  {
    value: SailingAffiliation.MIT_FAMILY,
    translationKey: 'affiliations.mit_family',
    mitIdMode: 'optional',
    allowManualName: true,
  },
  {
    value: SailingAffiliation.MIT_AFFILIATE,
    translationKey: 'affiliations.mit_affiliate',
    mitIdMode: 'optional',
    allowManualName: true,
  },
  {
    value: SailingAffiliation.NON_MIT,
    translationKey: 'affiliations.non_mit',
    mitIdMode: 'hidden',
    allowManualName: true,
  },
] as const satisfies readonly SailingAffiliationRule[];

export const getSailingAffiliationOptions = () => sailingAffiliationRules;

export const getSailingAffiliationRule = (affiliation: SailingAffiliation) => {
  return sailingAffiliationRules.find((rule) => rule.value === affiliation)
    ?? sailingAffiliationRules[sailingAffiliationRules.length - 1];
};

export const isMitIdAsked = (affiliation: SailingAffiliation) => {
  return getSailingAffiliationRule(affiliation).mitIdMode !== 'hidden';
};

export const isMitIdRequired = (affiliation: SailingAffiliation) => {
  return getSailingAffiliationRule(affiliation).mitIdMode === 'required';
};

export const isManualNameAllowed = (affiliation: SailingAffiliation) => {
  return getSailingAffiliationRule(affiliation).allowManualName;
};
```

`src/libs/mit-sailing/sailingCardValidity.ts`:

```ts
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type SailingCardFields = {
  readonly sailingCardNumber: number | null;
  readonly sailingCardYear: number | null;
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardRequestedAt?: Date | null;
  readonly sailingCardSwimAgreementInitials: string | null;
};

export type SailingCardStatus = 'current' | 'pending_review' | 'needs_onboarding';

const venueTimeZone = 'America/New_York';

export const normalizeSailingCardInitials = (initials: string) => initials.trim().toUpperCase();

export const getCurrentSailingCardYear = (now = new Date()) => {
  const easternNow = toZonedTime(now, venueTimeZone);
  const year = easternNow.getFullYear();
  const rollover = new Date(year, 6, 15, 0, 0, 0, 0);

  if (easternNow >= rollover) {
    return year + 1;
  }

  return year;
};

export const getSailingCardExpirationDate = (cardYear: number) => {
  return fromZonedTime(new Date(cardYear, 6, 15, 0, 0, 0, 0), venueTimeZone);
};

export const hasCurrentSailingCard = (card: SailingCardFields, now = new Date()) => {
  if (card.sailingCardNumber === null || card.sailingCardYear === null) {
    return false;
  }

  if (card.sailingCardIssuedAt === null || card.sailingCardExpiresOn === null) {
    return false;
  }

  if (card.sailingCardSwimAgreementInitials === null) {
    return false;
  }

  return card.sailingCardYear === getCurrentSailingCardYear(now)
    && card.sailingCardExpiresOn > now;
};

export const getSailingCardStatus = (card: SailingCardFields, now = new Date()): SailingCardStatus => {
  if (hasCurrentSailingCard(card, now)) {
    return 'current';
  }

  if (card.sailingCardRequestedAt !== null && card.sailingCardRequestedAt !== undefined) {
    return 'pending_review';
  }

  return 'needs_onboarding';
};
```

`src/libs/mit-sailing/mitDataWarehouse.ts`:

```ts
import type { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

type MitDataWarehouseDb = {
  readonly mitDataWarehousePerson: {
    readonly findUnique: (args: {
      readonly where: { readonly mitId: string };
      readonly select: {
        readonly mitId: true;
        readonly firstName: true;
        readonly lastName: true;
        readonly kerberos: true;
        readonly classYear: true;
        readonly personType: true;
      };
    }) => Promise<{
      readonly mitId: string;
      readonly firstName: string;
      readonly lastName: string;
      readonly kerberos: string | null;
      readonly classYear: string | null;
      readonly personType: MitDataWarehousePersonType;
    } | null>;
  };
};

export const normalizeMitId = (mitId: string) => {
  const normalized = mitId.replaceAll(/\D/g, '');
  return normalized.length === 9 ? normalized : null;
};

export const lookupMitDataWarehouseIdentity = async (props: {
  readonly db?: MitDataWarehouseDb;
  readonly mitId: string;
}) => {
  const normalizedMitId = normalizeMitId(props.mitId);

  if (normalizedMitId === null) {
    return null;
  }

  const db = props.db ?? prisma;

  return db.mitDataWarehousePerson.findUnique({
    where: { mitId: normalizedMitId },
    select: {
      mitId: true,
      firstName: true,
      lastName: true,
      kerberos: true,
      classYear: true,
      personType: true,
    },
  });
};
```

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts src/libs/mit-sailing/sailingCardValidity.test.ts src/libs/mit-sailing/mitDataWarehouse.test.ts
```

Expected: tests fail before implementation and pass after implementation.

---

## Review Gate A: Data Model And Domain Rules

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingAffiliations.test.ts src/libs/mit-sailing/sailingCardValidity.test.ts src/libs/mit-sailing/mitDataWarehouse.test.ts
npm run check:types
```

Expected: tests pass and type checks pass.

Send this exact prompt to a fresh review sub-agent:

```text
Review only the Task 1 and Task 2 diff for bugs that a strict CodeRabbit review would catch. Focus on Prisma and ZenStack schema drift, migration SQL correctness, enum defaults, Postgres unique constraint behavior with nullable fields, card-year rollover at July 15 in America/New_York, MIT ID normalization, MIT Data Warehouse identity spoofing, accidental recreation of a members table, and generated Prisma enum imports. Return findings first, ordered by severity, with exact file and line references. For each finding, state the user impact and the smallest code or test change that would prove the fix. Do not comment on unrelated files or broad style preferences.
```

Pass condition:

- No unresolved schema, migration, date/time, identity, or type-safety findings remain.
- Every confirmed finding has a failing test or migration assertion before the fix.
- The phase is not committed until this gate is green.

---

## Task 3: Simplify Signup To Email And Password

**Files**

- `src/app/[locale]/(auth)/(center)/signup/SignUpForm.tsx`
- `src/app/[locale]/(auth)/(center)/signup/SignUpForm.test.tsx`
- `src/locales/en.json`

**Tests first**

Update the signup form tests so the main successful signup test does not look for a name input and still expects Better Auth to receive the email local-part as the display name:

```ts
expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
expect(signUpEmailMock).toHaveBeenCalledWith(expect.objectContaining({
  email: 'newuser@example.com',
  name: 'newuser',
}));
```

Keep the existing fallback-name assertion, but rename the test to:

```ts
it('creates account with email local part as temporary display name', async () => {
```

**Implementation**

In `SignUpForm.tsx`:

- Remove `name` state.
- Remove the visible name field.
- Keep:

```ts
const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
const displayName = localPart.trim() === '' ? normalizedEmail : localPart;
```

- Pass `displayName` to `authClient.signUp.email`.
- Keep callback URL behavior unchanged.

Update translation keys by removing unused signup name label/help text if no other component uses them.

Run:

```bash
npm run test -- src/app/[locale]/\(auth\)/\(center\)/signup/SignUpForm.test.tsx
```

Expected: signup tests pass and no visible name field is present.

---

## Task 4: Build Onboarding Validation And Server Actions

**Files**

- `src/libs/mit-sailing/sailingCardOnboarding.ts`
- `src/libs/mit-sailing/sailingCardOnboarding.test.ts`
- `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- `src/libs/mit-sailing/sailingCardOnboardingActions.test.ts`
- `src/utils/Helpers.ts`

**Tests first**

Create validation tests for:

- MIT student/faculty/staff requires valid MIT ID and matching DW identity.
- MIT alum/family/affiliate may use DW identity when MIT ID is valid.
- MIT alum/family/affiliate may submit manual first/last name when MIT ID is blank.
- Non-MIT users are not asked for MIT ID and must submit manual first/last name.
- Swim agreement initials normalize to uppercase and must be 2 to 6 alphabetic characters.

Use this core assertion shape:

```ts
await expect(buildSailingCardOnboardingUpdate({
  input: {
    affiliation: SailingAffiliation.MIT_STUDENT,
    mitId: '123456789',
    firstName: '',
    lastName: '',
    swimAgreementInitials: 'ak',
  },
  dataWarehouseIdentity: {
    mitId: '123456789',
    firstName: 'Ada',
    lastName: 'Lovelace',
    kerberos: 'ada',
    classYear: '2027',
    personType: MitDataWarehousePersonType.STUDENT,
  },
  now: new Date('2026-05-21T12:00:00-04:00'),
})).resolves.toEqual({
  firstName: 'Ada',
  lastName: 'Lovelace',
  name: 'Ada Lovelace',
  sailingAffiliation: SailingAffiliation.MIT_STUDENT,
  mitId: '123456789',
  mitClassYear: '2027',
  mitDataWarehouseVerifiedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingCardSwimAgreementInitials: 'AK',
  sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingCardNumber: null,
  sailingCardYear: null,
  sailingCardExpiresOn: null,
  sailingCardIssuedAt: null,
  sailingCardIssuedByUserId: null,
});
```

Create action tests that mock the authenticated user, Prisma update, and redirect helper:

- unauthenticated users redirect to login.
- successful submit updates only the current user.
- successful submit redirects to `/onboarding/success`.
- submit does not block users with admin permissions from `/admin`; that rule is enforced by route placement, not middleware.

**Implementation**

`src/libs/mit-sailing/sailingCardOnboarding.ts` owns pure validation and update construction. Export:

```ts
export type SailingCardOnboardingInput = {
  readonly affiliation: SailingAffiliation;
  readonly mitId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly swimAgreementInitials: string;
};

export const buildSailingCardOnboardingUpdate = async (props: {
  readonly input: SailingCardOnboardingInput;
  readonly dataWarehouseIdentity: MitDataWarehouseIdentity | null;
  readonly now: Date;
}) => {
```

Rules:

- Required MIT ID with no DW match returns field error `mitId`.
- Optional MIT ID with a valid DW match uses DW first/last/class year.
- Optional MIT ID with no value uses manual first/last.
- Optional MIT ID with invalid value returns field error `mitId`; this avoids silently ignoring a mistyped ID.
- Hidden MIT ID mode ignores submitted MIT ID and uses manual first/last.
- Manual first/last trims whitespace and requires at least 1 character each.
- `name` is always `${firstName} ${lastName}` after onboarding.
- Submitting onboarding clears old `sailingCardNumber`, `sailingCardYear`, `sailingCardExpiresOn`, `sailingCardIssuedAt`, and `sailingCardIssuedByUserId`.

`src/libs/mit-sailing/sailingCardOnboardingActions.ts` owns the server action:

```ts
'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/libs/DB';
import { getCurrentUser } from '@/libs/auth/getCurrentUser';
import { lookupMitDataWarehouseIdentity } from '@/libs/mit-sailing/mitDataWarehouse';
import { buildSailingCardOnboardingUpdate } from '@/libs/mit-sailing/sailingCardOnboarding';
import { getI18nPath } from '@/utils/Helpers';

export const submitSailingCardOnboardingAction = async (formData: FormData) => {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (user === null) {
    redirect(getI18nPath('/login?callbackUrl=/onboarding', locale));
  }

  const input = parseSailingCardOnboardingFormData(formData);
  const dataWarehouseIdentity = input.mitId.trim() === ''
    ? null
    : await lookupMitDataWarehouseIdentity({ mitId: input.mitId });
  const update = await buildSailingCardOnboardingUpdate({
    input,
    dataWarehouseIdentity,
    now: new Date(),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: update,
  });

  redirect(getI18nPath('/onboarding/success', locale));
};
```

Use the existing project auth helper name after confirming the exact function in `src/libs/auth`. Do not add middleware that redirects non-card users away from normal pages; card requirements are enforced at event-registration boundaries.

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts
```

Expected: validation and action tests pass.

---

## Task 5: Add The Onboarding Pages

**Files**

- `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`
- `src/app/[locale]/(marketing)/(site)/onboarding/success/page.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx`
- `src/locales/en.json`

**Tests first**

Component tests must cover:

- MIT student selection shows MIT ID and hides manual first/last.
- MIT alum selection shows MIT ID and manual first/last.
- Non-MIT selection hides MIT ID and shows manual first/last.
- The form includes a required initials control.
- The form action points at `submitSailingCardOnboardingAction`.

Use existing shared form components and select patterns from admin/event forms where possible.

**Implementation**

`page.tsx`:

- Require a signed-in user with the existing server auth helper.
- Do not redirect admins away from this page; they can complete their own onboarding if needed.
- Load current user card fields.
- If `hasCurrentSailingCard(user)` is true, show a compact current-card panel and a renewal button only when the current date is in the card year that can be renewed.
- Otherwise render `SailingCardOnboardingForm`.

`SailingCardOnboardingForm.tsx`:

- Client component only if dynamic field visibility needs local state.
- Use `getSailingAffiliationOptions()` to render options.
- Use translation keys for all labels and messages.
- Use native `required` attributes for fields that are visible and required.
- Keep name fields off the signup screen; onboarding is the first place real first/last name appears when DW cannot supply it.

`success/page.tsx`:

- Require signed-in user.
- Show a simple success message from `OnboardingSuccessPage` translations.
- Message copy key names:
  - `OnboardingSuccessPage.title`
  - `OnboardingSuccessPage.description`
  - `OnboardingSuccessPage.admin_link` when the user has admin access
  - `OnboardingSuccessPage.events_link`

Run:

```bash
npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
npm run check:i18n
```

Expected: onboarding UI tests and i18n check pass.

---

## Review Gate B: Signup And Onboarding Flow

Run:

```bash
npm run test -- src/app/[locale]/\(auth\)/\(center\)/signup/SignUpForm.test.tsx src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx
npm run check:i18n
npm run check:types
```

Expected: tests, i18n, and type checks pass.

Send this exact prompt to a fresh review sub-agent:

```text
Review only the Task 3 through Task 5 diff for bugs that a strict CodeRabbit review would catch. Focus on signup regressions, Better Auth payload correctness, hidden field trust, server-action authorization, redirect safety, MIT affiliation branching, required versus optional MIT ID behavior, DW-derived name spoofing, clearing stale card fields during onboarding, admin access not being blocked, missing translation keys, hard-coded user-visible strings, native required fields, and accessibility of conditional form fields. Return findings first, ordered by severity, with exact file and line references. For each finding, state the user impact and the smallest code or test change that would prove the fix. Do not comment on unrelated files or broad style preferences.
```

Pass condition:

- No unresolved signup, onboarding, auth, redirect, i18n, accessibility, or missing-test findings remain.
- A signed-in user without a card can reach `/onboarding`.
- An authorized admin without a card can still reach `/admin`.
- The phase is not committed until this gate is green.

---

## Task 6: Add Admin Card Queries And Actions

**Files**

- `src/libs/admin/cards/adminSailingCardQueries.ts`
- `src/libs/admin/cards/adminSailingCardQueries.test.ts`
- `src/libs/admin/cards/adminSailingCardActions.ts`
- `src/libs/admin/cards/adminSailingCardActions.test.ts`
- `src/libs/admin/cards/adminSailingCardPermissions.ts`

**Tests first**

Queries:

- `getNextAvailableSailingCardNumber` returns `60` when no current-year cards exist.
- It skips used current-year numbers and returns the first free number `>= 60`.
- It ignores previous card years.
- It does not reserve the number.

Actions:

- `issueSailingCardAction` requires `CARDS_ASSIGN_NUMBER`.
- Blank manual card number uses suggested number.
- Manual card number accepts a positive integer, including `1` through `59`.
- Duplicate `(sailingCardYear, sailingCardNumber)` maps Prisma unique conflict to a field-level error and does not crash the page.
- Issuing a card sets expiration, issued date, issuer, card year, card number, and keeps normalized swim initials.
- Issuing a card writes `UserAudit` with old and new card values.
- `expireSailingCardAction` requires `CARDS_EXPIRE`, clears current card fields, clears yearly swim initials, and writes `UserAudit`.

**Implementation**

`adminSailingCardPermissions.ts`:

```ts
import { AppPermission } from '@/libs/auth/appPermissions';

export const sailingCardReviewPermissions = [
  AppPermission.CARDS_REVIEW,
  AppPermission.CARDS_APPROVE,
  AppPermission.CARDS_ASSIGN_NUMBER,
] as const;
```

Use the existing permission-checking helpers from admin actions. Keep permission names already present in `src/libs/auth/appPermissions.ts`.

`adminSailingCardQueries.ts` exports:

```ts
export const getNextAvailableSailingCardNumber = async (props: {
  readonly cardYear: number;
}) => {
  const assignedCards = await prisma.user.findMany({
    where: {
      sailingCardYear: props.cardYear,
      sailingCardNumber: { not: null },
    },
    select: { sailingCardNumber: true },
    orderBy: { sailingCardNumber: 'asc' },
  });

  const usedNumbers = new Set(assignedCards.flatMap((card) => (
    card.sailingCardNumber === null ? [] : [card.sailingCardNumber]
  )));

  let nextNumber = 60;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return nextNumber;
};
```

`adminSailingCardActions.ts`:

- Wrap issue and expire in `prisma.$transaction`.
- On issue, lock correctness with the database unique constraint, not a sequence table.
- Catch Prisma unique constraint errors for `sailingCardYear_sailingCardNumber` and return action state with `cardNumber` error.
- Revalidate `/admin/cards`, `/admin/users/[id]`, and the target user's public account/onboarding routes using `getI18nPath`.
- Never redirect the acting admin out of `/admin` based on their own card state.

Run:

```bash
npm run test -- src/libs/admin/cards/adminSailingCardQueries.test.ts src/libs/admin/cards/adminSailingCardActions.test.ts
```

Expected: admin card query/action tests pass.

---

## Task 7: Add Admin Card Workflow UI

**Files**

- `src/app/[locale]/(marketing)/(site)/admin/cards/page.tsx`
- `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.tsx`
- `src/components/mit-sailing/admin/cards/AdminSailingCardIssueForm.tsx`
- `src/components/mit-sailing/admin/cards/AdminSailingCardHistory.tsx`
- `src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- `src/components/mit-sailing/admin/AdminNavigation.tsx` or the existing admin nav component
- `src/locales/en.json`

**Tests first**

Component tests must cover:

- Pending users are listed with name, email, affiliation, MIT ID when present, initials, request date, and suggested card number.
- The issue form allows blank card number for auto-assignment.
- The issue form accepts manual card number.
- The history component renders previous card numbers from `UserAudit`.
- Admin users page includes a sailing-card panel without replacing existing ratings and account panels.

**Implementation**

Admin cards page:

- Requires admin access using existing admin route patterns.
- Lists users with `sailingCardRequestedAt` present and no current card.
- Shows the next suggested number for the current card year.
- Provides issue and expire actions.
- Keeps dense admin layout; no marketing-style hero.

User detail page:

- Add a card panel that shows current status, current card number/year/expires date, swim initials timestamp, and issuer.
- Add old-card history by querying `UserAudit` rows for card-related changes.
- Do not let the card panel block other user administration.

Navigation:

- Add an Admin nav entry labeled from translations, route `/admin/cards`, visible to users who have at least one card-review permission.

Run:

```bash
npm run test -- src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx
npm run check:i18n
```

Expected: admin card UI tests and i18n check pass.

---

## Review Gate C: Admin Card Issuance

Run:

```bash
npm run test -- src/libs/admin/cards/adminSailingCardQueries.test.ts src/libs/admin/cards/adminSailingCardActions.test.ts src/components/mit-sailing/admin/cards/AdminSailingCardQueue.test.tsx
npm run check:i18n
npm run check:types
```

Expected: tests, i18n, and type checks pass.

Send this exact prompt to a fresh review sub-agent:

```text
Review only the Task 6 and Task 7 diff for bugs that a strict CodeRabbit review would catch. Focus on app-permission enforcement, dock staff versus dock master behavior, manual card numbers 1 through 59, automatic card numbers starting at 60, duplicate card number races, Prisma unique-conflict handling, audit completeness, old card number visibility, clearing versus preserving swim initials, revalidatePath coverage, admin navigation visibility, and whether the admin workflow can be used without editing unrelated user data. Return findings first, ordered by severity, with exact file and line references. For each finding, state the user impact and the smallest code or test change that would prove the fix. Do not comment on unrelated files or broad style preferences.
```

Pass condition:

- No unresolved authorization, concurrency, audit, numbering, revalidation, or admin usability findings remain.
- Duplicate card number assignment produces a recoverable form error.
- Old card numbers are visible from `UserAudit`.
- The phase is not committed until this gate is green.

---

## Task 8: Add Event Card Requirement To Admin Event Editing

**Files**

- `src/libs/admin/events/eventAdminSchemas.ts`
- `src/libs/admin/events/eventAdminSchemas.test.ts`
- `src/libs/admin/events/eventAdminQueries.ts`
- `src/libs/admin/events/eventAdminQueries.test.ts`
- `src/libs/admin/events/eventAdminActions.ts`
- `src/libs/admin/events/eventAdminActions.test.ts`
- `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- `src/components/mit-sailing/admin/events/AdminEventFormView.test.tsx`
- `src/components/mit-sailing/admin/events/AdminEventEditorControls.tsx`
- `src/components/mit-sailing/admin/events/AdminEventEditorControls.test.tsx`
- `src/locales/en.json`

**Tests first**

Add schema tests:

- Missing `sailingCardRequirement` defaults to `NONE` for existing event forms.
- `NONE` and `CURRENT_CARD` parse.
- Unknown values fail validation.

Add component tests:

- Event form renders a sailing-card requirement dropdown.
- Intro-class seeded/editable event can be configured as `NONE`.
- A normal race or rental event can be configured as `CURRENT_CARD`.

**Implementation**

In `eventAdminBasicsFormSchema`, add:

```ts
sailingCardRequirement: z.nativeEnum(EventSailingCardRequirement).default(EventSailingCardRequirement.NONE),
```

In admin form defaults, map database value to form value. In submit mapping, persist the enum value to `Event.sailingCardRequirement`.

Place the dropdown in the registration/settings section, not in class metadata. This keeps card policy explicit and avoids accidentally exempting an event because it has a related intro class in seed data.

Translation keys:

- `AdminEventsPage.form.sailing_card_requirement_label`
- `AdminEventsPage.form.sailing_card_requirement_none`
- `AdminEventsPage.form.sailing_card_requirement_current_card`
- `AdminEventsPage.form.sailing_card_requirement_help`

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/components/mit-sailing/admin/events/AdminEventEditorControls.test.tsx
npm run check:i18n
```

Expected: event admin tests and i18n check pass.

---

## Task 9: Enforce Card Requirements In Public Event Registration

**Files**

- `src/libs/mit-sailing/eventRegistrationActions.ts`
- `src/libs/mit-sailing/eventRegistrationActions.test.ts`
- `src/components/mit-sailing/events/EventRegistrationForm.tsx` or current public registration component
- `src/locales/en.json`

**Tests first**

Add action tests:

- User without card can register for event with `sailingCardRequirement: NONE`.
- User without card cannot register for event with `CURRENT_CARD`.
- User with pending onboarding cannot register for `CURRENT_CARD`.
- User with expired card cannot register for `CURRENT_CARD`.
- User with current card can register for `CURRENT_CARD`.
- Admin route access is not part of this action and is not affected.

**Implementation**

When loading the locked event row in `createPublicEventRegistrationAction`, include:

```ts
sailingCardRequirement: true,
```

Before creating/updating registration, check:

```ts
if (lockedEvent.sailingCardRequirement === EventSailingCardRequirement.CURRENT_CARD) {
  const currentUser = await tx.user.findUnique({
    where: { id: user.id },
    select: {
      sailingCardNumber: true,
      sailingCardYear: true,
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardRequestedAt: true,
      sailingCardSwimAgreementInitials: true,
    },
  });

  if (currentUser === null || !hasCurrentSailingCard(currentUser)) {
    return {
      status: 'error',
      message: t('errors.current_sailing_card_required'),
    };
  }
}
```

Use the actual action-state type already present in `eventRegistrationActions.ts`; do not introduce a parallel state shape. Keep the check inside the transaction so the accepted registration observes the same event policy that was locked.

Public UI:

- Show a compact message on the event detail/registration area when `CURRENT_CARD` is required.
- For missing card, link to `/onboarding`.
- For intro classes with `NONE`, do not show a blocking message.

Run:

```bash
npm run test -- src/libs/mit-sailing/eventRegistrationActions.test.ts
npm run check:i18n
```

Expected: registration action tests and i18n check pass.

---

## Task 10: Expire Stale Cards On Card-Sensitive Paths

**Files**

- `src/libs/mit-sailing/sailingCardExpiration.ts`
- `src/libs/mit-sailing/sailingCardExpiration.test.ts`
- `src/libs/mit-sailing/eventRegistrationActions.ts`
- `src/libs/admin/cards/adminSailingCardQueries.ts`
- `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`

**Tests first**

Create tests:

- A card with `sailingCardExpiresOn <= now` is cleared.
- Clearing removes card number, card year, expiration date, issue date, issuer, request date, and swim initials.
- Clearing writes `UserAudit` with previous card values.
- A current card is not changed.
- Event registration card gate treats stale cards as inactive before returning the user-facing error.

**Implementation**

Export:

```ts
export const expireStaleSailingCardForUser = async (props: {
  readonly userId: string;
  readonly now?: Date;
  readonly actorUserId?: string;
}) => {
```

Behavior:

- Load the target user card fields.
- If `sailingCardExpiresOn` is `null` or greater than `now`, return `{ expired: false }`.
- If stale, run a transaction that clears the card fields and creates a `UserAudit` row.
- The audit actor is `actorUserId` when an admin initiated it and `null` for automatic path-based expiration.

Wire this helper into:

- `/onboarding` page load before deciding whether the user needs onboarding.
- `/admin/cards` query before listing card status.
- `createPublicEventRegistrationAction` before checking `CURRENT_CARD`.

This gives users the correct post-July-15 behavior without a separate sequence table or card-history table.

Run:

```bash
npm run test -- src/libs/mit-sailing/sailingCardExpiration.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: stale card tests and registration gate tests pass.

---

## Review Gate D: Event Eligibility And Expiration

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/components/mit-sailing/admin/events/AdminEventEditorControls.test.tsx src/libs/mit-sailing/eventRegistrationActions.test.ts src/libs/mit-sailing/sailingCardExpiration.test.ts
npm run check:i18n
npm run check:types
```

Expected: tests, i18n, and type checks pass.

Send this exact prompt to a fresh review sub-agent:

```text
Review only the Task 8 through Task 10 diff for bugs that a strict CodeRabbit review would catch. Focus on explicit event-level card policy, intro classes not requiring a card, no class-relation inferred exemptions, event registration transaction boundaries, stale event policy reads, expired card treatment, July 15 America/New_York rollover behavior, path-based expiration audit logs, user-facing errors, i18n keys, and making sure admin access is not affected by event-card gating. Return findings first, ordered by severity, with exact file and line references. For each finding, state the user impact and the smallest code or test change that would prove the fix. Do not comment on unrelated files or broad style preferences.
```

Pass condition:

- No unresolved event-policy, transaction, expiration, date/time, i18n, or missing-test findings remain.
- Users without cards can register for events configured as `NONE`.
- Users without current cards cannot register for events configured as `CURRENT_CARD`.
- The phase is not committed until this gate is green.

---

## Task 11: Add Seed Defaults For Event Requirements

**Files**

- `src/data/mit-sailing/classesFleetSeed.ts`
- `src/data/mit-sailing/eventsSeed.ts`
- `src/data/mit-sailing/eventsSeed.test.ts`

**Tests first**

Update `src/data/mit-sailing/eventsSeed.test.ts` so:

- Intro-class events are seeded with `EventSailingCardRequirement.NONE`.
- Non-intro events that represent normal member activity can be seeded with `CURRENT_CARD`.
- The `evt-dinghy-cup` relation to intro class does not cause an inferred exemption; only the event field matters.

**Implementation**

Add `sailingCardRequirement` to seed records explicitly. Use `NONE` for the three intro classes. Use `CURRENT_CARD` for events where a participant must already be a card-holding sailor. If seed records are demonstration data and the current product text does not require a card for a specific event, choose `NONE` and let admins change it in the event editor.

Run:

```bash
npm run test -- src/data/mit-sailing/eventsSeed.test.ts
```

Expected: seed tests pass.

---

## Task 12: Final Verification

Run the focused checks first:

```bash
npm run test -- src/libs/mit-sailing src/libs/admin/cards src/libs/admin/events src/components/mit-sailing/onboarding src/components/mit-sailing/admin/cards
```

Then run the repo gates:

```bash
npm run test
npm run lint
npm run check:types
npm run check:i18n
```

Run e2e only after unit/component gates are green:

```bash
npm run test:e2e
```

Run the final pre-PR bug hunt:

```bash
git diff --name-only
```

Expected: output contains only files required by this plan.

Send this exact prompt to a fresh review sub-agent:

```text
Review the full sailing-card onboarding diff for bugs that a strict CodeRabbit PR review would catch. Focus on cross-phase regressions: schema fields used before generated types exist, admin authorization gaps, event registration bypasses, stale card expiration paths, MIT Data Warehouse identity trust boundaries, signup and onboarding regressions, user audit completeness, data-loss risk, date/time bugs around July 15 America/New_York, revalidatePath coverage, translation coverage, accessibility regressions, and tests that pass while missing the actual product behavior. Return findings first, ordered by severity, with exact file and line references. For each finding, state the user impact and the smallest code or test change that would prove the fix. Do not comment on unrelated files or broad style preferences.
```

If CodeRabbit CLI is authenticated, run:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md
```

Expected: `CodeRabbit raised 0 issues.` If CodeRabbit raises issues, fix confirmed critical, major, security, authorization, data-loss, migration, concurrency, date/time, cache/revalidation, i18n, accessibility, and missing-test findings before publishing the PR.

Expected final state:

- New signup asks only email, password, and password confirmation.
- `/onboarding` collects affiliation, MIT ID when applicable, first/last name when DW cannot supply it, and swim agreement initials.
- MIT-required affiliations cannot complete onboarding without a valid DW identity.
- Successful onboarding lands on `/onboarding/success`.
- Staff/admin card queue can issue suggested numbers starting at `60`.
- Staff/admin can manually assign any positive unused number.
- Duplicate card number assignment gives a clean retry error.
- Old card numbers are visible through `UserAudit` history.
- Intro events with `NONE` allow registration without a card.
- Events with `CURRENT_CARD` reject users without a current issued card.
- Admin access is not blocked by onboarding or card expiration.
- Expired cards are treated as inactive after July 15 US Eastern.

## Self-Review

- The plan keeps current user data on `User` and does not introduce a member table.
- The plan avoids a sequence table; uniqueness is enforced by `(sailingCardYear, sailingCardNumber)` and conflicts return an admin-facing retry error.
- The plan keeps card requirements event-level and explicit, so intro-class exceptions do not depend on class relationships.
- The plan accounts for name collection moving off signup and into onboarding with MIT DW-derived identity when available.
- The plan includes admin visibility into old card numbers through `UserAudit`.
- The plan preserves `/admin` access by avoiding middleware-level sailing-card redirects.
- The plan includes CodeRabbit-style review gates between implementation phases.
- The plan includes red-first tests, exact file paths, allowed repo commands, and final verification gates.
