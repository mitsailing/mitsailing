# Event Hosts And Hidden Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace event creator-based management with event host membership and add Cal.com-style hidden events that are unlisted but still directly viewable.

**Architecture:** Keep PR #94 focused on role/CASL permissions; implement this as a follow-up PR because it changes schema, seed data, public event queries, admin event forms, sitemap, and E2E behavior. `createdByUserId` is removed from `Event`; `EventHost` becomes the event-scoped management relation; `Event.hidden` controls public discovery only while `Event.isPublished` remains the draft/live gate.

**Tech Stack:** TypeScript, Next.js App Router, Prisma 7, PostgreSQL migrations, CASL Prisma, next-intl, Vitest, Playwright.

---

## Scope Decision

Do this in a new PR after #94 lands. PR #94 already changes authorization and permissions; adding schema/data visibility behavior would make review harder and increase migration risk.

Current PR #94 should only keep the CASL shape compatible with a later relation rename:

- Do not add `hidden` in PR #94.
- Do not rename `event_admins` in PR #94.
- Keep `createdByUserId` out of authorization rules.
- If PR #94 touches docs again, remove stale wording that describes `createdByUserId` as event ownership.

## Product Decisions

- Event management relation: `EventHost` / `event_hosts`.
- Join fields: `eventId @map("event_id")`, `userId @map("user_id")`.
- Join primary key: `@@id([eventId, userId])`, plus `@@index([userId])`.
- Event public-discovery field: `hidden Boolean @default(false)`.
- Keep `isPublished Boolean @map("is_published")` as the draft/live gate.
- Public listings, calendars, home upcoming, sitemap, and class-related event lists include only `isPublished: true` and `hidden: false`.
- Direct `/events/[slug]` renders when `isPublished: true`, even if `hidden: true`.
- Direct `/events/[slug]` also renders for an assigned event host or global event manager when `isPublished: false`.
- Public registration remains allowed only when `isPublished: true`; hidden published events can still be registered through the direct URL.
- Event hosts are flat peers: any host can add/remove any other host, no roles, no owner.
- Event hosts cannot remove themselves.
- Any event host can delete the event.

## Sources Used

- Cal.com uses `EventType.hidden Boolean @default(false)` and `Host` for event-type membership.
- Rails boolean convention favors predicate-friendly adjective columns such as `hidden`, not `is_hidden`.
- Prisma explicit many-to-many docs support a relation model with `@@id([leftId, rightId])`.
- Local rule to update after this decision: `.cursor/rules/prisma-catalog-visibility.mdc`.
- Web Interface Guidelines apply to the admin form/list UI changes: labels, focus states, checkbox hit targets, specific button labels, and destructive confirmation.
- Next.js app-router conventions in this repo require async `params`, RSC data access, and `getI18nPath` for redirects/links.

## File Structure

- Modify `prisma/schema.prisma`: remove event creator relation, replace `EventAdmin` with `EventHost`, add `Event.hidden`.
- Create `prisma/migrations/20260518193000_event_hosts_hidden_events/migration.sql`: backfill host rows, remove creator FK/column, add hidden column.
- Modify `src/data/mit-sailing/eventsSeed.ts`: remove `created_by`, rename `EventAdmin` seed type/data to event hosts, add `hidden`.
- Modify `prisma/seedMitSailing/steps.ts`: seed `hidden`, seed `eventHost`, stop writing `createdByUserId`.
- Modify `src/libs/auth/permissions.ts`: CASL event relation condition uses `hosts.some.userId`.
- Modify `src/libs/admin/events/eventAdminAuthorization.ts`: event access records select `hosts`, not `admins`; access predicates use host membership.
- Modify `src/libs/admin/events/eventAdminQueries.ts`: DTOs expose `hidden`, `hosts`, and no event creator metadata.
- Modify `src/libs/admin/events/eventAdminActions.ts`: create event host row for creator; update hosts without allowing self-removal; write `hidden`; delete event through verified access.
- Modify `src/libs/admin/events/eventAdminSchemas.ts`: parse `hidden` from admin forms.
- Modify `src/locales/en.json`: rename event-admin copy to event-host copy and add hidden-event labels/hints.
- Modify admin event UI files under `src/components/mit-sailing/admin/events/`: change Published/Draft copy to Published/Hidden/Draft where needed; rename “event admins” section to “event hosts”; update stories and component tests.
- Modify public event query modules under `src/libs/mit-sailing/`: filter discovery by `hidden: false`, allow host preview on direct detail, keep registration gated by `isPublished`.
- Modify public event pages under `src/app/[locale]/(marketing)/(site)/events/`: update imports/calls for the renamed direct-detail query.
- Modify admin related-event picker page `src/app/[locale]/(marketing)/(site)/admin/[resource]/[id]/related-events/page.tsx` if it lists published events and must omit hidden events.
- Modify `src/app/sitemap.ts`: omit hidden event pages.
- Modify tests listed in the GitHub issue plus source-discovered tests: `src/libs/mit-sailing/eventQueries.test.ts`, `src/libs/mit-sailing/eventRegistrationActions.test.ts`, `src/libs/mit-sailing/eventRegistrationState.test.ts`, `src/components/mit-sailing/events/EventRegistrationForm.test.tsx`, `src/components/mit-sailing/admin/events/AdminEventShared.test.tsx`, `tests/e2e/AdminEvents.e2e.ts`, and hidden-event public E2E coverage.

## Task 1: Schema And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518193000_event_hosts_hidden_events/migration.sql`
- Generated after migration: `src/generated/prisma/**`

- [ ] **Step 1: Write the expected Prisma schema change**

In `prisma/schema.prisma`, change the event/user relations to this shape:

```prisma
model User {
  eventHosts EventHost[]
}

model Event {
  hidden Boolean @default(false)
  hosts  EventHost[]

  @@index([hidden, isPublished])
}

model EventHost {
  eventId String @map("event_id")
  userId  String @map("user_id")
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([eventId, userId])
  @@index([userId])
  @@map("event_hosts")
}
```

Remove `Event.createdByUserId`, `Event.createdBy`, `Event.admins`, `User.eventAdmins`, `User.eventsCreated`, and `model EventAdmin`.

- [ ] **Step 2: Create the SQL migration**

Create a migration that preserves data:

```sql
ALTER TABLE "events"
  ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "event_hosts" (
  "event_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "event_hosts_pkey" PRIMARY KEY ("event_id", "user_id")
);

INSERT INTO "event_hosts" ("event_id", "user_id")
SELECT DISTINCT "event_id", "admin_user_id"
FROM "event_admins";

INSERT INTO "event_hosts" ("event_id", "user_id")
SELECT DISTINCT "id", "created_by"
FROM "events"
ON CONFLICT ("event_id", "user_id") DO NOTHING;

CREATE INDEX "event_hosts_user_id_idx" ON "event_hosts"("user_id");
CREATE INDEX "events_hidden_is_published_idx" ON "events"("hidden", "is_published");

ALTER TABLE "event_hosts"
  ADD CONSTRAINT "event_hosts_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_hosts"
  ADD CONSTRAINT "event_hosts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_created_by_fkey";
DROP INDEX IF EXISTS "events_created_by_idx";
DROP TABLE "event_admins";

ALTER TABLE "events" DROP COLUMN "created_by";
```

- [ ] **Step 3: Run migration/generate**

Run: `npm run db:migrate:dev`

Expected: Prisma applies the new migration and regenerates `src/generated/prisma/**`.

- [ ] **Step 4: Run type check for schema fallout**

Run: `SKIP_ENV_VALIDATION=true npm run check:types`

Expected: FAIL with references to removed `createdBy`, `createdByUserId`, `admins`, `adminUserId`, or `eventAdmin`.

## Task 2: Seeds And Test Data

**Files:**
- Modify: `src/data/mit-sailing/eventsSeed.ts`
- Modify: `prisma/seedMitSailing/steps.ts`

- [ ] **Step 1: Update seed types**

Change the event seed type:

```ts
export type Event = {
  id: string;
  name: string;
  short_name: string;
  event_category_id: string;
  description: string;
  slug: string;
  is_special: boolean;
  max_participants: number | null;
  requires_approval: boolean;
  registration_start: string | null;
  registration_end: string | null;
  created_at: string;
  detail_page_kind?: EventDetailPageKind;
  external_detail_url?: string | null;
  internal_notes?: string;
  is_published: boolean;
  hidden: boolean;
};

export type EventHost = {
  event_id: string;
  user_id: string;
};
```

Rename `EVENT_ADMINS` to `EVENT_HOSTS`. Remove `created_by` from all event rows. Preserve former creators by adding matching `EVENT_HOSTS` rows.

- [ ] **Step 2: Update seed writes**

In `seedEvents`, remove `createdByUserId` and add `hidden: e.hidden`.

In `seedEventRelatedRows`, replace `p.eventAdmin.upsert` with `p.eventHost.upsert` using composite id:

```ts
await p.eventHost.upsert({
  where: {
    eventId_userId: {
      eventId: host.event_id,
      userId: host.user_id,
    },
  },
  create: {
    eventId: host.event_id,
    userId: host.user_id,
  },
  update: {},
});
```

- [ ] **Step 3: Run seed-related type check**

Run: `SKIP_ENV_VALIDATION=true npm run check:types`

Expected: Remaining failures move from seed files to app/query/action files.

## Task 3: Authorization And Event Host Access

**Files:**
- Modify: `src/libs/auth/permissions.ts`
- Modify: `src/libs/auth/permissions.test.ts`
- Modify: `src/libs/admin/events/eventAdminAuthorization.ts`
- Modify: `src/libs/admin/events/eventAdminAuthorization.test.ts`

- [ ] **Step 1: Update failing permission tests first**

In `src/libs/auth/permissions.test.ts`, replace event subject fixtures with:

```ts
createEventAbilitySubject({
  hosts: [{ userId: 'user-1' }],
})
```

and assert creator-only access no longer exists because `createdByUserId` is gone.

- [ ] **Step 2: Implement CASL relation rename**

Change the event ability record:

```ts
export type EventAbilityRecord = {
  hosts: readonly {
    userId: string;
  }[];
};
```

Change the scoped event rule:

```ts
can(AuthAction.UPDATE, AuthSubject.EVENT, {
  hosts: { some: { userId } },
});
```

- [ ] **Step 3: Update admin event access helper**

In `eventAdminAuthorization.ts`, replace `admins` selection with:

```ts
hosts: { select: { userId: true } }
```

and remove `createdByUserId` from `AdminEventAccessRecord`.

- [ ] **Step 4: Run focused auth tests**

Run:

```bash
npm run test -- src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: PASS.

## Task 4: Admin Event Queries And Mutations

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminSchemas.ts`
- Modify: related tests under `src/libs/admin/events/*.test.ts`

- [ ] **Step 1: Update DTOs and tests for hosts/hidden**

Rename DTOs:

```ts
export type AdminEventHostDto = {
  userId: string;
  user: AdminEventUserOption;
};
```

Add `hidden: boolean` to `AdminEventListRow` and `AdminEventEditorDto`. Remove `createdBy` from `AdminEventEditorDto`.

- [ ] **Step 2: Update create/update basics schema**

Change schema input from `isPublished` only to both booleans:

```ts
isPublished: z.boolean(),
hidden: z.boolean(),
```

Update raw form parsing:

```ts
hidden: formCheckbox(formData, 'hidden'),
```

- [ ] **Step 3: Update create event action**

On create, write:

```ts
hidden: data.hidden,
hosts: {
  create: {
    userId: session.user.id,
  },
},
```

Do not write `createdByUserId`.

- [ ] **Step 4: Update event basics action**

On update, write:

```ts
hidden: data.hidden,
isPublished: data.isPublished,
```

- [ ] **Step 5: Replace host update action**

Rename `updateAdminEventAdminsAction` to `updateAdminEventHostsAction`. Parse `hostUserId` fields. Fetch the existing host ids for the event and enforce self-removal block only when the current user is already a host:

```ts
const existingHosts = await tx.eventHost.findMany({
  where: { eventId: verifiedEventId },
  select: { userId: true },
});
const currentUserWasHost = existingHosts.some(
  (host) => host.userId === access.session.user.id
);
if (currentUserWasHost && !hostUserIds.includes(access.session.user.id)) {
  redirect(editUrlWithError(locale, slug, 'validation_failed'));
}
```

Then replace rows in `eventHost` with composite rows.

- [ ] **Step 6: Run focused admin tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts
```

Expected: PASS.

## Task 5: Public Event Visibility Queries

**Files:**
- Modify: `src/libs/mit-sailing/eventQueries.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationActions.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationState.ts`
- Modify: `src/libs/mit-sailing/homeUpcomingFromPrisma.ts`
- Modify: `src/libs/mit-sailing/classRelatedOccurrences.ts`
- Modify: `src/libs/mit-sailing/classQueries.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/events/[slug]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/events/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/[resource]/[id]/related-events/page.tsx`
- Modify: `src/app/sitemap.ts`
- Test: `src/libs/mit-sailing/eventQueries.test.ts`
- Test: `src/libs/mit-sailing/eventRegistrationActions.test.ts`
- Test: `src/libs/mit-sailing/eventRegistrationState.test.ts`

- [ ] **Step 1: Add query helper semantics**

Create a helper in `eventQueries.ts`:

```ts
function publicEventDiscoveryWhere(): Prisma.EventWhereInput {
  return { isPublished: true, hidden: false };
}
```

- [ ] **Step 2: Update direct detail query**

Rename `getPublishedEventForPublicBySlug` to `getEventForPublicOrHostBySlug`. First query the public event by slug and `isPublished: true`. If that returns null and there is a signed-in user, build the same CASL event ability used by admin event access and query the preview path by slug plus `eventAccessWhere`:

```ts
const publicEvent = await prisma.event.findFirst({
  where: { slug, isPublished: true },
  select: eventDetailSelect,
});
if (publicEvent || !currentUserId) {
  return publicEvent ? eventDetailFromDb(publicEvent) : null;
}
const eventAccessWhere = await getEventAccessWhereForUser(currentUserId);
if (!eventAccessWhere) {
  return null;
}
const previewEvent = await prisma.event.findFirst({
  where: { AND: [{ slug }, eventAccessWhere] },
  select: eventDetailSelect,
});
return previewEvent ? eventDetailFromDb(previewEvent) : null;
```

Do not require `hidden: false` for direct detail.

- [ ] **Step 3: Update discovery queries**

Use `publicEventDiscoveryWhere()` in calendar category, calendar bounds, calendar date, home upcoming, class-related occurrences, class detail related-event queries, admin related-event picker queries, and sitemap event slug queries. Update `src/app/[locale]/(marketing)/(site)/events/[slug]/page.tsx` and `src/app/[locale]/(marketing)/(site)/events/[slug]/register/page.tsx` to import the renamed direct-detail query.

- [ ] **Step 4: Keep registration live-only**

In `eventRegistrationActions.ts`, keep registration create/cancel queries gated by `isPublished: true`. Do not filter on `hidden`.

- [ ] **Step 5: Run focused public tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts src/libs/mit-sailing/eventRegistrationState.test.ts
```

Expected: PASS.

## Task 6: Admin UI And Copy

**Files:**
- Modify: `src/components/mit-sailing/admin/events/AdminEventCreateFormView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventShared.stories.tsx`
- Modify: `src/components/mit-sailing/events/EventDetailView.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationForm.test.tsx`
- Modify: `src/locales/en.json`
- Test: `src/components/mit-sailing/admin/events/AdminEventShared.test.tsx`
- Test: `tests/e2e/AdminEvents.e2e.ts`

- [ ] **Step 1: Rename UI copy**

Update translations:

```json
"section_hosts": "Event hosts",
"hosts_subtitle": "Hosts can edit this event, manage registrations, and delete the event.",
"field_hidden": "Hide from public calendar",
"field_hidden_hint": "Hidden events are not listed publicly, but anyone with the direct link can view and register once published.",
"status_hidden": "Hidden",
"registration_login_note": "Use your MIT Sailing account so event hosts can match the registration to you.",
"registration_requires_approval_note": "An event host will review and confirm your registration."
```

Replace “Contacts / event admins” with “Event hosts”. Replace public registration copy that says “event admin” with “event host” and update `EventRegistrationForm.test.tsx`.

- [ ] **Step 2: Update basics forms**

Add a `hidden` checkbox next to the publish checkbox. Keep `isPublished` as “Published”. Use `AdminEventCheckbox` so the hidden fallback input behavior remains consistent.

- [ ] **Step 3: Update host section controls**

Rename section/function/imports from admins to hosts. Change checkbox name to `hostUserId`. Keep wrapping labels so checkbox hit targets remain accessible.

- [ ] **Step 4: Update list badges**

Show badges in this order:

```ts
Published | Draft
Hidden when event.hidden
Special when event.isSpecial
External when event.detailPageKind === 'external'
```

- [ ] **Step 5: Update stories and component tests**

Update `AdminEventShared.stories.tsx` so the checkbox stories include both published and hidden controls. Update `AdminEventShared.test.tsx` if snapshot or accessible-name assertions mention the old published-only control.

- [ ] **Step 6: Run focused UI tests**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/events/AdminEventShared.test.tsx src/components/mit-sailing/events/EventRegistrationForm.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run E2E admin event smoke**

Run: `npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts`

Expected: PASS.

## Task 7: E2E Public Hidden Behavior

**Files:**
- Modify: `tests/e2e/MitSailingCatalog.e2e.ts`
- Modify: `tests/e2e/EventRegistrationSwitches.e2e.ts` if registration coverage needs direct hidden-event URL setup

- [ ] **Step 1: Add hidden fixture setup**

Add a helper that updates one seeded published event:

```sql
UPDATE "events"
SET "hidden" = true,
    "is_published" = true
WHERE "slug" = $1
```

Restore the original value in `finally`.

- [ ] **Step 2: Assert hidden event is omitted from calendar**

Navigate to `/events?month=...` and assert the hidden event name is not visible.

- [ ] **Step 3: Assert hidden event direct URL works**

Navigate to `/events/[slug]` and assert the event heading is visible.

- [ ] **Step 4: Assert hidden event registration still works when published**

Open the registration window and assert the registration CTA remains available from the direct event URL.

- [ ] **Step 5: Run public E2E tests**

Run: `npm run test:e2e -- tests/e2e/MitSailingCatalog.e2e.ts tests/e2e/EventRegistrationSwitches.e2e.ts`

Expected: PASS.

## Task 8: Rule And Documentation Cleanup

**Files:**
- Modify: `.cursor/rules/prisma-catalog-visibility.mdc`
- Modify: `docs/superpowers/plans/2026-05-18-casl-prisma-authorization.md` only if it still says creator ownership

- [ ] **Step 1: Update visibility rule**

Revise `.cursor/rules/prisma-catalog-visibility.mdc` to state:

```md
- Event listing/discovery uses `hidden`: `hidden: false` means the event appears in public calendars/lists; `hidden: true` means direct-link only.
- Event draft/live lifecycle remains `isPublished`.
- Catalog entities that are not events keep existing `isVisible` unless a dedicated follow-up migration changes them.
```

- [ ] **Step 2: Remove stale creator-ownership wording**

Search:

```bash
rg -n "createdByUserId|created_by|creator|owner|ownership|event_admins|EventAdmin|adminUserId|isPublished|hidden" docs .cursor src prisma --glob '!src/generated/**'
```

Expected: Remaining `createdByUserId` references are newsletter/CMS provenance or migration history only; no event authorization docs claim creator ownership.

## Task 9: Final Verification

**Files:**
- All files touched above

- [ ] **Step 1: Run focused unit/component tests**

Run:

```bash
npm run test -- src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts src/libs/mit-sailing/eventRegistrationState.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run required checks**

Run:

```bash
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
```

Expected: PASS.

- [ ] **Step 3: Run required E2E gate**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add prisma src tests .cursor docs
git commit -m "feat: add event hosts and hidden event listings"
```

Expected: commit succeeds with only this feature's files staged.
