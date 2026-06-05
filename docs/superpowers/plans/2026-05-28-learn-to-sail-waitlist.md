# Learn-to-Sail Waitlist Implementation Plan

> **Superseded for implementation:** Do not implement from this plan directly.
> The current Learn-to-Sail waitlist source of truth is
> `docs/superpowers/specs/2026-06-03-learn-to-sail-waitlist-feature-start.md`
> plus the approved static prototype in
> `docs/superpowers/specs/learn-to-sail-waitlist-prototype/index.html`.
> This earlier plan predates later product corrections about Apr 1 setup,
> SMS, normal calendar event page URLs, class request timing, waitlist closure,
> and full-page UX. Use it only as historical context.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a seasonal Learn-to-Sail Waitlist that makes the beginner-class path obvious, stops midnight signup behavior, and keeps experienced sailors out of an unnecessary waitlist.

**Architecture:** Add first-class seasonal waitlist records, event-level waitlist management settings, and registration metadata that lets waitlist-managed beginner classes use the existing pending/approved event registration lifecycle. Users request a spot by creating a pending registration; admins confirm the spot by approving that registration.

**Tech Stack:** Next.js App Router, Server Actions, Prisma, ZenStack, PostgreSQL, next-intl, existing MIT Sailing admin/public components, existing worker/email patterns.

---

## Scope

This plan is only for the regular Learn-to-Sail path that leads to the Tech Sailing Rating.

In scope:
- Rename the user-facing concept from Priority Queue to **Learn-to-Sail Waitlist**.
- Add a current-season waitlist that opens April 1 and expires after October 15.
- Let users choose between `I want a beginner class` and `I can already sail`.
- Save that path choice so signed-in users are not asked the same question on every beginner class page.
- Put beginner-class users on the current-season waitlist when they choose the beginner path and are not already on it.
- Keep `Intro for Experienced Sailors` off the waitlist.
- Add event admin settings that mark which class events use the Learn-to-Sail Waitlist.
- Use `Request a spot` on waitlist-managed class pages and emails.
- Explain that spot confirmation is based on waitlist order, not click time.
- Show current waitlist spot in admin user detail and waitlist-managed event rosters.
- Close the active waitlist entry automatically when the Tech Sailing Rating is awarded.
- Close active waitlist records when an account is deleted.

Out of scope:
- Racing memberships and racing subscription billing.
- Viral referral or sharing mechanics.
- Admin removal from the waitlist.
- A post-Tech Sailing Rating education email. Track that future PR in GitHub issue #134.
- Replacing all event registration language for non-waitlist events.

## User-Facing Language

Use these exact labels unless a later copy pass changes all affected keys together:

| Surface | Copy |
| --- | --- |
| Onboarding fork heading | `Which path fits you?` |
| Beginner path option | `I want a beginner class` |
| Experienced path option | `I can already sail` |
| Waitlist name | `2026 Learn-to-Sail Waitlist` |
| Beginner event primary action | `Request a spot` |
| Beginner event requested state | `Spot requested` |
| Confirmed event state | `You have a spot` |
| Waitlist rule sentence | `Spots are confirmed from the Learn-to-Sail Waitlist. Requesting early does not change your position.` |
| Class-open email subject | `June 7, 9:30 AM: Request a spot for Sunday All-in-One` |
| Confirmed email subject | `June 7, 9:30 AM: You have a spot in Sunday All-in-One` |

Do not use `seat`, `priority queue`, or `register` for waitlist-managed beginner classes in public CTAs.

## Why MIT Sailing Uses This Waitlist

1. Demand is larger than beginner-class capacity, so a single seasonal queue is fairer than rewarding people who can click at midnight.
2. Beginner classes lead to the Tech Sailing Rating, so the Pavilion needs a controlled path that prioritizes unrated sailors who still need the regular membership training path.
3. Admins need operational flexibility to fill real class rosters, handle no-shows, and make exceptions without presenting public signup order as the source of truth.

## PR Breakdown

Keep each PR below 80 changed files.

1. **PR 1: Waitlist Domain Foundation**
   - Database schema, migrations, generated Prisma/ZenStack output, domain helpers, and tests.
   - No public UI beyond redirects or inert helper functions.
2. **PR 2: Public Beginner Path**
   - Onboarding fork, sign-in completion checks, public event CTA/status, class/calendar entry behavior, and public tests.
3. **PR 3: Admin and Notifications**
   - Event admin boolean/select, waitlist-aware registration roster, admin user waitlist spot display, class request-open emails, spot-confirmed emails, annual reset reminders, and worker tests.

Before implementation, count generated Prisma and ZenStack files changed by PR 1. If schema generation alone makes PR 1 exceed 80 changed files, split PR 1 into:
- **PR 1a:** schema, migration, generated clients.
- **PR 1b:** domain helpers, actions, queries, and tests.

## Data Model

Edit `zenstack/schema.zmodel` first. `prisma/schema.prisma` is generated from ZenStack and should only be updated by generation. Because `AGENTS.md` restricts `npm run` scripts and `npm run db:generate` does not regenerate ZenStack output, schema workers must use this explicit non-npm workflow:

```bash
npx zen check --schema zenstack/schema.zmodel
npx zen generate --schema zenstack/schema.zmodel
npx prisma generate
```

Then create the migration SQL using the repo's normal maintainer-approved Prisma workflow. Do not run disallowed `npm run db:*` scripts from agent tasks unless `AGENTS.md` is updated.

```prisma
enum LearnToSailWaitlistEntryStatus {
    active
    left
    closed_by_tech_rating
    closed_by_account_deletion
    expired
}

enum LearnToSailManagedClassKind {
    none
    beginner_mid_week_123
    beginner_sunday_all_in_one
}

enum LearnToSailPathChoice {
    beginner
    experienced
}

model LearnToSailWaitlistEntry {
    id String @id() @default(cuid())
    seasonYear Int @map("season_year")
    userId String @map("user_id")
    activeEntryKey String? @unique @map("active_entry_key")
    sequence Int
    status LearnToSailWaitlistEntryStatus @default(active)
    joinedAt DateTime @default(now()) @map("joined_at")
    closedAt DateTime? @map("closed_at")
    closureReason String? @map("closure_reason") @db.Text()
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    eventRegistrations EventRegistration[]

    @@unique([seasonYear, sequence])
    @@index([seasonYear, status, sequence])
    @@index([userId, seasonYear])
    @@map("learn_to_sail_waitlist_entries")
}

```

`activeEntryKey` is `${seasonYear}:${userId}` only while the row is active and `null` after the user leaves, receives the Tech Sailing Rating, expires, or is otherwise closed. This preserves same-season history while allowing a user who left to rejoin later with a new sequence at the end of the waitlist.

Add `learnToSailManagedClassKind LearnToSailManagedClassKind @default(none) @map("learn_to_sail_managed_class_kind")` to `Event`.

Add `learnToSailPathChoice LearnToSailPathChoice? @map("learn_to_sail_path_choice")` to `User`.

Add these fields to `EventRegistration`:
- `learnToSailWaitlistEntryId String? @map("learn_to_sail_waitlist_entry_id")`
- `learnToSailAuditPositionAtRequest Int? @map("learn_to_sail_audit_position_at_request")`
- relation `learnToSailWaitlistEntry LearnToSailWaitlistEntry? @relation(fields: [learnToSailWaitlistEntryId], references: [id], onDelete: SetNull)`
- index `@@index([learnToSailWaitlistEntryId])`

Add relations to `User`:
- `learnToSailWaitlistEntries LearnToSailWaitlistEntry[]`

## File Map

Create:
- `src/libs/mit-sailing/learnToSailSeason.ts`: season-year and active-window helpers for April 1 through October 15 in US Eastern time.
- `src/libs/mit-sailing/learnToSailWaitlist.ts`: pure helpers for labels, positions, status transitions, and Tech Sailing Rating detection.
- `src/libs/mit-sailing/learnToSailWaitlistActions.ts`: user Server Actions for join and leave with typed confirmation.
- `src/libs/mit-sailing/learnToSailWaitlistQueries.ts`: public and admin read models.
- `src/libs/mit-sailing/learnToSailWaitlistExpiration.ts`: lazy/job-safe expiration helper for old active entries.
- `src/libs/mit-sailing/learnToSailWaitlistEmailContent.ts`: subject/body builders for waitlist email jobs.
- `src/components/mit-sailing/events/LearnToSailPathChoice.tsx`: lightweight path fork for already-onboarded users entering from event pages.
- `src/worker/learnToSailWaitlistEmailJob.ts`: scheduled email sender for class-open and yearly reset notices.
- `emails/learn-to-sail-waitlist.tsx`: React email template.
- `prisma/migrations/<timestamp>_learn_to_sail_waitlist/migration.sql`

Modify:
- `prisma/schema.prisma`
- `zenstack/schema.zmodel`
- `src/generated/**` after generation.
- `src/libs/mit-sailing/eventQueries.ts`
- `src/libs/mit-sailing/eventRegistrationState.ts`
- `src/libs/mit-sailing/eventRegistrationActions.ts`
- `src/libs/admin/events/eventAdminSchemas.ts`
- `src/libs/admin/events/eventAdminActions.ts`
- `src/libs/admin/events/eventAdminQueries.ts`
- `src/components/mit-sailing/events/EventDetailView.tsx`
- `src/components/mit-sailing/events/EventRegistrationCta.tsx`
- `src/components/mit-sailing/events/EventRegistrationForm.tsx`
- `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx`
- `src/components/mit-sailing/events/EventCalendarOccurrenceRow.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`
- `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- `src/app/[locale]/(marketing)/(site)/onboarding/success/page.tsx`
- `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- `src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx`
- `src/components/mit-sailing/admin/users/AdminUserRatingsPanel.tsx`
- `src/libs/admin/users/adminUserRatingActions.ts`
- `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- `src/locales/en.json`

## Task 1: Domain Schema and Season Helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `zenstack/schema.zmodel`
- Create: `src/libs/mit-sailing/learnToSailSeason.ts`
- Create: `src/libs/mit-sailing/learnToSailSeason.test.ts`

- [ ] **Step 1: Write failing season helper tests**

```ts
import {
  getLearnToSailSeasonForDate,
  isLearnToSailWaitlistSeasonOpen,
} from '@/libs/mit-sailing/learnToSailSeason';

describe('learnToSailSeason', () => {
  it('uses the current eastern season between April 1 and October 15', () => {
    expect(
      getLearnToSailSeasonForDate(new Date('2026-04-01T12:00:00-04:00'))
    ).toBe(2026);
    expect(
      getLearnToSailSeasonForDate(new Date('2026-10-15T12:00:00-04:00'))
    ).toBe(2026);
  });

  it('uses the upcoming season before April 1', () => {
    expect(
      getLearnToSailSeasonForDate(new Date('2026-03-10T12:00:00-04:00'))
    ).toBe(2026);
  });

  it('uses the next season after October 15', () => {
    expect(
      getLearnToSailSeasonForDate(new Date('2026-10-16T12:00:00-04:00'))
    ).toBe(2027);
  });

  it('opens the waitlist during the sailing season', () => {
    expect(
      isLearnToSailWaitlistSeasonOpen(
        new Date('2026-04-01T00:00:00-04:00')
      )
    ).toBe(true);
    expect(
      isLearnToSailWaitlistSeasonOpen(
        new Date('2026-10-16T00:00:00-04:00')
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/learnToSailSeason.test.ts`

Expected: fail because `learnToSailSeason.ts` does not exist.

- [ ] **Step 3: Add season helper implementation**

```ts
import { formatNyDateTimeLocalInput } from '@/lib/mit-sailing/nyTime';

const WAITLIST_START_MONTH = 4;
const WAITLIST_START_DAY = 1;
const WAITLIST_END_MONTH = 10;
const WAITLIST_END_DAY = 15;

type EasternDateParts = {
  readonly day: number;
  readonly month: number;
  readonly year: number;
};

function easternDateParts(date: Date): EasternDateParts {
  const [datePart = ''] = formatNyDateTimeLocalInput(date).split('T');
  const [year = '', month = '', day = ''] = datePart.split('-');
  return {
    day: Number(day),
    month: Number(month),
    year: Number(year),
  };
}

function isOnOrAfter(parts: EasternDateParts, month: number, day: number) {
  return parts.month > month || (parts.month === month && parts.day >= day);
}

function isOnOrBefore(parts: EasternDateParts, month: number, day: number) {
  return parts.month < month || (parts.month === month && parts.day <= day);
}

export function getLearnToSailSeasonForDate(date: Date): number {
  const parts = easternDateParts(date);
  if (isOnOrAfter(parts, WAITLIST_START_MONTH, WAITLIST_START_DAY)) {
    return isOnOrBefore(parts, WAITLIST_END_MONTH, WAITLIST_END_DAY)
      ? parts.year
      : parts.year + 1;
  }
  return parts.year;
}

export function isLearnToSailWaitlistSeasonOpen(date: Date): boolean {
  const parts = easternDateParts(date);
  return (
    isOnOrAfter(parts, WAITLIST_START_MONTH, WAITLIST_START_DAY) &&
    isOnOrBefore(parts, WAITLIST_END_MONTH, WAITLIST_END_DAY)
  );
}
```

- [ ] **Step 4: Add schema and migration**

Add the enums, `LearnToSailWaitlistEntry`, Event field, EventRegistration metadata fields, and User relations from the Data Model section to `zenstack/schema.zmodel`. Run:

```bash
npx zen check --schema zenstack/schema.zmodel
npx zen generate --schema zenstack/schema.zmodel
npx prisma generate
```

Create the migration through the maintainer-approved Prisma workflow, then inspect the SQL to confirm:
- `learn_to_sail_waitlist_entries` has unique `active_entry_key` and unique `(season_year, sequence)`.
- `event_registrations.learn_to_sail_waitlist_entry_id` is nullable and indexed.
- `event_registrations.learn_to_sail_audit_position_at_request` is nullable.
- `events.learn_to_sail_managed_class_kind` defaults to `none`.
- `users.learn_to_sail_path_choice` is nullable.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run test -- src/libs/mit-sailing/learnToSailSeason.test.ts
npm run check:types
```

Expected: season tests and typecheck pass after generated clients are updated.

## Task 2: Waitlist Join, Leave, and Position Queries

**Files:**
- Create: `src/libs/mit-sailing/learnToSailWaitlist.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlist.test.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlistActions.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlistActions.test.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlistQueries.ts`

- [ ] **Step 1: Write tests for join behavior**

```ts
import { buildLearnToSailWaitlistLabel } from '@/libs/mit-sailing/learnToSailWaitlist';

describe('learnToSailWaitlist', () => {
  it('names the waitlist by season', () => {
    expect(buildLearnToSailWaitlistLabel(2026)).toBe(
      '2026 Learn-to-Sail Waitlist'
    );
  });
});
```

- [ ] **Step 2: Add pure helper**

```ts
export function buildLearnToSailWaitlistLabel(seasonYear: number): string {
  return `${seasonYear} Learn-to-Sail Waitlist`;
}
```

- [ ] **Step 3: Add action tests for idempotent join and typed leave**

Mock `requireCurrentUser`, `prisma`, and `revalidatePath` following `src/libs/mit-sailing/eventRegistrationActions.test.ts`. Cover:
- Joining creates the next sequence for the current season.
- Joining twice returns the existing active entry.
- Leaving requires the typed value `LEAVE`.
- Leaving marks the entry `left` and does not delete history.

- [ ] **Step 4: Implement join action with a transaction**

Implementation contract:
- Use `requireCurrentUser`.
- Use `getLearnToSailSeasonForDate(new Date())`.
- If `isLearnToSailWaitlistSeasonOpen(new Date())` is false, return a typed error and create no row.
- If the user already has a current-season active entry, return it.
- If the user left earlier in the same season, create a new active row with a new sequence at the end of the waitlist.
- Assign `sequence` inside a transaction guarded by a Postgres advisory transaction lock for the season, for example `pg_advisory_xact_lock(hashtext('learn_to_sail_waitlist:' || seasonYear))`.
- Set `activeEntryKey` to `${seasonYear}:${userId}` only on active rows.
- Clear `activeEntryKey` when a row leaves, expires, or closes.
- Revalidate `/onboarding`, `/onboarding/success`, `/events`, and `/profile/ratings`.

- [ ] **Step 5: Implement leave action**

Implementation contract:
- Read confirmation from `formData.get('confirmation')`.
- If it is not `LEAVE`, return a typed error state.
- Update the current-season active entry to `left` with `closedAt`.
- Set `activeEntryKey` to `null`.
- Do not expose admin removal.

- [ ] **Step 6: Add concurrency, rejoin, and season tests**

Cover:
- April 1 00:00 Eastern permits join.
- October 15 23:59:59 Eastern permits join.
- October 16 00:00 Eastern rejects join.
- March 31 rejects join.
- Concurrent joins by different users allocate unique ordered sequences.
- Concurrent duplicate joins by the same user return one active entry.
- Same-season leave then rejoin creates a new active entry at the end of the waitlist.

- [ ] **Step 7: Implement position queries**

`getCurrentLearnToSailWaitlistStatusForUser` returns:

```ts
export type LearnToSailWaitlistUserStatus = {
  readonly entryId: string | null;
  readonly isActive: boolean;
  readonly position: number | null;
  readonly seasonYear: number;
  readonly status: 'active' | 'missing' | 'closed';
};
```

Position is count of active entries in the same season with `sequence <= entry.sequence`.

- [ ] **Step 8: Run verification**

Run:

```bash
npm run test -- src/libs/mit-sailing/learnToSailWaitlist.test.ts src/libs/mit-sailing/learnToSailWaitlistActions.test.ts
npm run check:types
```

Expected: tests and typecheck pass.

## Task 3: Public Beginner Path and Onboarding Fork

**Files:**
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormSections.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingFormModel.ts`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/onboarding/success/page.tsx`
- Modify: `src/locales/en.json`
- Test: existing onboarding component/action tests.

- [ ] **Step 1: Add i18n keys**

Add keys under `OnboardingPage`:

```json
{
  "learn_to_sail_path_heading": "Which path fits you?",
  "learn_to_sail_path_beginner": "I want a beginner class",
  "learn_to_sail_path_experienced": "I can already sail",
  "learn_to_sail_path_beginner_hint": "Join this year's Learn-to-Sail Waitlist, then request spots in beginner classes you can attend.",
  "learn_to_sail_path_experienced_hint": "Skip the waitlist and choose Intro for Experienced Sailors.",
  "learn_to_sail_waitlist_joined": "You are on the {seasonYear} Learn-to-Sail Waitlist.",
  "learn_to_sail_waitlist_position": "Current spot: #{position}",
  "learn_to_sail_waitlist_rule": "Spots are confirmed from the Learn-to-Sail Waitlist. Requesting early does not change your position.",
  "learn_to_sail_experienced_next": "Choose Intro for Experienced Sailors from the class calendar."
}
```

- [ ] **Step 2: Write component tests for the fork**

Test that a user without Tech Sailing Rating sees:
- Heading `Which path fits you?`
- Option `I want a beginner class`
- Option `I can already sail`
- No availability question.

Test that selecting beginner calls the join action after onboarding completes. Test that selecting experienced does not join the waitlist.

- [ ] **Step 3: Add form model value**

Add `learnToSailPath: 'beginner' | 'experienced' | ''` to the onboarding form model after the existing required sailing-card fields are complete. Keep the fork as a compact radio group, not a new long form.

- [ ] **Step 4: Save the path choice and wire beginner selection to waitlist join**

In `submitSailingCardOnboardingAction`, after the sailing-card onboarding transaction succeeds:
- Save `User.learnToSailPathChoice` as `beginner` or `experienced` for users without Tech Sailing Rating.
- If `learnToSailPath === 'beginner'`, call the shared waitlist join helper for the same user.
- If `learnToSailPath === 'experienced'`, do not create a waitlist entry.
- Redirect to success with a state that lets the success page show the next action.

- [ ] **Step 5: Update success page**

Show one concise next step:
- Beginner path: waitlist label, current spot, rule sentence, and two direct class paths: `Sunday All-in-One` and `Mid-Week 1-2-3`.
- Experienced path: link to Intro for Experienced Sailors.
- Users who already have Tech Sailing Rating do not see the waitlist prompt.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run test -- src/components/mit-sailing/onboarding src/libs/mit-sailing/sailingCardOnboardingActions.test.ts
npm run check:i18n
npm run check:types
```

Expected: all pass.

## Task 4: Event Admin Waitlist Settings

**Files:**
- Modify: `src/libs/admin/events/eventAdminSchemas.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- Modify: `src/locales/en.json`
- Tests: existing admin event form/action/query tests.

- [ ] **Step 1: Add admin i18n keys**

Add keys under `AdminEvents`:

```json
{
  "field_learn_to_sail_managed_class_kind": "Learn-to-Sail waitlist",
  "field_learn_to_sail_managed_class_kind_hint": "Use this only for beginner classes where spot confirmation comes from the Learn-to-Sail Waitlist.",
  "learn_to_sail_managed_none": "No waitlist",
  "learn_to_sail_managed_mid_week_123": "Beginner Mid-Week 1-2-3",
  "learn_to_sail_managed_sunday_all_in_one": "Beginner Sunday All-in-One"
}
```

- [ ] **Step 2: Add schema field and validation**

Parse `learnToSailManagedClassKind` from admin basics form as a Prisma enum. Validation rules:
- `none` is allowed for all events.
- Waitlist-managed kinds require `registrationMode === standard`.
- Waitlist-managed kinds force `requiresApproval === true`.
- Waitlist-managed kinds cannot use team registration.

- [ ] **Step 3: Add form control**

In `AdminEventFormView.tsx`, add a select in the registration section:
- `No waitlist`
- `Beginner Mid-Week 1-2-3`
- `Beginner Sunday All-in-One`

Use `adminNativeSelectClassName` and existing `AdminEventField`.

- [ ] **Step 4: Update queries and actions**

Include `learnToSailManagedClassKind` in admin editor DTOs, create actions, update actions, and tests.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run test -- src/libs/admin/events src/components/mit-sailing/admin/events
npm run check:i18n
npm run check:types
```

Expected: all pass.

## Task 5: Public Event Page Spot Request Flow

**Files:**
- Modify: `src/libs/mit-sailing/eventQueries.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationState.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationActions.ts`
- Modify: `src/components/mit-sailing/events/EventDetailView.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationCta.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationForm.tsx`
- Modify: `src/locales/en.json`
- Tests: existing public event tests plus new waitlist tests.

- [ ] **Step 1: Add public event i18n keys**

Add keys under `MitSailingEvents`:

```json
{
  "learn_to_sail_waitlist_status": "{seasonYear} Learn-to-Sail Waitlist: position #{position}",
  "learn_to_sail_waitlist_missing": "Join the {seasonYear} Learn-to-Sail Waitlist before requesting beginner class spots.",
  "learn_to_sail_waitlist_rule": "Spots are confirmed from the Learn-to-Sail Waitlist. Requesting early does not change your position.",
  "learn_to_sail_join_waitlist_button": "Join waitlist",
  "learn_to_sail_request_spot_button": "Request a spot",
  "learn_to_sail_spot_requested": "Spot requested",
  "learn_to_sail_spot_confirmed": "You have a spot",
  "learn_to_sail_check_path_button": "Check my path",
  "learn_to_sail_request_window": "Requests open {start} and close {end}.",
  "learn_to_sail_register_heading": "Request a spot",
  "learn_to_sail_register_submit": "Request a spot",
  "learn_to_sail_register_success": "Spot requested",
  "learn_to_sail_calendar_badge": "Waitlist",
  "learn_to_sail_class_full_admin": "This class is full."
}
```

- [ ] **Step 2: Write public CTA tests**

Cover:
- Signed-out waitlist-managed event shows `Check my path`.
- Signed-in unrated user without saved beginner path shows `Check my path`.
- Signed-in already-onboarded user can choose `I want a beginner class` from the event path without repeating full onboarding.
- Signed-in unrated user with saved experienced path shows Intro for Experienced Sailors guidance, not a waitlist CTA.
- Signed-in unrated user with saved beginner path but without current-season waitlist shows `Join waitlist`.
- Signed-in beginner-path user can click `Join waitlist`, see current position, then see `Request a spot`.
- Signed-in unrated user with current-season waitlist shows `Request a spot`.
- Existing request shows `Spot requested`.
- Confirmed request shows `You have a spot`.
- Experienced class event with `learnToSailManagedClassKind === none` keeps normal registration language.

- [ ] **Step 3: Extend public event DTO**

Add to `PublicEventDetail`:

```ts
learnToSailManagedClassKind:
  | 'none'
  | 'beginner_mid_week_123'
  | 'beginner_sunday_all_in_one';
```

Add viewer waitlist state to the page query or compose it in the page before rendering the CTA.

- [ ] **Step 4: Route unknown users through the path fork**

For waitlist-managed events:
- If signed out, show `Check my path` and preserve the event URL as callback.
- If signed in, unrated, and `learnToSailPathChoice` is null, show the lightweight fork with `Which path fits you?`, `I want a beginner class`, and `I can already sail`. This is for existing onboarded users and must not repeat the full sailing-card onboarding form.
- If signed in, unrated, and `learnToSailPathChoice === experienced`, show the experienced-class next step and do not show a waitlist CTA.
- If signed in, unrated, and `learnToSailPathChoice === beginner`, allow joining the current-season waitlist when missing.
- If signed in and already on the current-season waitlist, allow `Request a spot`.

- [ ] **Step 5: Make request-a-spot registration-backed**

Use the existing public event registration path for waitlist-managed events. The primary CTA says `Request a spot`, but submit creates a normal `EventRegistration` with `status: pending`; it is not auto-accepted.

The waitlist-managed registration branch:
- Requires signed-in user.
- Requires event `learnToSailManagedClassKind !== none`.
- Requires `requiresApproval === true`.
- Requires active current-season waitlist entry.
- Requires the waitlist season to be open.
- Requires the event's first date to belong to the same Learn-to-Sail season as the active waitlist entry.
- Rejects users who already have the Tech Sailing Rating.
- Rejects left, closed, deleted, or expired waitlist entries.
- Creates or returns the existing non-cancelled `EventRegistration`.
- Sets `EventRegistration.status` to `pending` for new requests.
- Sets `learnToSailWaitlistEntryId` to the active waitlist entry.
- Sets `learnToSailAuditPositionAtRequest` only when the registration is first created.
- Concurrent duplicate submits return the original pending registration without changing `learnToSailAuditPositionAtRequest`.
- Does not approve the user; only an admin status update to `approved` confirms the spot.
- Does not change waitlist sequence.
- Revalidates the event detail and admin roster paths.

- [ ] **Step 6: Keep regular event registration semantics**

In `createPublicEventRegistrationAction`, branch waitlist-managed events through the validations above and keep the existing approval lifecycle:
- pending means `Spot requested`
- approved means `You have a spot`
- cancelled on a waitlist-managed event means the user did not get a spot or cancelled their request

- [ ] **Step 7: Update the register page copy**

For `/events/[slug]/register` on waitlist-managed events:
- page heading uses `Request a spot`
- submit button uses `Request a spot`
- success redirect state uses `Spot requested`
- page-level note includes the waitlist rule sentence
- the page must not show `Register`, `Submit registration request`, or generic approval copy as the primary language
- add an explicit waitlist-managed label builder or prop set for `EventRegistrationForm` so generic registration labels cannot leak through when `learnToSailManagedClassKind !== none`

Add a component or route test asserting a waitlist-managed register page never shows `Register` or `Submit registration request`.

- [ ] **Step 8: Update event detail UI**

For waitlist-managed events:
- Replace normal register CTA with waitlist status.
- Show request window if present.
- Show the rule sentence directly under the button.
- The request-window sentence must never stand alone. Always pair it with `Spots are confirmed from the Learn-to-Sail Waitlist. Requesting early does not change your position.`
- Use `Request a spot`, not `Register`, `Request a seat`, or `Join class`.

- [ ] **Step 9: Update calendar rows**

Calendar rows remain navigational, but waitlist-managed beginner classes should carry a compact `Waitlist` badge and must not show any text that implies first-click registration. Clicking the row goes to the event detail page, where path choice and request status are resolved.

Add `learnToSailManagedClassKind` to the calendar DTO used by `listPublishedEventDatesForCalendarMonth`, update `EventCalendarOccurrenceRow.tsx`, and add tests for the badge.

- [ ] **Step 10: Run verification**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts src/components/mit-sailing/events src/app/[locale]/\\(marketing\\)/\\(site\\)/events/[slug]/register/page.test.tsx
npm run check:i18n
npm run check:types
```

Expected: all pass.

## Task 6: Admin Registration Approval, User Detail, and Rating Grant Closure

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- Modify: `src/components/mit-sailing/admin/users/AdminUserRatingsPanel.tsx`
- Modify: `src/libs/admin/users/adminUserRatingActions.ts`
- Modify: `src/locales/en.json`
- Tests: admin event roster, admin user page, rating action tests.

- [ ] **Step 1: Add admin user/event i18n keys**

Add keys:

```json
{
  "learn_to_sail_waitlist_spot": "Waitlist spot",
  "learn_to_sail_waitlist_not_active": "No active Learn-to-Sail Waitlist entry",
  "learn_to_sail_registration_confirm": "Confirm spot",
  "learn_to_sail_registration_not_confirmed": "No spot this time",
  "learn_to_sail_registration_current_position": "Current waitlist spot",
  "rating_tech_closes_waitlist_hint": "This user is on the {seasonYear} Learn-to-Sail Waitlist. Awarding the Tech Sailing Rating will close their waitlist entry.",
  "rating_grant_success": "Tech Sailing Rating awarded."
}
```

- [ ] **Step 2: Add admin query fields**

For waitlist-managed rosters, include:
- current active waitlist position
- registration status
- waitlist audit position at request for hidden audit metadata only

For admin user detail, include the user’s current-season waitlist status and position.

- [ ] **Step 3: Make the existing registration roster waitlist-aware**

For waitlist-managed events, the existing registration roster is the spot request list because `Request a spot` creates a pending `EventRegistration`. Group and sort registrations as:
1. pending requests, sorted by current active waitlist position ascending
2. approved spots, sorted by current active waitlist position ascending
3. cancelled rows, sorted by registration creation time descending

Use visible section headings or counters for `Pending requests`, `Approved spots`, and `Cancelled` so cancelled rows are not mistaken for active requests.

Display the current waitlist spot as the primary operational field. Do not display `learnToSailAuditPositionAtRequest` by default because it can imply click timing matters.

- [ ] **Step 4: Reuse event registration approval actions with waitlist copy**

Use the existing `updateAdminEventRegistrationStatusAction` status transitions. For waitlist-managed events:
- `approved` means `You have a spot`
- `pending` means `Spot requested`
- `cancelled` uses existing cancelled registration behavior. The MVP does not add event-registration audit fields just to distinguish whether an admin or user cancelled.
- If an admin chooses not to confirm a pending request, the action label can be `No spot this time`, but the persisted event-registration state remains the existing `cancelled` status.

Guardrails:
- Do not approve beyond `maxParticipants` unless a future explicit overbooking feature is added.
- Over-capacity approval attempts should show `This class is full.`, not a waitlist-position error.
- Do not add admin waitlist removal controls.
- Do not change the user’s waitlist sequence.
- Revalidate event admin, public event detail, and user detail paths.

- [ ] **Step 5: Show waitlist spot in registration roster**

Display:
- `Waitlist spot: #42`

Keep it as a roster field, not a new action column.

- [ ] **Step 6: Show waitlist spot in admin user detail**

Add a compact row near ratings or sailing-card details:
- active current-season position
- status if closed or missing

- [ ] **Step 7: Close waitlist on Tech Sailing Rating grant**

In `grantAdminUserRatingAction`, inside the same transaction that creates `UserSailingRating`:
- Detect the Tech Sailing Rating by stable slug or seeded ID.
- If granted rating is Tech Sailing Rating, update active current-season waitlist entry to `closed_by_tech_rating`.
- Do not close on class completion without rating.
- Do not close when a class spot is confirmed.
- Do not close on non-Tech ratings.
- Duplicate/idempotent Tech Sailing Rating grants must not mutate the closure twice.

- [ ] **Step 8: Keep success copy simple**

The rating screen may show the pre-submit hint. After save, the visible success should only be `Tech Sailing Rating awarded.` The audit/history can store the waitlist closure detail.

- [ ] **Step 9: Run verification**

Run:

```bash
npm run test -- src/libs/admin/users/adminUserRatingActions.test.ts src/components/mit-sailing/admin/users src/components/mit-sailing/admin/events/AdminEventRegistrationsView.test.tsx
npm run check:i18n
npm run check:types
```

Expected: all pass.

## Task 7: Expiration and Account Deletion Cleanup

**Files:**
- Inspect and modify the existing account deletion path after locating it with `rg -n "delete.*user|account.*delete|user.delete|deleteMany" src`.
- Modify: `src/libs/mit-sailing/learnToSailWaitlist.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlistExpiration.ts`
- Create: `src/libs/mit-sailing/learnToSailWaitlistExpiration.test.ts`
- Tests: account deletion tests or new focused action tests.

- [ ] **Step 1: Add expiration helper**

Implement `expirePastLearnToSailWaitlistEntries(now)`:
- If `now` is October 16 or later in US Eastern time, close active entries for seasons earlier than `getLearnToSailSeasonForDate(now)`.
- Set `status` to `expired`.
- Set `closedAt`.
- Set `activeEntryKey` to `null`.
- Keep historical event registrations intact, but expired waitlist entries must not count as active positions or receive waitlist emails.

- [ ] **Step 2: Test expiration**

Cover:
- October 15 does not expire the current season.
- October 16 expires active entries from the completed season.
- Expired entries are suppressed from waitlist emails.
- Current-season queries ignore expired rows.

- [ ] **Step 3: Locate the account deletion workflow**

Run: `rg -n "delete.*user|account.*delete|user.delete|deleteMany" src`

Expected: identify the Server Action or admin handler that deletes accounts.

- [ ] **Step 4: Add deletion cleanup helper**

Implement `closeActiveLearnToSailWaitlistForDeletedAccount` with:
- if the app soft-deletes users, active entries become `closed_by_account_deletion`, `activeEntryKey` becomes `null`, and pending waitlist-managed event registrations become `cancelled`.
- if the app hard-deletes users, `onDelete: Cascade` removes waitlist entries and event registrations through existing relations. Do not claim retained audit in the hard-delete path.

- [ ] **Step 5: Call helper in the deletion workflow**

Call the helper in the deletion transaction. If the final workflow hard-deletes the user, assert the rows are gone by cascade. If it soft-deletes the user, assert the rows remain closed.

- [ ] **Step 6: Run verification**

Run the targeted account deletion tests and:

```bash
npm run check:types
```

Expected: targeted tests and typecheck pass.

## Task 8: Emails and Annual Reset Reminders

**Files:**
- Create: `src/libs/mit-sailing/learnToSailWaitlistEmailContent.ts`
- Create: `src/worker/learnToSailWaitlistEmailJob.ts`
- Create: `emails/learn-to-sail-waitlist.tsx`
- Modify: existing worker registration after inspecting `src/worker`
- Tests: worker/email content tests.

- [ ] **Step 1: Write email content tests**

Cover:
- Class-open subject starts with the event date and time.
- Spot-confirmed subject starts with the event date and time.
- Body includes current waitlist position.
- Body says spots are based on waitlist, not click time.
- Suppresses users with Tech Sailing Rating.
- Suppresses experienced-path users without a waitlist entry.
- Suppresses deleted accounts and users who left the waitlist.

- [ ] **Step 2: Implement content builders**

Subject examples:
- `June 7, 9:30 AM: Request a spot for Sunday All-in-One`
- `June 7, 9:30 AM: You have a spot in Sunday All-in-One`
- `June 7, 9:30 AM: No spot this time for Sunday All-in-One`
- `The 2026 Learn-to-Sail Waitlist is open`

- [ ] **Step 3: Implement class-open job**

For waitlist-managed beginner events:
- Send only to active current-season waitlist users without Tech Sailing Rating.
- Include current spot and `Request a spot` link.
- Do not say they are accepted.

- [ ] **Step 4: Implement decision emails**

When admins confirm or mark not confirmed:
- Confirmed: tell them they have a spot.
- Not confirmed: tell them they are still on the current-season waitlist.

- [ ] **Step 5: Implement yearly reset notice**

Send after April 1 to eligible unrated users:
- tell them the new Learn-to-Sail Waitlist is open.
- include one action: join this year’s waitlist.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run test -- src/worker/learnToSailWaitlistEmailJob.test.ts src/libs/mit-sailing/learnToSailWaitlistEmailContent.test.ts
npm run check:i18n
npm run check:types
```

Expected: all pass.

## Task 9: End-to-End Coverage

**Files:**
- Create: `tests/e2e/LearnToSailWaitlist.e2e.ts`
- Modify helpers only if existing helpers cannot seed waitlist states.

- [ ] **Step 1: Add e2e flow for beginner user**

Scenario:
- New user completes onboarding.
- Chooses `I want a beginner class`.
- Sees current waitlist spot.
- Sees `Sunday All-in-One` as a direct next action.
- Opens a waitlist-managed Sunday class.
- Sees `Request a spot`.
- Requests a spot.
- Sees `Spot requested`.

- [ ] **Step 2: Add e2e flow for experienced user**

Scenario:
- New user completes onboarding.
- Chooses `I can already sail`.
- Does not get a waitlist entry.
- Sees Intro for Experienced Sailors path.
- Opening a beginner waitlist-managed event later does not join the waitlist automatically.
- Experienced class keeps normal registration behavior.

- [ ] **Step 3: Add e2e flow for non-MIT beginner**

Scenario:
- Non-MIT beginner completes onboarding.
- Chooses `I want a beginner class`.
- Joins the current-season Learn-to-Sail Waitlist.
- Opens a beginner class and requests a spot.

- [ ] **Step 4: Add e2e flow for midnight-signup clarity**

Scenario:
- On a waitlist-managed beginner event, assert the page contains the rule sentence and does not use `Register` as the primary CTA.

- [ ] **Step 5: Run e2e verification**

Run:

```bash
npm run test:e2e -- tests/e2e/LearnToSailWaitlist.e2e.ts
```

Expected: the focused waitlist e2e file passes.

## Final Verification

Run:

```bash
npm run lint
npm run check:types
npm run check:i18n
npm run test
npm run test:e2e -- tests/e2e/LearnToSailWaitlist.e2e.ts
```

Expected: all commands pass.

## Review Checklist

- The beginner path says `I want a beginner class`, not `I cannot sail`.
- The experienced path says `I can already sail` and does not join the waitlist.
- Beginner class pages say `Request a spot`, not `Request a seat`.
- The rule sentence is visible anywhere a user can request a spot.
- Request timing does not affect waitlist position.
- The waitlist is seasonal and users rejoin each year.
- Admins can tell which events use the waitlist from the event editor.
- Admins can see current waitlist spot on user detail and waitlist-managed rosters.
- Tech Sailing Rating grant closes the active waitlist entry.
- Class completion without Tech Sailing Rating does not close the waitlist entry.
- Account deletion closes or removes active waitlist state consistently with the app deletion model.
- No racing membership behavior changes are included.
