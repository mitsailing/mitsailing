# CASL Prisma Event Authorization Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the event and public registration authorization migration so CASL Prisma is the single query-authorization interface for event access and event registration ownership.

**Architecture:** Keep authorization policy in `src/libs/auth/permissions.ts`, expose reusable event access helpers from `src/libs/admin/events/eventAdminAuthorization.ts`, and make pages, query modules, and mutations consume CASL-derived Prisma `WhereInput` filters. Business constraints such as slug, event id, registration window, capacity, and validation stay separate and are composed with authorization filters via Prisma `AND`.

**Tech Stack:** TypeScript, Next.js App Router, Prisma 7 generated client, `@casl/ability`, `@casl/prisma`, Vitest.

---

## Concise Implementation Rules

- Keep the permission vocabulary small: `events.create` is enough to make the admin Events area visible and allow event creation; `events.manage` upgrades the user to global event management.
- Do not add separate `read`, `list`, or `view` event permissions in this pass.
- Prefer one small event authorization helper that returns `{ ability, eventAccessWhere, session }` over many narrow wrappers.
- Prefer passing `eventAccessWhere` into query functions instead of recomputing abilities in query modules.
- Prefer using `access.event.id` for already verified event mutations when that keeps code shorter. Use CASL Prisma at the boundary that loaded `access`; do not duplicate `accessibleBy` inside every child mutation if the mutation is already constrained to the verified event id.
- Keep business rules visibly separate from authorization rules: `AND: [eventAccessWhere, businessWhere]`.

## Current Context

Work in `/Users/andrewkelley/GitHub/mitsailing-registration-onboarding` on branch `feature/registration-onboarding-permissions`. This is a dirty worktree with broad uncommitted authorization/admin work; do not revert unrelated edits. Current product decisions:

- `createdByUserId` stays on `Event` as provenance/display metadata only. It must not grant edit access.
- `EventAdmin` is the scoped event-management membership table.
- `Volunteer Instructor` gets `events.create` by default. They can create events and manage only events where they are assigned in `EventAdmin`.
- Creating an event creates an `EventAdmin` row for the creator.
- `Dock Staff`, `Dock Master`, and `Admin` can create and manage all events.
- `events.create` means the admin Events area is visible, event creation is allowed, and scoped assigned-event management is available for Volunteer Instructors.
- `events.manage` means global event management.
- Admins, Dock Masters, and Dock Staff should see all events in admin event list pages. Volunteer Instructors should see only assigned events, but still reach `/admin/events` and `/admin/events/new`.

CASL Prisma rule to follow: derive model filters with `accessibleBy(ability, action).Model`, catch `ForbiddenError`, and compose app constraints with `AND`.

## File Structure

- Modify `src/libs/admin/events/eventAdminAuthorization.ts`: central event authorization helper API. Keep it small; it should own CASL event `WhereInput` generation and page/action access guards.
- Modify `src/libs/admin/events/eventAdminAuthorization.test.ts`: focused tests for global event access, Volunteer Instructor scoped event access, create/list access, and no-access behavior.
- Modify `src/app/[locale]/(marketing)/(site)/admin/events/new/page.tsx`: allow `events.create` or `events.manage`.
- Modify `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`: allow `events.create` or `events.manage`, then pass CASL event scope to list query.
- Modify `src/libs/admin/adminNavigation.ts`: show Events nav item for `events.create` or `events.manage`.
- Modify `src/app/[locale]/(marketing)/(site)/admin/page.tsx`: show Events dashboard link for `events.create` or `events.manage`.
- Modify `src/libs/admin/adminAreaAccess.test.ts` or add focused navigation tests if needed.
- Modify `src/libs/admin/events/eventAdminQueries.ts`: accept CASL event scope or verified access object for event list/detail/delete/registrations reads.
- Modify event detail pages:
  - `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/edit/page.tsx`
  - `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/delete/page.tsx`
  - `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/registrations/page.tsx`
- Modify `src/libs/admin/events/eventAdminActions.ts`: use CASL-derived event scope in event and child-row mutation `where` clauses.
- Modify `src/libs/admin/events/eventAdminActions.test.ts`: add assertions for create permission guard and CASL-scoped mutation filters.
- Modify `src/libs/mit-sailing/eventQueries.ts`: use CASL Prisma for public viewer registration ownership.
- Create `src/libs/mit-sailing/eventQueries.test.ts`: focused public registration state ownership test.
- Keep existing `src/libs/mit-sailing/eventRegistrationActions.ts` and `src/libs/mit-sailing/eventRegistrationActions.test.ts` aligned with any helper extraction if you deduplicate registration access helpers.

## Task 1: Centralize Event CASL Prisma Helper

**Files:**
- Modify: `src/libs/admin/events/eventAdminAuthorization.ts`
- Test: `src/libs/admin/events/eventAdminAuthorization.test.ts`

- [ ] **Step 1: Add failing helper tests**

Add tests to `src/libs/admin/events/eventAdminAuthorization.test.ts` inside the existing `describe('requireAdminEventAccess', ...)` file. Keep existing tests and add these assertions:

```ts
it('requires create or manage permission before loading scoped events', async () => {
  mocks.requireAnyPermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'staff-1', role: Role.VOLUNTEER_INSTRUCTOR },
  });
  mocks.listRolePermissionGrants.mockResolvedValue([
    {
      permissionKey: Permission.EVENTS_CREATE,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    },
  ]);
  mockEvent({
    admins: [{ adminUserId: 'staff-1' }],
    createdByUserId: 'creator-1',
  });
  const { requireAdminEventAccess } = await import(
    '@/libs/admin/events/eventAdminAuthorization'
  );

  await requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' });

  expect(mocks.requireAnyPermission).toHaveBeenCalledWith(
    [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
    'en'
  );
});

it('exposes a reusable event access where filter for list queries', async () => {
  mocks.requireAnyPermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'staff-1', role: Role.VOLUNTEER_INSTRUCTOR },
  });
  mocks.listRolePermissionGrants.mockResolvedValue([
    {
      permissionKey: Permission.EVENTS_CREATE,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    },
  ]);
  const { requireAdminEventListAccess } = await import(
    '@/libs/admin/events/eventAdminAuthorization'
  );

  const access = await requireAdminEventListAccess('en');

  expect(access.eventAccessWhere).toEqual({
    OR: [{ admins: { some: { adminUserId: 'staff-1' } } }],
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: FAIL because `requireAdminEventListAccess` does not exist.

- [ ] **Step 3: Implement the small event access helper**

In `src/libs/admin/events/eventAdminAuthorization.ts`, keep current exports and add:

```ts
export type AdminEventListAccess = {
  ability: AuthAbility;
  eventAccessWhere: Prisma.EventWhereInput;
  session: NonNullable<AuthSession>;
};

export function getEventAccessWhere(
  ability: AuthAbility
): Prisma.EventWhereInput | null {
  try {
    return accessibleBy(ability, AuthAction.UPDATE).Event;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return null;
    }
    throw error;
  }
}

export async function requireAdminEventListAccess(
  locale: string
): Promise<AdminEventListAccess> {
  const session = await requireAnyPermission(
    [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
    locale
  );
  const ability = await createEventAdminAbility(session);
  const eventAccessWhere = getEventAccessWhere(ability);
  if (!eventAccessWhere) {
    redirect(getI18nPath('/', locale));
  }
  return { ability, eventAccessWhere, session };
}
```

If `getEventAccessWhere` is already exported from interrupted work, preserve it and only add the missing type/helper. Do not add extra wrappers for create/list/read unless a test proves they remove duplication. Use `getI18nPath('/', locale)` for no event access because this is a broad admin access failure, not an event-not-found condition.

- [ ] **Step 4: Run focused tests green**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: PASS.

## Task 2: Use Event Create Permission for Events Area Visibility

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/new/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`
- Modify: `src/libs/admin/adminNavigation.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/page.tsx`
- Test: `src/libs/admin/adminAreaAccess.test.ts`

- [ ] **Step 1: Add failing navigation test**

In `src/libs/admin/adminAreaAccess.test.ts`, add this test:

```ts
it('shows event navigation to volunteer instructors with event creation access', async () => {
  mocks.verifySession.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'instructor-1', role: Role.VOLUNTEER_INSTRUCTOR },
  });
  mocks.listRolePermissionGrants.mockResolvedValue([
    {
      permissionKey: Permission.ADMIN_VIEW,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    },
    {
      permissionKey: Permission.EVENTS_CREATE,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    },
  ]);
  const { requireAdminAreaAccess } = await import(
    '@/libs/admin/adminAreaAccess'
  );

  const access = await requireAdminAreaAccess('en');

  expect(access.navItems.map((item) => item.href)).toContain('/admin/events');
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```bash
npm run test -- src/libs/admin/adminAreaAccess.test.ts
```

Expected: FAIL because the Events nav item requires only `EVENTS_MANAGE`.

- [ ] **Step 3: Update navigation permission concisely**

In `src/libs/admin/adminNavigation.ts`, make the Events nav item visible to anyone who can create or globally manage events. Change:

```ts
permissions: [Permission.EVENTS_MANAGE],
```

to:

```ts
permissions: [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
```

- [ ] **Step 4: Update admin dashboard event link with the same rule**

In `src/app/[locale]/(marketing)/(site)/admin/page.tsx`, change:

```ts
const canEvents = canUsePermission(ability, Permission.EVENTS_MANAGE);
```

to:

```ts
const canEvents = canUseAnyPermission(ability, [
  Permission.EVENTS_CREATE,
  Permission.EVENTS_MANAGE,
]);
```

- [ ] **Step 5: Update new event page guard**

In `src/app/[locale]/(marketing)/(site)/admin/events/new/page.tsx`, replace imports:

```ts
import { requirePermission } from '@/libs/auth/dal';
```

with:

```ts
import { requireAnyPermission } from '@/libs/auth/dal';
```

Then replace:

```ts
await requirePermission(Permission.EVENTS_MANAGE, locale);
```

with:

```ts
await requireAnyPermission(
  [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
  locale
);
```

- [ ] **Step 6: Update event list page guard and scoped query**

In `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`, remove `requirePermission` import and add:

```ts
import { requireAdminEventListAccess } from '@/libs/admin/events/eventAdminAuthorization';
```

Remove:

```ts
await requirePermission(Permission.EVENTS_MANAGE, locale);
```

Add:

```ts
const access = await requireAdminEventListAccess(locale);
```

Then pass the access filter into `listAdminEventRows`. This keeps `/admin/events` visible through `events.create`, while `eventAccessWhere` decides whether the user sees all events or only assigned events:

```ts
listAdminEventRows({
  categoryId: searchParams.category,
  eventAccessWhere: access.eventAccessWhere,
  query: searchParams.q,
}),
```

This will not typecheck until Task 3 updates the query signature.

- [ ] **Step 7: Run focused navigation test green**

Run:

```bash
npm run test -- src/libs/admin/adminAreaAccess.test.ts
```

Expected: PASS.

## Task 3: Scope Admin Event Read Queries with One CASL Prisma Filter

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/edit/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/delete/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/registrations/page.tsx`
- Test: create `src/libs/admin/events/eventAdminQueries.test.ts`

- [ ] **Step 1: Write failing query tests**

Create `src/libs/admin/events/eventAdminQueries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventRegistrationGroupBy: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
    },
    eventCategory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    eventRegistration: {
      groupBy: mocks.eventRegistrationGroupBy,
    },
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  questionOptionsFromJson: (value: unknown) =>
    Array.isArray(value)
      ? value.filter((option): option is string => typeof option === 'string')
      : [],
}));

beforeEach(() => {
  mocks.eventFindFirst.mockReset();
  mocks.eventFindMany.mockReset();
  mocks.eventRegistrationGroupBy.mockReset();
  mocks.userFindMany.mockReset();
  mocks.eventRegistrationGroupBy.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

describe('event admin queries', () => {
  const eventAccessWhere = {
    OR: [{ admins: { some: { adminUserId: 'instructor-1' } } }],
  };

  it('lists only events allowed by the CASL event access scope', async () => {
    mocks.eventFindMany.mockResolvedValue([]);
    const { listAdminEventRows } = await import(
      '@/libs/admin/events/eventAdminQueries'
    );

    await listAdminEventRows({
      eventAccessWhere,
      query: 'intro',
    });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            eventAccessWhere,
            {
              OR: [
                { name: { contains: 'intro', mode: 'insensitive' } },
                { shortName: { contains: 'intro', mode: 'insensitive' } },
                { slug: { contains: 'intro', mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
    );
  });

  it('loads editor data through the CASL event access scope', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { getAdminEventEditorDataBySlug } = await import(
      '@/libs/admin/events/eventAdminQueries'
    );

    await getAdminEventEditorDataBySlug({
      eventAccessWhere,
      slug: 'intro-sail',
    });

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ slug: 'intro-sail' }, eventAccessWhere] },
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminQueries.test.ts
```

Expected: FAIL because `listAdminEventRows` does not accept `eventAccessWhere`, `getAdminEventEditorDataBySlug` still accepts only a slug, and detail reads still call `findUnique`.

- [ ] **Step 3: Update list filters type and helper**

In `src/libs/admin/events/eventAdminQueries.ts`, update:

```ts
export type AdminEventListFilters = {
  query?: string;
  categoryId?: string;
};
```

to:

```ts
export type AdminEventListFilters = {
  eventAccessWhere: Prisma.EventWhereInput;
  query?: string;
  categoryId?: string;
};
```

Change `eventWhereFromFilters` to return an `AND` of authorization and business filters:

```ts
function eventWhereFromFilters(
  filters: AdminEventListFilters
): Prisma.EventWhereInput {
  const businessWhere: Prisma.EventWhereInput = {};
  const query = filters.query?.trim();
  const categoryId = filters.categoryId?.trim();
  if (categoryId) {
    businessWhere.eventCategoryId = categoryId;
  }
  if (query) {
    businessWhere.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { shortName: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
    ];
  }
  return {
    AND: [
      filters.eventAccessWhere,
      ...(Object.keys(businessWhere).length > 0 ? [businessWhere] : []),
    ],
  };
}
```

- [ ] **Step 4: Update detail query signatures**

Change signatures:

```ts
export async function getAdminEventEditorDataBySlug(
  slug: string
): Promise<AdminEventEditorData>
```

to:

```ts
export async function getAdminEventEditorDataBySlug(options: {
  eventAccessWhere: Prisma.EventWhereInput;
  slug: string;
}): Promise<AdminEventEditorData>
```

Inside it, change `prisma.event.findUnique({ where: { slug }, ... })` to:

```ts
prisma.event.findFirst({
  where: { AND: [{ slug: options.slug }, options.eventAccessWhere] },
  select: {
    // keep existing select unchanged
  },
})
```

Apply the same pattern:

```ts
export async function getAdminEventDeleteBySlug(options: {
  eventAccessWhere: Prisma.EventWhereInput;
  slug: string;
}): Promise<...>
```

and:

```ts
export async function getAdminEventRegistrationsBySlug(options: {
  eventAccessWhere: Prisma.EventWhereInput;
  slug: string;
}): Promise<AdminEventRegistrationsDto | null>
```

Each should use `findFirst` with `AND: [{ slug: options.slug }, options.eventAccessWhere]`.

- [ ] **Step 5: Update pages to pass access scope without recomputing policy**

In `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/edit/page.tsx`, change:

```ts
getAdminEventEditorDataBySlug(slug),
```

to:

```ts
getAdminEventEditorDataBySlug({
  eventAccessWhere: getEventAccessWhere(access.ability) ?? { id: access.event.id },
  slug,
}),
```

But do not inline this expression three times. Add this import:

```ts
import { getEventAccessWhere, requireAdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
```

Then after the access null check:

```ts
const eventAccessWhere = getEventAccessWhere(access.ability);
if (!eventAccessWhere) {
  notFound();
}
```

Use `eventAccessWhere` in the query call. This is intentionally a small amount of page glue; avoid creating three page-specific wrapper functions.

Repeat this pattern in:

- `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/delete/page.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/registrations/page.tsx`

- [ ] **Step 6: Run query tests and typecheck slice**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminQueries.test.ts
SKIP_ENV_VALIDATION=true npm run check:types
```

Expected: tests PASS and typecheck PASS for changed signatures.

## Task 4: Scope Admin Event Mutations to the CASL-Verified Event

**Files:**
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Test: `src/libs/admin/events/eventAdminActions.test.ts`

- [ ] **Step 1: Add failing mutation scope tests**

In `src/libs/admin/events/eventAdminActions.test.ts`, extend mocks so `requireAdminEventAccess` is not mocked indirectly if possible. If the current test mocks only `requireAnyPermission` and `prisma.event.create`, add focused tests for create guard first and mutation helper behavior. Add this test for update basics:

```ts
it('updates event basics through the CASL verified event id', async () => {
  const eventUpdate = vi.fn().mockResolvedValue({ id: 'event-1' });
  const requireAdminEventAccess = vi.fn().mockResolvedValue({
    ability: {},
    event: { id: 'event-1', slug: 'intro-sail' },
    session: { user: { id: 'staff-1' } },
  });
  vi.doMock('@/libs/admin/events/eventAdminAuthorization', () => ({
    requireAdminEventAccess,
  }));
  vi.doMock('@/libs/DB', () => ({
    prisma: {
      event: {
        create: mocks.eventCreate,
        update: eventUpdate,
      },
    },
  }));
  const { updateAdminEventBasicsAction } = await import(
    '@/libs/admin/events/eventAdminActions'
  );

  await expect(
    updateAdminEventBasicsAction('en', 'intro-sail', validEventFormData())
  ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

  expect(eventUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'event-1' },
    })
  );
});
```

If this exact mock shape conflicts with existing hoisted mocks, use the established file style instead. The important assertion is that event update/delete use the CASL-verified `access.event.id`, not slug-only `where`.

- [ ] **Step 2: Run test to verify red**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminActions.test.ts
```

Expected: FAIL because `updateAdminEventBasicsAction` still uses `where: { slug: currentSlug }`.

- [ ] **Step 3: Update event update/delete to verified id**

In `src/libs/admin/events/eventAdminActions.ts`, change `updateAdminEventBasicsAction`:

```ts
await requireEditableAdminEvent(locale, currentSlug);
```

to:

```ts
const access = await requireEditableAdminEvent(locale, currentSlug);
```

Change:

```ts
where: { slug: currentSlug },
```

to:

```ts
where: { id: access.event.id },
```

In `deleteAdminEventAction`, change:

```ts
await requireEditableAdminEvent(locale, slug);
await prisma.event.delete({ where: { slug } });
```

to:

```ts
const access = await requireEditableAdminEvent(locale, slug);
await prisma.event.delete({ where: { id: access.event.id } });
```

- [ ] **Step 4: Update child row mutation filters to verified event id**

For update/delete child mutations, replace slug relation filters with verified access event id. This is the concise enterprise pattern here: `requireAdminEventAccess` already loaded the event through CASL Prisma, so child writes only need to stay inside that verified event id.

```ts
where: { id: dateId, eventId: access.event.id }
```

Apply to:

- `updateAdminEventDateAction`
- `deleteAdminEventDateAction`
- `updateAdminEventQuestionAction`
- `deleteAdminEventQuestionAction`
- `updateAdminEventFeeAction`
- `deleteAdminEventFeeAction`
- `updateAdminEventRegistrationStatusAction` for the registration lookup and update:

```ts
where: { id: registrationId, eventId: access.event.id }
```

For actions that already call `verifiedEventIdFromAccess`, keep using `verifiedEventId`.

- [ ] **Step 5: Keep capacity/business counts separate**

Do not add CASL to capacity counts; they are business counts for the already verified event:

```ts
where: {
  eventId: registration.eventId,
  id: { not: registrationId },
  status: EventRegistrationStatus.approved,
}
```

This remains correct because `registration.eventId` came from a registration row constrained to `access.event.id`.

- [ ] **Step 6: Run action tests**

Run:

```bash
npm run test -- src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts
```

Expected: PASS.

## Task 5: Convert Public Registration State Query to CASL Prisma

**Files:**
- Modify: `src/libs/mit-sailing/eventQueries.ts`
- Create: `src/libs/mit-sailing/eventQueries.test.ts`

- [ ] **Step 1: Write failing public registration state test**

Create `src/libs/mit-sailing/eventQueries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventCategoryFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventCategory: {
      findMany: mocks.eventCategoryFindMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.eventFindFirst.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventCategoryFindMany.mockReset();
});

describe('getPublicEventRegistrationState', () => {
  it('uses CASL event registration ownership for viewer registration lookup', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue({
      id: 'registration-1',
      status: 'pending',
    });
    const { getPublicEventRegistrationState } = await import(
      '@/libs/mit-sailing/eventQueries'
    );

    await getPublicEventRegistrationState({
      eventId: 'event-1',
      userId: 'user-1',
    });

    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'user-1' }] }],
        },
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventQueries.test.ts
```

Expected: FAIL because `eventQueries.ts` still uses `where: { eventId, userId }`.

- [ ] **Step 3: Implement CASL Prisma registration filter**

In `src/libs/mit-sailing/eventQueries.ts`, add imports:

```ts
import { accessibleBy } from '@casl/prisma';
import {
  AuthAction,
  createAuthAbility,
} from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';
```

Then in `getCachedPublicEventRegistrationState`, before the query:

```ts
const registrationAccessWhere = accessibleBy(
  createAuthAbility({
    grants: [],
    role: Role.USER,
    userId,
  }),
  AuthAction.UPDATE
).EventRegistration;
```

Change the query to:

```ts
return await prisma.eventRegistration.findFirst({
  where: { AND: [{ eventId }, registrationAccessWhere] },
  orderBy: { createdAt: 'desc' },
  select: { id: true, status: true },
});
```

Use `Role.USER` because this public query receives only user id, not a full role-bearing `CurrentUser`. This is still correct for registration ownership because the `EventRegistration` rule is user-id based and independent of staff role.

- [ ] **Step 4: Run focused tests green**

Run:

```bash
npm run test -- src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: PASS.

## Task 6: Final Verification and Stale Pattern Search

**Files:**
- Modify only files required by failures.

- [ ] **Step 1: Search for stale direct ownership/event authorization filters**

Run:

```bash
rg -n "where: \\{ eventId, userId \\}|where: \\{ eventId: [^,}]+, userId|eventRegistration\\.findFirst\\(|eventRegistration\\.updateMany\\(|findUnique\\(\\{\\s*where: \\{ slug|requirePermission\\(Permission\\.EVENTS_MANAGE" src/libs src/app
```

Expected:

- No direct public ownership query remains as `{ eventId, userId }`.
- `eventRegistration.findFirst` and `eventRegistration.updateMany` occurrences are either business/admin cases constrained by verified event id or public cases constrained by CASL.
- No admin event page uses `requirePermission(Permission.EVENTS_MANAGE)` where `EVENTS_CREATE` should also allow access.
- `findUnique({ where: { slug } })` should not remain in admin event reads that are behind scoped event access.

- [ ] **Step 2: Run focused test suite**

Run:

```bash
npm run test -- src/libs/auth/permissions.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/adminAreaAccess.test.ts src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run required repository checks**

Run:

```bash
npm run lint
SKIP_ENV_VALIDATION=true npm run check:types
npm run check:i18n
npm run check:deps
```

Expected: all PASS. If `npm run check:i18n` fails because new translation keys were added in previous dirty work, fix only missing/extra translation keys related to this branch. If `check:deps` fails because of existing generated/dependency state, report exact output and do not hide it.

- [ ] **Step 4: Summarize remaining risk**

Before final response, report:

- Whether Volunteer Instructors can reach `/admin/events` and `/admin/events/new`.
- Whether Volunteer Instructor event list is scoped by `EventAdmin`.
- Whether Dock Staff/Dock Master/Admin event list is unscoped/global.
- Whether public registration state and public registration mutations use CASL Prisma for ownership.
- Exact commands run and pass/fail results.

## Self-Review Notes

- Spec coverage: The plan covers event create/list page access, navigation, admin event read scopes, admin event mutation scopes, public registration state ownership, and verification.
- Placeholder scan: No task says “handle edge cases” without exact code or command. Every code-changing task includes concrete snippets.
- Type consistency: `eventAccessWhere` is consistently `Prisma.EventWhereInput`; public registration access uses `EventRegistration` CASL model; page calls pass `eventAccessWhere` to query functions.
