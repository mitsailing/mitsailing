# Admin Past Events And Sign-In Return-To Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins intentionally view past events while keeping current event lists focused, require admin-created events to have at least one date, and preserve protected-page return-to through sign-in.

**Architecture:** Keep past/current on the existing `/admin/events` route with a `timing=current|past` filter and preserve the existing `scope=my|all` filter. Use US Eastern civil-day semantics: an event remains current through the entire local day of any occurrence, even after the occurrence end time has passed. Use Better Auth's documented `callbackURL`/`callbackUrl` flow for sign-in return-to; do not add Redis, a new auth redirect package, or database triggers.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/ZenStack, Better Auth, next-intl, Tailwind v4, Vitest, Playwright, Sentry.

---

## Resolved Decisions

- `/admin/events` defaults to `scope=my&timing=current`.
- `/admin/events?scope=all` shows all admin-visible current events.
- `/admin/events?timing=past` shows my past events.
- `/admin/events?scope=all&timing=past` shows all admin-visible past events.
- There is no time `all` option. Use only `Current` and `Past`.
- An event is current when at least one `EventDate.endDateTime` falls on today or a future day in `America/New_York`.
- An event is past only when every event date is before today in `America/New_York`.
- Current events sort ascending by the earliest relevant occurrence whose Eastern date is today or later.
- Past events sort descending by the latest occurrence.
- Events are required to have at least one date at the admin boundary.
- Do not enforce the one-date invariant with a PostgreSQL trigger or database constraint because imports may stage parent and child rows separately.
- Legacy/import workflows should run a post-import SQL invariant check for events with no `event_dates`.
- If admin views encounter a zero-date event, capture the invariant failure in Sentry and throw so the standard Next error page renders.
- Sign-in return-to is sitewide for protected routes. Signup return-to persistence is intentionally out of scope for this plan.
- Preserve path and query in return-to callbacks. Do not attempt to preserve URL hash fragments because the server never receives them.

## File Map

- Modify `src/proxy.ts`: protect all signed-in routes that need return-to, including `/admin`, `/profile`, `/account`, and `/events/:slug/register`.
- Modify `src/proxy.test.ts`: cover `/admin/events?scope=all&timing=past` and `/events/:slug/register` redirects with exact `callbackUrl`.
- Modify `src/libs/auth/dal.ts`: keep Better Auth callback usage and avoid hard-coded home callbacks where a caller already has a real destination.
- Modify `src/libs/admin/adminAreaAccess.ts` only if route-level proxy coverage is not enough for direct server redirects in tests.
- Create `src/libs/admin/events/eventAdminTiming.ts`: parse timing values, compute Eastern current-day cutoff, classify rows, sort rows, and report zero-date invariants.
- Create `src/libs/admin/events/eventAdminTiming.test.ts`: focused tests for current/past classification, multi-date sorting, and zero-date invariant.
- Modify `src/libs/admin/events/eventAdminQueries.ts`: add `timing` to list filters, query by timing, sort by timing, and report invalid zero-date rows.
- Modify `src/libs/admin/events/eventAdminQueries.test.ts`: cover timing filters and sort order.
- Modify `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`: accept `timing` search param and pass it through.
- Modify `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`: add the `Timing` select with `Current` and `Past`.
- Modify `src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx`: cover rendered timing filter and canonical current/past links/values.
- Modify `src/components/mit-sailing/admin/events/AdminEventCreateFormView.tsx`: require first date start/end fields on create.
- Modify `src/libs/admin/events/eventAdminSchemas.ts`: expose create-form parsing that includes the required first date.
- Modify `src/libs/admin/events/eventAdminSchemas.test.ts`: cover required create date and invalid end-before-start.
- Modify `src/libs/admin/events/eventAdminActions.ts`: create event and first date in one transaction; block deleting the final date.
- Modify `src/libs/admin/events/eventAdminActions.test.ts`: cover transactional create date and final-date delete rejection.
- Modify `src/locales/en.json`: add timing filter and date-required error strings.
- Modify `tests/e2e/AdminEvents.e2e.ts`: cover current/past filters and sign-in return-to from an admin event URL.

## Task 1: Protected Route Sign-In Return-To

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/proxy.test.ts`

- [ ] **Step 1: Add failing proxy tests for protected callbacks**

Add tests to `src/proxy.test.ts` inside `describe('authentication / account routes', ...)`:

```ts
it('redirects unauthenticated admin routes with the original path and query', async () => {
  vi.stubEnv('ARCJET_KEY', '');
  getSession.mockResolvedValue(null);
  const { default: proxy } = await import('@/proxy');
  const target = new URL(
    'http://localhost:3008/admin/events?scope=all&timing=past'
  );
  const request = new NextRequest(target);
  const response = await proxy(request);

  expect(response.status).toBe(307);
  const location = response.headers.get('location');
  if (!location) {
    throw new Error('Expected redirect location');
  }
  const redirectUrl = new URL(location, request.url);
  expect(redirectUrl.pathname).toBe('/login');
  expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
    '/admin/events?scope=all&timing=past'
  );
  expect(intlFn).not.toHaveBeenCalled();
});

it('redirects unauthenticated event registration routes with the original path', async () => {
  vi.stubEnv('ARCJET_KEY', '');
  getSession.mockResolvedValue(null);
  const { default: proxy } = await import('@/proxy');
  const target = new URL(
    'http://localhost:3008/events/bluewater-boston-provincetown/register'
  );
  const request = new NextRequest(target);
  const response = await proxy(request);

  expect(response.status).toBe(307);
  const location = response.headers.get('location');
  if (!location) {
    throw new Error('Expected redirect location');
  }
  const redirectUrl = new URL(location, request.url);
  expect(redirectUrl.pathname).toBe('/login');
  expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
    '/events/bluewater-boston-provincetown/register'
  );
  expect(intlFn).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run proxy tests to verify failure**

Run: `npm run test -- src/proxy.test.ts`

Expected: FAIL because `/admin` and `/events/:slug/register` are not protected in `proxy.ts`.

- [ ] **Step 3: Expand protected route matching**

In `src/proxy.ts`, replace the protected route pattern with a named helper:

```ts
function isProtectedPagePath(pathname: string): boolean {
  const protectedPattern =
    /^(?:\/[\w-]+)?\/(?:(?:account|profile|admin)(?:\/|$)|events\/[^/]+\/register(?:\/|$))/;
  return protectedPattern.test(pathname);
}
```

Then change:

```ts
const protectedPattern = /^(?:\/[\w-]+)?\/(?:account|profile)(?:\/|$)/;
if (protectedPattern.test(pathname)) {
```

to:

```ts
if (isProtectedPagePath(pathname)) {
```

Keep the existing callback construction:

```ts
const callbackPath = `${pathname}${request.nextUrl.search}`;
signIn.searchParams.set('callbackUrl', safeAuthCallbackUrl(callbackPath));
```

- [ ] **Step 4: Verify proxy return-to behavior**

Run: `npm run test -- src/proxy.test.ts`

Expected: PASS.

## Task 2: Event Timing Helpers

**Files:**
- Create: `src/libs/admin/events/eventAdminTiming.ts`
- Create: `src/libs/admin/events/eventAdminTiming.test.ts`

- [ ] **Step 1: Add timing helper tests**

Create `src/libs/admin/events/eventAdminTiming.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  adminEventTimingFromValue,
  assertAdminEventHasDates,
  sortAdminEventRowsByTiming,
  timingWhereForToday,
} from '@/libs/admin/events/eventAdminTiming';

vi.mock('server-only', () => ({}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

describe('eventAdminTiming', () => {
  it('defaults timing to current', () => {
    expect(adminEventTimingFromValue(undefined)).toBe('current');
    expect(adminEventTimingFromValue('future')).toBe('current');
    expect(adminEventTimingFromValue('past')).toBe('past');
  });

  it('builds current and past filters from Eastern midnight', () => {
    const todayStart = new Date('2026-05-19T04:00:00.000Z');

    expect(timingWhereForToday({ timing: 'current', todayStart })).toEqual({
      dates: { some: { endDateTime: { gte: todayStart } } },
    });
    expect(timingWhereForToday({ timing: 'past', todayStart })).toEqual({
      dates: {
        every: { endDateTime: { lt: todayStart } },
        some: {},
      },
    });
  });

  it('sorts current events by earliest occurrence today or later', () => {
    const todayStart = new Date('2026-05-19T04:00:00.000Z');
    const rows = [
      {
        id: 'later',
        dates: [
          {
            id: 'later-date',
            startDateTime: new Date('2026-05-21T14:00:00.000Z'),
            endDateTime: new Date('2026-05-21T16:00:00.000Z'),
          },
        ],
      },
      {
        id: 'today',
        dates: [
          {
            id: 'today-date',
            startDateTime: new Date('2026-05-19T13:00:00.000Z'),
            endDateTime: new Date('2026-05-19T15:00:00.000Z'),
          },
          {
            id: 'future-date',
            startDateTime: new Date('2026-05-23T13:00:00.000Z'),
            endDateTime: new Date('2026-05-23T15:00:00.000Z'),
          },
        ],
      },
    ];

    expect(
      sortAdminEventRowsByTiming({ rows, timing: 'current', todayStart }).map(
        (row) => row.id
      )
    ).toEqual(['today', 'later']);
  });

  it('sorts past events by latest occurrence descending', () => {
    const todayStart = new Date('2026-05-19T04:00:00.000Z');
    const rows = [
      {
        id: 'older',
        dates: [
          {
            id: 'older-date',
            startDateTime: new Date('2026-04-01T13:00:00.000Z'),
            endDateTime: new Date('2026-04-01T15:00:00.000Z'),
          },
        ],
      },
      {
        id: 'recent',
        dates: [
          {
            id: 'recent-date',
            startDateTime: new Date('2026-05-18T13:00:00.000Z'),
            endDateTime: new Date('2026-05-18T15:00:00.000Z'),
          },
        ],
      },
    ];

    expect(
      sortAdminEventRowsByTiming({ rows, timing: 'past', todayStart }).map(
        (row) => row.id
      )
    ).toEqual(['recent', 'older']);
  });

  it('reports and throws for zero-date events', async () => {
    const Sentry = await import('@sentry/nextjs');

    expect(() =>
      assertAdminEventHasDates({ id: 'event-1', name: 'Broken event', dates: [] })
    ).toThrow('Admin event has no dates: event-1');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Admin event has no dates',
      expect.objectContaining({
        level: 'error',
      })
    );
  });
});
```

- [ ] **Step 2: Run timing helper tests to verify failure**

Run: `npm run test -- src/libs/admin/events/eventAdminTiming.test.ts`

Expected: FAIL because `eventAdminTiming.ts` does not exist.

- [ ] **Step 3: Implement timing helpers**

Create `src/libs/admin/events/eventAdminTiming.ts`:

```ts
import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { Prisma } from '@/generated/prisma/client';
import {
  nyYmd,
  startOfNyCalendarDay,
} from '@/lib/mit-sailing/nyTime';

export type AdminEventTiming = 'current' | 'past';

export type AdminEventTimingDate = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
};

export type AdminEventTimingRow = {
  id: string;
  name?: string;
  dates: AdminEventTimingDate[];
};

export function adminEventTimingFromValue(
  value: string | undefined
): AdminEventTiming {
  return value === 'past' ? 'past' : 'current';
}

export function todayStartInEventsTimeZone(now: Date = new Date()): Date {
  return startOfNyCalendarDay(nyYmd(now));
}

export function timingWhereForToday(options: {
  timing: AdminEventTiming;
  todayStart: Date;
}): Prisma.EventWhereInput {
  if (options.timing === 'past') {
    return {
      dates: {
        every: { endDateTime: { lt: options.todayStart } },
        some: {},
      },
    };
  }
  return {
    dates: { some: { endDateTime: { gte: options.todayStart } } },
  };
}

export function assertAdminEventHasDates(row: AdminEventTimingRow): void {
  if (row.dates.length > 0) {
    return;
  }
  Sentry.captureMessage('Admin event has no dates', {
    level: 'error',
    tags: { area: 'admin-events' },
    extra: { eventId: row.id, eventName: row.name },
  });
  throw new Error(`Admin event has no dates: ${row.id}`);
}

function currentSortTime(row: AdminEventTimingRow, todayStart: Date): number {
  assertAdminEventHasDates(row);
  const relevantDates = row.dates.filter(
    (date) => date.endDateTime.getTime() >= todayStart.getTime()
  );
  const first = relevantDates.toSorted(
    (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
  )[0];
  return first?.startDateTime.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function pastSortTime(row: AdminEventTimingRow): number {
  assertAdminEventHasDates(row);
  const latest = row.dates.toSorted(
    (a, b) => b.startDateTime.getTime() - a.startDateTime.getTime()
  )[0];
  return latest?.startDateTime.getTime() ?? Number.MIN_SAFE_INTEGER;
}

export function sortAdminEventRowsByTiming<
  Row extends AdminEventTimingRow,
>(options: {
  rows: readonly Row[];
  timing: AdminEventTiming;
  todayStart: Date;
}): Row[] {
  if (options.timing === 'past') {
    return [...options.rows].sort(
      (a, b) => pastSortTime(b) - pastSortTime(a)
    );
  }
  return [...options.rows].sort(
    (a, b) =>
      currentSortTime(a, options.todayStart) -
      currentSortTime(b, options.todayStart)
  );
}
```

- [ ] **Step 4: Verify timing helpers**

Run: `npm run test -- src/libs/admin/events/eventAdminTiming.test.ts`

Expected: PASS.

## Task 3: Admin Event Query Timing

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.test.ts`

- [ ] **Step 1: Add failing query tests for timing filters**

Add tests in `src/libs/admin/events/eventAdminQueries.test.ts`:

```ts
it('filters current event lists from Eastern midnight', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T18:00:00.000Z'));
  mocks.eventFindMany.mockResolvedValue([]);
  const { listAdminEventRows } =
    await import('@/libs/admin/events/eventAdminQueries');

  await listAdminEventRows({
    authContext: { appRole: Role.DOCK_STAFF, id: 'staff-1' },
    scope: 'all',
    timing: 'current',
  });

  expect(mocks.eventFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        dates: {
          some: { endDateTime: { gte: new Date('2026-05-19T04:00:00.000Z') } },
        },
      },
    })
  );
  vi.useRealTimers();
});

it('filters past event lists from Eastern midnight', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T18:00:00.000Z'));
  mocks.eventFindMany.mockResolvedValue([]);
  const { listAdminEventRows } =
    await import('@/libs/admin/events/eventAdminQueries');

  await listAdminEventRows({
    authContext: { appRole: Role.DOCK_STAFF, id: 'staff-1' },
    scope: 'all',
    timing: 'past',
  });

  expect(mocks.eventFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        dates: {
          every: { endDateTime: { lt: new Date('2026-05-19T04:00:00.000Z') } },
          some: {},
        },
      },
    })
  );
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run query tests to verify failure**

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts`

Expected: FAIL because `timing` is not accepted or applied.

- [ ] **Step 3: Add timing to list filters and sorting**

In `src/libs/admin/events/eventAdminQueries.ts`, import the helper functions:

```ts
import {
  adminEventTimingFromValue,
  sortAdminEventRowsByTiming,
  timingWhereForToday,
  todayStartInEventsTimeZone,
} from '@/libs/admin/events/eventAdminTiming';
import type { AdminEventTiming } from '@/libs/admin/events/eventAdminTiming';
```

Change `AdminEventListFilters`:

```ts
export type AdminEventListFilters = {
  authContext: AppAuthContext;
  query?: string;
  categoryId?: string;
  scope?: string;
  timing?: string;
};
```

Add `export type AdminEventListTiming = AdminEventTiming;` near `AdminEventListScope` if tests or UI need a named local type.

In `eventWhereFromFilters`, merge the timing where:

```ts
const timing = adminEventTimingFromValue(filters.timing);
const todayStart = todayStartInEventsTimeZone();
const businessWhere: Prisma.EventWhereInput = timingWhereForToday({
  timing,
  todayStart,
});
```

Keep the existing category, query, and scope additions on `businessWhere`.

In `listAdminEventRows`, replace the final map with sorted rows:

```ts
const timing = adminEventTimingFromValue(filters.timing);
const todayStart = todayStartInEventsTimeZone();
const rowsWithCounts = authorizedRows.map((row) => ({
  ...row,
  registrationCounts:
    countsByEventId.get(row.id) ?? emptyRegistrationCounts(),
}));
return sortAdminEventRowsByTiming({
  rows: rowsWithCounts,
  timing,
  todayStart,
});
```

- [ ] **Step 4: Verify query behavior**

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminTiming.test.ts`

Expected: PASS.

## Task 4: Admin Events Timing UI

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing UI test for timing select**

Add to `src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx`:

```ts
it('renders the timing filter with current and past options', () => {
  render(
    <AdminEventsListView
      categories={[]}
      filterAction="/admin/events"
      filters={{ timing: 'past' }}
      rows={[]}
      t={t}
    />
  );

  const timing = screen.getByLabelText('Timing');
  expect(timing).toHaveValue('past');
  expect(screen.getByRole('option', { name: 'Current' })).toHaveValue(
    'current'
  );
  expect(screen.getByRole('option', { name: 'Past' })).toHaveValue('past');
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `npm run test -- src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx`

Expected: FAIL because the timing select and translation keys do not exist.

- [ ] **Step 3: Wire timing through page and view**

In `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`, change search params:

```ts
searchParams: Promise<{
  q?: string;
  category?: string;
  scope?: string;
  timing?: string;
}>;
```

Pass `timing` to `listAdminEventRows` and `filters`:

```ts
timing: searchParams.timing,
```

In `AdminEventsListViewProps`, add:

```ts
timing?: string;
```

inside `filters`.

In `AdminEventsListView`, add a native select beside scope:

```tsx
<label className="flex min-w-0 flex-col gap-1.5 text-sm">
  <span className="font-medium text-foreground">
    {props.t('filter_timing_label')}
  </span>
  <select
    className={adminNativeSelectClassName}
    defaultValue={props.filters.timing === 'past' ? 'past' : 'current'}
    name="timing"
  >
    <option value="current">{props.t('filter_timing_current')}</option>
    <option value="past">{props.t('filter_timing_past')}</option>
  </select>
</label>
```

Adjust the form grid to fit four filters plus actions:

```tsx
className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(150px,200px)_minmax(150px,200px)_minmax(220px,280px)_auto]"
```

In `src/locales/en.json`, add to `AdminEvents`:

```json
"filter_timing_current": "Current",
"filter_timing_label": "Timing",
"filter_timing_past": "Past",
```

- [ ] **Step 4: Verify UI and i18n**

Run: `npm run test -- src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx`

Run: `npm run check:i18n`

Expected: PASS.

## Task 5: Require First Date On Event Create

**Files:**
- Modify: `src/libs/admin/events/eventAdminSchemas.ts`
- Modify: `src/libs/admin/events/eventAdminSchemas.test.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventCreateFormView.tsx`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminActions.test.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing schema and action tests**

In `src/libs/admin/events/eventAdminSchemas.test.ts`, add:

```ts
it('parses create event basics with a required first date', () => {
  const formData = new FormData();
  formData.set('name', 'Intro Sail');
  formData.set('shortName', 'Intro');
  formData.set('slug', 'intro-sail');
  formData.set('eventCategoryId', 'category-1');
  formData.set('description', 'Learn to sail.');
  formData.set('detailPageKind', 'standard');
  formData.set('startDateTime', '2026-06-01T09:00');
  formData.set('endDateTime', '2026-06-01T12:00');

  const parsed = eventAdminCreateFormSchema.parse(
    rawEventCreateFromFormData(formData)
  );

  expect(parsed.name).toBe('Intro Sail');
  expect(parsed.firstDate.startDateTime).toEqual(
    new Date('2026-06-01T13:00:00.000Z')
  );
});
```

In `src/libs/admin/events/eventAdminActions.test.ts`, update the create test so `validEventFormData()` already includes `startDateTime` and `endDateTime`, then assert transaction creates both rows:

```ts
expect(mocks.eventCreate).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      dates: {
        create: {
          id: expect.any(String),
          startDateTime: new Date('2026-06-01T13:00:00.000Z'),
          endDateTime: new Date('2026-06-01T16:00:00.000Z'),
        },
      },
    }),
  })
);
```

- [ ] **Step 2: Run schema/action tests to verify failure**

Run: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts`

Expected: FAIL because create parsing does not include first date.

- [ ] **Step 3: Implement create schema**

In `src/libs/admin/events/eventAdminSchemas.ts`, export:

```ts
export const eventAdminCreateFormSchema = eventAdminBasicsFormSchema
  .and(z.object({ firstDate: eventDateFormSchema }))
  .transform((value) => value);

export function rawEventCreateFromFormData(formData: FormData) {
  return {
    ...rawEventBasicsFromFormData(formData),
    firstDate: rawEventDateFromFormData(formData),
  };
}
```

- [ ] **Step 4: Add first date fields to create form**

In `AdminEventCreateFormView.tsx`, add required `datetime-local` controls named `startDateTime` and `endDateTime` using the existing admin date labels:

```tsx
<div className="grid gap-4 md:grid-cols-2">
  <label className="flex flex-col gap-1.5 text-sm">
    <span className="font-medium text-foreground">
      {props.t('field_date_start')}
    </span>
    <Input name="startDateTime" required type="datetime-local" />
    <span className="text-xs text-mit-readable-ink">
      {props.t('field_datetime_et_hint')}
    </span>
  </label>
  <label className="flex flex-col gap-1.5 text-sm">
    <span className="font-medium text-foreground">
      {props.t('field_date_end')}
    </span>
    <Input name="endDateTime" required type="datetime-local" />
    <span className="text-xs text-mit-readable-ink">
      {props.t('field_datetime_et_hint')}
    </span>
  </label>
</div>
```

- [ ] **Step 5: Create event with first date**

In `eventAdminActions.ts`, replace the create parsing imports with `eventAdminCreateFormSchema` and `rawEventCreateFromFormData`. In `createAdminEventAction`, parse the create payload and nest the first date:

```ts
const parsed = eventAdminCreateFormSchema.safeParse(
  rawEventCreateFromFormData(formData),
  zodParse
);
```

In the `prisma.event.create` data, add:

```ts
dates: {
  create: {
    id: randomUUID(),
    startDateTime: data.firstDate.startDateTime,
    endDateTime: data.firstDate.endDateTime,
  },
},
```

- [ ] **Step 6: Verify event create date requirement**

Run: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts`

Expected: PASS.

## Task 6: Prevent Last Date Delete

**Files:**
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminActions.test.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add failing final-date delete test**

In `src/libs/admin/events/eventAdminActions.test.ts`, add:

```ts
it('rejects deleting the final event date', async () => {
  mocks.requireAdminEventAccess.mockResolvedValue({
    event: { id: 'event-1', slug: 'intro-sail' },
  });
  mocks.eventDateCount.mockResolvedValue(1);
  const formData = new FormData();
  formData.set('_action', 'delete');

  const { updateAdminEventDateAction } =
    await import('@/libs/admin/events/eventAdminActions');

  await expect(
    updateAdminEventDateAction('en', 'intro-sail', 'event-1', 'date-1', formData)
  ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit?error=last_date');
});
```

Add `eventDateCount` to the Prisma mock:

```ts
eventDate: {
  count: mocks.eventDateCount,
  create: mocks.eventDateCreate,
  delete: mocks.eventDateDelete,
  update: mocks.eventDateUpdate,
},
```

- [ ] **Step 2: Run action test to verify failure**

Run: `npm run test -- src/libs/admin/events/eventAdminActions.test.ts`

Expected: FAIL because deleting the final date is allowed.

- [ ] **Step 3: Block final-date delete**

In `EventAdminMutationCode`, add:

```ts
| 'last_date'
```

In `updateAdminEventDateAction`, before deleting:

```ts
const dateCount = await prisma.eventDate.count({
  where: { eventId: verifiedEventId },
});
if (dateCount <= 1) {
  redirect(editUrlWithError(locale, slug, 'last_date'));
}
```

In `src/locales/en.json`, add:

```json
"form_error_last_date": "Every event needs at least one date."
```

Ensure any admin error mapping for event mutation codes maps `last_date` to `form_error_last_date`.

- [ ] **Step 4: Verify final-date delete protection**

Run: `npm run test -- src/libs/admin/events/eventAdminActions.test.ts`

Expected: PASS.

## Task 7: E2E Coverage

**Files:**
- Modify: `tests/e2e/AdminEvents.e2e.ts`

- [ ] **Step 1: Add event list timing e2e coverage**

Add a test:

```ts
test('filters current and past event lists', async ({ page }) => {
  await signInAsAdmin(page);

  await page.goto('/admin/events?scope=all');
  await expect(page.getByLabel('Timing')).toHaveValue('current');
  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();

  await page.getByLabel('Timing').selectOption('past');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page).toHaveURL(/\/admin\/events\?(.+&)?timing=past/);
  await expect(page.getByLabel('Timing')).toHaveValue('past');
});
```

- [ ] **Step 2: Add sign-in return-to e2e coverage**

Add a test:

```ts
test('returns to protected admin event page after sign in', async ({ page }) => {
  await page.goto('/admin/events?scope=all&timing=past');

  await expect(page).toHaveURL(
    /\/login\?callbackUrl=%2Fadmin%2Fevents%3Fscope%3Dall%26timing%3Dpast/
  );

  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL ?? 'admin@example.com');
  await page
    .getByLabel('Password')
    .fill(process.env.ADMIN_PASSWORD ?? 'dev-local-change-me');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/admin/events?scope=all&timing=past');
});
```

- [ ] **Step 3: Run focused e2e test**

Run: `npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts`

Expected: PASS.

## Task 8: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npm run test -- src/proxy.test.ts src/libs/admin/events/eventAdminTiming.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run required static gates**

Run:

```bash
npm run lint
npm run check:types
npm run check:i18n
```

Expected: PASS.

- [ ] **Step 3: Run focused e2e**

Run:

```bash
npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts src/libs/admin/events/eventAdminTiming.ts src/libs/admin/events/eventAdminTiming.test.ts src/libs/admin/events/eventAdminQueries.ts src/libs/admin/events/eventAdminQueries.test.ts src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/events/page.tsx src/components/mit-sailing/admin/events/AdminEventsListView.tsx src/components/mit-sailing/admin/events/AdminEventsListView.test.tsx src/components/mit-sailing/admin/events/AdminEventCreateFormView.tsx src/libs/admin/events/eventAdminSchemas.ts src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.ts src/libs/admin/events/eventAdminActions.test.ts src/locales/en.json tests/e2e/AdminEvents.e2e.ts
git commit -m "fix: show past admin events and preserve sign-in return paths"
```

## Self-Review

- Spec coverage: current/past filtering, midnight Eastern behavior, multi-date sorting, date-required admin invariant, no database trigger, post-import SQL note, Sentry/error behavior for zero-date data, Better Auth sign-in return-to, and signup out-of-scope are all represented.
- Placeholder scan: the plan contains concrete file paths, code snippets, commands, and expected outcomes.
- Type consistency: `AdminEventTiming`, `timing`, `eventAdminCreateFormSchema`, `rawEventCreateFromFormData`, and `sortAdminEventRowsByTiming` are introduced before use and used consistently.
