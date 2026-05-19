# Event Admin Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix event admin access, event-admin assignment limits, public event contacts, canonical admin event show-page review, old-site event feature parity, and registration review usability in a focused post-integration PR.

**Architecture:** Add `/admin/events/[slug]` as the canonical admin event show page. Keep `/admin/events/[slug]/edit` for mutation-heavy editing and make `/admin/events/[slug]/registrations` redirect to the canonical show page or stop being canonical. Event managers keep full mutation access; assigned event admins keep editable access for their events; unassigned volunteer instructors can reach event admin pages in read-only mode. Registration review lives on the canonical show page and moves from cards to a compact table/action-menu flow without widening mobile layouts.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/ZenStack, Better Auth, next-intl, Tailwind v4, shadcn-style shared UI, Vitest, Playwright.

---

## Execution Constraints

- Run implementation workers sequentially only.
- Do not dispatch tasks in parallel.
- The conductor/main agent must review each worker diff and verification before starting the next task.
- Follow `AGENTS.md`; use TypeScript, named exports, absolute `@/` imports, next-intl strings, Tailwind v4 utilities, and the existing React single-`props` style.
- Use only these scripts: `npm run build-local`, `npm run lint`, `npm run check:types`, `npm run check:deps`, `npm run check:i18n`, `npm run test`, `npm run test:coverage`, `npm run test:e2e`.
- Save local review artifacts outside the repo under `~/.codex/tmp/mitsailing-event-admin-access/`.
- Workers may convert touched event-admin data access to ZenStack as they go when it is local to the task, reduces authorization drift, and does not widen scope. Do not start broad Prisma-to-ZenStack rewrites outside the files needed for the active task.
- If workers find issues outside this plan's scope, leave a concise `TODO:` comment only when it is attached to the relevant code and would prevent future confusion. Do not fix out-of-scope issues in this PR unless they block the active task.
- Treat loss of old event-page functionality as a blocker unless this plan explicitly marks the feature as intentionally dropped or deferred.
- Intentionally dropped: old `Ask gender?`, old `Print Entries`, old `Attendance`, and the current new-site `internalNotes` event feature.
- Intentionally deferred: old duplicate-event flow. Do not implement it in this PR.

## Resolved Show Page Decisions

- Canonical admin event route is `/admin/events/[slug]`.
- `/admin/events/[slug]/edit` remains for mutation-heavy editing.
- `/admin/events/[slug]/registrations` redirects to `/admin/events/[slug]#registrations` or otherwise stops being canonical.
- First viewport hierarchy: event name/status badges, next or primary date, signed-up/confirmed/awaiting/remaining counts, capacity/window, assigned admins, then top-right actions.
- Top-right show-page actions: `Edit`, `View` public page or external page, and `Delete` for editable users.
- Registration review is always visible on the show page below summary/content, with a top anchor rather than tabs.
- Read-only users see a concise, skimmable operational summary with shortest practical Eastern datetime formatting; they do not see mutation controls.
- Admin show page includes public content sections (`FAQ`, `Notice of Race`, `Sailing Instructions`, `Results`) below the compact summary and above registrations when content is visible.
- Editable users can confirm/cancel/reopen registrations directly from the show-page registration review.
- Remove the current `internalNotes` field from event admin feature scope.

## Legacy Event Parity Decisions

- Old site reference path: `/Users/andrewkelley/GitHub/sailing-wp/old`.
- Old editor references: `public_html/event_mod.php`, `public_html/event_new.php`, and `includes/events.php`.
- The event index table must include operational columns needed to manage events: registered/signed-up count, confirmed count, awaiting confirmation count when applicable, event limit/capacity, and assigned admins.
- Edit page should read as a dense form editor, not a show page.
- Optional edit-page boxes default closed for new events and reveal fields only when selected.
- `FAQ`, `Notice of Race`, `Sailing Instructions`, and `Results` are public rich text sections. Old-site import makes edit-only booleans a bad fit here: legacy rows store both `*_page` visibility flags and rich text content, so the new model must preserve visibility separately from content or explicitly discard hidden legacy drafts during import with approval. Public/admin show pages render these sections only when visible and non-empty.
- Keep legacy import easy: every old event field that is ported must have an explicit new schema/action/query mapping, and every old event field that is dropped must be documented as intentionally dropped.
- Registration supports `None`, `Standard`, and `Custom external`.
- `Custom external` stores both old fields: `Registration URL` and `Entries URL`.
- Registration summary wording uses old-site terms: `Signed up`, `Confirmed`, `Awaiting confirmation`, and `Remaining`.
- Old `Manual Confirm` maps to current approval behavior: manual confirmation allows over-limit signups, but only confirmed entries count against the event limit.
- `Ask phone?` is ported; it shows a required per-event phone field for every registrant and pre-fills from account phone when available.
- `Ask gender?` is not ported and must be removed from the new edit-page parity list.
- `Ask question?` uses the current custom registration questions system, hidden behind an edit-page checkbox.
- `Teams?` ports the full old behavior: team name, boats per team, persons per boat, repeat captain option, helm/crew names and emails, and team/boat display in admin registration review.
- `Entry fees?` reveals the existing fees editor. A single fee is implicit at registration; multiple fees require the registrant to select a registration type.
- Deposit uses the existing fee row `isDeposit` flag rather than a separate event-level amount.
- Old `Print Entries` and `Attendance` links are intentionally not ported.

## File Map

- Modify `src/libs/auth-client.ts` to use `customSessionClient<typeof auth>()`.
- Modify `src/libs/auth.ts`, `src/libs/auth.test.ts`, `src/libs/admin/users/appRoleActions.ts`, and related tests so Better Auth `user.role` mirrors only `admin` for `appRole=admin`; all other app roles mirror to `user`.
- Add a Prisma migration under `prisma/migrations/` if existing `user.role` data needs cleanup from `appRole`.
- Modify `src/libs/auth/appPermissions.ts` and tests to add `EVENTS_ASSIGNED_MANAGE`.
- Modify `src/libs/admin/adminAreaAccess.ts`, `src/components/mit-sailing/admin/AdminSideNav.tsx`, and tests if needed so Events appears for either event permission.
- Modify `src/libs/admin/events/zenstackEventAccess.ts`, `eventAdminAuthorization.ts`, `eventAdminQueries.ts`, and tests for editable/read-only event access.
- Modify `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`, `[slug]/page.tsx`, `[slug]/edit/page.tsx`, `[slug]/registrations/page.tsx`, and `[slug]/delete/page.tsx` to pass scope/access mode and establish the canonical show page.
- Modify `src/components/mit-sailing/admin/events/AdminEventsListView.tsx` to add the `My events` / `All events` switcher, operational table columns, and mobile-safe row actions.
- Modify `src/components/mit-sailing/admin/events/AdminEventFormView.tsx` to make edit mode a dense toggle-driven form editor, remove internal notes, and enforce admin assignment UX.
- Add or modify an admin show component, for example `src/components/mit-sailing/admin/events/AdminEventShowView.tsx`, to render compact details, public content sections, and registration review.
- Modify `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx` to replace registration cards with dense desktop/mobile table flows and confirmation dialogs, reusable from the canonical show page.
- Modify `src/libs/mit-sailing/eventQueries.ts` and tests to return public event admins sorted by name/email.
- Modify event schema/actions/queries/tests for old-site event parity fields: FAQ, Notice of Race, Sailing Instructions, Results, registration mode/URLs, phone, teams/boats, fee choice, and manual-confirm capacity behavior.
- Modify `src/locales/en.json` for all new visible strings.
- Modify `tests/e2e/AdminEvents.e2e.ts` or add focused coverage for the event list and registration review usability.

## Task 1: Plan, Branch, And Auth Role Mirror

**Files:**
- Modify: `src/libs/auth-client.ts`
- Modify: `src/libs/auth.ts`
- Modify: `src/libs/auth.test.ts`
- Modify: `src/libs/admin/users/appRoleActions.ts`
- Modify: `src/libs/admin/users/appRoleActions.test.ts`
- Optional create: `prisma/migrations/<timestamp>_normalize_better_auth_role_mirror/migration.sql`

- [x] **Step 1: Add failing tests for role mirror normalization**

Add/adjust tests so `Role.DOCK_STAFF`, `Role.DOCK_MASTER`, and `Role.VOLUNTEER_INSTRUCTOR` produce Better Auth `role: Role.USER`, while `Role.ADMIN` produces `role: Role.ADMIN`.

Run: `npm run test -- src/libs/auth.test.ts src/libs/admin/users/appRoleActions.test.ts`

Expected: FAIL until implementation normalizes non-admin mirrors.

- [x] **Step 2: Implement client/server role mirror fix**

In `src/libs/auth-client.ts`, import `customSessionClient` from `better-auth/client/plugins`, import type `auth`, and add `customSessionClient<typeof auth>()` to the plugin list.

In server/user role update paths, introduce a small helper equivalent to:

```ts
function betterAuthRoleMirrorForAppRole(appRole: Role): Role {
  return appRole === Role.ADMIN ? Role.ADMIN : Role.USER;
}
```

Use it anywhere Better Auth `role` is written from `appRole`.

- [x] **Step 3: Add migration cleanup if needed**

If `prisma/schema.prisma` still stores non-admin role mirrors in `User.role`, add SQL:

```sql
UPDATE "user"
SET "role" = CASE WHEN "app_role" = 'admin' THEN 'admin' ELSE 'user' END
WHERE "role" IS DISTINCT FROM CASE
  WHEN "app_role" = 'admin' THEN 'admin'
  ELSE 'user'
END;
```

- [x] **Step 4: Verify Task 1**

Run: `npm run test -- src/libs/auth.test.ts src/libs/admin/users/appRoleActions.test.ts src/libs/auth-client.test.ts`

Expected: PASS.

## Task 2: Permission Model And Admin Navigation

**Files:**
- Modify: `src/libs/auth/appPermissions.ts`
- Modify: `src/libs/auth/appPermissions.test.ts`
- Modify: `src/libs/admin/adminAreaAccess.ts`
- Modify: `src/libs/admin/adminAreaAccess.test.ts`
- Modify: `src/components/mit-sailing/admin/AdminSideNav.tsx` if its Events item checks only `EVENTS_MANAGE`

- [x] **Step 1: Add failing permission/nav tests**

Assert `Role.VOLUNTEER_INSTRUCTOR` has `Permission.EVENTS_ASSIGNED_MANAGE`, does not have `Permission.EVENTS_MANAGE`, and sees the Events admin nav/landing item.

Run: `npm run test -- src/libs/auth/appPermissions.test.ts src/libs/admin/adminAreaAccess.test.ts`

Expected: FAIL until the new permission and nav logic exist.

- [x] **Step 2: Implement permission grant**

Add:

```ts
EVENTS_ASSIGNED_MANAGE: 'events.assignedManage'
```

Grant it to `Role.VOLUNTEER_INSTRUCTOR`. Keep `EVENTS_MANAGE` for dock staff, dock master, and admin.

- [x] **Step 3: Show Events for either event permission**

Update admin resource/nav checks to use:

```ts
hasAnyPermission(permissions, [
  Permission.EVENTS_MANAGE,
  Permission.EVENTS_ASSIGNED_MANAGE,
])
```

- [x] **Step 4: Verify Task 2**

Run: `npm run test -- src/libs/auth/appPermissions.test.ts src/libs/admin/adminAreaAccess.test.ts`

Expected: PASS.

## Task 3: Event Access Modes And Event List Scopes

**Files:**
- Modify: `src/libs/admin/events/zenstackEventAccess.ts`
- Modify: `src/libs/admin/events/eventAdminAuthorization.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/page.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`
- Modify: `src/libs/admin/events/zenstackEventAccess.test.ts`
- Modify: `src/libs/admin/events/eventAdminAuthorization.test.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.test.ts`
- Modify: `src/locales/en.json`

- [x] **Step 1: Add failing access/list tests**

Cover:
- volunteer instructor assigned to an event gets `accessMode: 'editable'`;
- volunteer instructor unassigned to an event gets `accessMode: 'readOnly'`;
- dock staff/dock master/admin get `accessMode: 'editable'`;
- `/admin/events` defaults to `scope=my`;
- `scope=all` includes all admin-visible events.

Run: `npm run test -- src/libs/admin/events/zenstackEventAccess.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminQueries.test.ts`

Expected: FAIL until access modes and scope filters exist.

- [x] **Step 2: Implement access helpers**

Expose helpers equivalent to:

```ts
export type AdminEventAccessMode = 'editable' | 'readOnly';

export function canManageAllEventsWithAuthContext(props: {
  authContext: AppAuthContext;
}): boolean;

export function eventAccessModeWithAuthContext(props: {
  authContext: AppAuthContext;
  event: EventAccessRecord;
}): AdminEventAccessMode | null;
```

Return editable for global managers or assigned event admins; return read-only for unassigned volunteer instructors; return null otherwise.

- [x] **Step 3: Implement `scope=my | all` query behavior**

Add an `AdminEventListScope` type. Default invalid/missing scope to `my`. For `my`, filter `event.admins.some({ adminUserId: currentUserId })`; for `all`, list admin-visible events. Include each row’s `accessMode`.

- [x] **Step 4: Replace far-right table actions**

Update `AdminEventsListView` so every row has event title plus a compact action cluster/menu near the title and a card-like mobile row layout. At 390px width, edit/view/registrations/delete access must be visible without horizontal scrolling.

- [x] **Step 5: Verify Task 3**

Run: `npm run test -- src/libs/admin/events/zenstackEventAccess.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminQueries.test.ts`

Expected: PASS.

## Task 4: Read-Only Admin Event Detail And Mutations

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/edit/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/registrations/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/delete/page.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: related tests
- Modify: `src/locales/en.json`

- [x] **Step 1: Add failing read-only tests**

Assert read-only access hides delete/edit/save controls and registration mutation controls, never exposes internal notes, and keeps roster and question answers visible.

Run: `npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts`

Expected: FAIL until read-only mode is passed to components and actions require editable access.

- [x] **Step 2: Pass access mode through pages and components**

Add `accessMode` to `AdminEventFormView` and `AdminEventRegistrationsView` props. Render public/edit-only metadata for read-only users and a clear next-intl read-only badge/message.

- [x] **Step 3: Enforce mutation boundary**

Keep all event mutation Server Actions behind editable access. Registration roster query can use read-only access; status-changing actions must still call editable access.

- [x] **Step 4: Verify Task 4**

Run: `npm run test -- src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts`

Expected: PASS.

## Task 5: Event Admin Assignment Picker

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminSchemas.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- Modify: related tests
- Modify: `src/locales/en.json`

- [x] **Step 1: Add failing picker/action tests**

Assert assignable admins are limited to `volunteer_instructor`, `dock_staff`, `dock_master`, and `admin`; typeahead queries under 2 chars return already-selected users only; saving zero event admins fails validation.

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminSchemas.test.ts`

Expected: FAIL until role filtering and at-least-one validation exist.

- [x] **Step 2: Implement role-limited user options**

Filter user options with:

```ts
appRole: { in: [Role.VOLUNTEER_INSTRUCTOR, Role.DOCK_STAFF, Role.DOCK_MASTER, Role.ADMIN] }
```

Keep already-selected admins visible even if the search query would not return them.

- [x] **Step 3: Enforce one event admin**

Create flow already adds the creator. Update admin-save schema/action to reject an empty selected list and redirect with `validation_failed`.

- [x] **Step 4: Verify Task 5**

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminSchemas.test.ts`

Expected: PASS.

## Task 6: Registration Review Table UX

**Files:**
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- Modify: `src/locales/en.json`
- Modify: `tests/e2e/AdminEvents.e2e.ts`

- [x] **Step 1: Add failing UI/e2e assertions**

Assert the registration page exposes a table, keeps attendee/status/action menu reachable, opens `View answers` on mobile, and asks for confirmation before approve/cancel/reopen.

Run: `npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts`

Expected: FAIL until the card UI is replaced.

- [x] **Step 2: Replace cards with dense desktop table**

Desktop columns: attendee with compact action menu, status, registered date, swim agreement date, and one column per event question. No far-right action column.

- [x] **Step 3: Add mobile registration rows**

Mobile row header includes attendee, status, and compact action menu. Add `View answers` to open a simple two-column question/value table for that attendee.

- [x] **Step 4: Confirm status-changing actions**

Before submitting approve/cancel/reopen forms, show a confirmation dialog naming the attendee and resulting status. Keep action labels in next-intl.

- [x] **Step 5: Verify Task 6**

Run: `npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts`

Expected: PASS or a documented environment blocker with component-level tests passing.

## Task 7: Public Event Admin Contacts

**Files:**
- Modify: `src/libs/mit-sailing/eventQueries.ts`
- Modify: `src/libs/mit-sailing/eventQueries.test.ts`
- Verify existing public event detail component consumes `event.admins`

- [x] **Step 1: Add failing public query test**

Assert `getPublishedEventForPublicBySlug` returns real `event_admins`, sorted by admin name and email.

Run: `npm run test -- src/libs/mit-sailing/eventQueries.test.ts`

Expected: FAIL until admins are selected and returned.

- [x] **Step 2: Include admins in public event select**

Add:

```ts
admins: {
  orderBy: [{ admin: { name: 'asc' } }, { admin: { email: 'asc' } }],
  select: {
    id: true,
    admin: { select: { id: true, name: true, email: true } },
  },
}
```

Remove the `admins: []` fallback in the return object.

- [x] **Step 3: Verify Task 7**

Run: `npm run test -- src/libs/mit-sailing/eventQueries.test.ts`

Expected: PASS.

## Task 8: Canonical Admin Event Show Page

**Files:**
- Create: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/registrations/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/events/[slug]/edit/page.tsx`
- Modify: `src/libs/admin/events/eventAdminPaths.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventsListView.tsx`
- Create or modify: `src/components/mit-sailing/admin/events/AdminEventShowView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- Modify: `src/locales/en.json`
- Modify: related tests and `tests/e2e/AdminEvents.e2e.ts`

- [ ] **Step 1: Add failing route/path tests**

Cover `adminEventShowPath(slug)`, event-list row view links targeting `/admin/events/[slug]`, and `/admin/events/[slug]/registrations` redirecting to `/admin/events/[slug]#registrations` or otherwise no longer being the canonical route.

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts`

Expected: FAIL until show route/path behavior exists.

- [ ] **Step 2: Add failing show-page rendering tests**

Assert the first viewport includes event name/status badges, next/primary date, signed-up/confirmed/awaiting/remaining counts, event limit/capacity, registration window, assigned admins, and actions `Edit`, `View`, and editable-only `Delete`.

Expected: FAIL until `AdminEventShowView` exists.

- [ ] **Step 3: Implement canonical show page query and page**

Add a show-page DTO that includes concise event details, access mode, admins, dates, registration counts, registration window, capacity, public/external page state, public content sections, and registration review data. Use shortest practical Eastern datetime formatting for skimmable summary values.

- [ ] **Step 4: Move registration review into canonical show page**

Render registration review below the compact summary and public content sections. Keep a top anchor to `#registrations`; do not use tabs.

- [ ] **Step 5: Keep registration review mutations on show page**

Allow editable users to confirm/cancel/reopen registrations on `/admin/events/[slug]`. Read-only users can see roster answers but cannot see status-changing controls.

- [ ] **Step 6: Keep edit/delete route boundaries**

`/edit` owns event field mutations. `/delete` remains the destructive confirmation target, linked from the show page top right for editable users.

- [ ] **Step 7: Verify Task 8**

Run: `npm run test -- src/libs/admin/events/eventAdminQueries.test.ts src/libs/admin/events/eventAdminAuthorization.test.ts src/libs/admin/events/eventAdminActions.test.ts`

Expected: PASS.

## Task 9: Old-Site Event Content And Registration Parity

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_event_legacy_parity_fields/migration.sql`
- Modify: `src/libs/admin/events/eventAdminSchemas.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/mit-sailing/eventQueries.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationActions.ts`
- Modify: `src/libs/mit-sailing/eventRegistrationAnswerValidation.ts`
- Modify: `src/components/mit-sailing/events/EventDetailView.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationForm.tsx`
- Modify: `src/components/mit-sailing/events/EventRegistrationFormClient.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventShowView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- Modify: related tests
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add a legacy field mapping note**

Document the import mapping in this plan or a nearby migration note before schema work:
- `nor_page`/`nor` -> Notice of Race visibility/content;
- `faq_page`/`faq` -> FAQ visibility/content;
- `si_page`/`si` -> Sailing Instructions visibility/content;
- `res_page`/`results` -> Results visibility/content;
- `reg_page`, `reg_custom`, `reg_urlreg`, `reg_urlentries` -> registration mode and external URLs;
- `reg_confirm`, `reg_limit` -> manual-confirm capacity semantics;
- `phone` -> per-registration required phone prompt;
- `ask_notes`, `reg_notes` -> custom registration question section;
- `reg_team`, `team_size`, `boat_size`, `reg_repeatcap`, `event_regs`, `event_boats` -> team/boat registration shape;
- `has_fee`, `event_fees`, `deposit` -> event fees with deposit represented by `isDeposit`;
- intentionally dropped: `gender`, `print entries`, `attendance`, `internalNotes`.

- [ ] **Step 2: Add failing schema/query tests for public content sections**

Assert FAQ, Notice of Race, Sailing Instructions, and Results can be saved as sanitized rich text, imported from old fields, and rendered on public/admin show pages only when visible content exists.

Run: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/mit-sailing/eventQueries.test.ts`

Expected: FAIL until schema/actions/queries support the fields.

- [ ] **Step 3: Add failing registration mode tests**

Assert registration mode supports none, standard local registration, and custom external registration. Custom external stores both registration URL and entries URL and shows both where relevant on public/admin event pages.

- [ ] **Step 4: Add failing manual-confirm capacity tests**

Assert manual-confirm events allow over-limit signups while counting only confirmed registrations against the event limit. Summary wording must expose `Signed up`, `Confirmed`, `Awaiting confirmation`, and `Remaining`.

- [ ] **Step 5: Add failing phone/custom-question/fee tests**

Assert `Ask phone?` makes a per-event phone field required for every registrant and prefilled from account phone when available. Assert `Ask question?` uses the current custom registration question system. Assert one fee option is implicit and multiple fee options require a selected registration type.

- [ ] **Step 6: Add failing team registration tests**

Assert `Teams?` supports team name, boats per team, persons per boat, repeat-captain behavior, helm/crew names and emails, and admin registration review grouped by team and boat. Preserve old validation that team size and/or boat size must be greater than 1 when teams are enabled.

- [ ] **Step 7: Implement parity schema and migration**

Add only the fields/tables needed for the accepted parity features. Keep import names/mapping obvious enough for an old-site data migration. Do not add gender, print entries, attendance, duplicate event, or internal notes.

- [ ] **Step 8: Implement public/admin rendering parity**

Render FAQ, Notice of Race, Sailing Instructions, Results, external registration URL, external entries URL, and standard registration state on public event pages and admin show pages without empty sections.

- [ ] **Step 9: Implement registration submission/review parity**

Persist phone, custom question answers, fee choice, team/boat data, and confirmation status. Show those fields in admin registration review.

- [ ] **Step 10: Verify Task 9**

Run: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/mit-sailing/eventQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts src/libs/mit-sailing/eventRegistrationAnswerValidation.test.ts`

Expected: PASS.

## Task 10: Edit Page Form Reframing

**Files:**
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.test.tsx`
- Modify: `src/locales/en.json`
- Modify: `tests/e2e/AdminEvents.e2e.ts`

- [ ] **Step 1: Add failing edit-page layout tests**

Assert `/admin/events/[slug]/edit` reads as an editor: compact form header, no registration review table, no show-page summary layout, and section toggles for optional boxes.

- [ ] **Step 2: Add failing optional-box tests**

Assert new events default optional boxes off. Assert existing events with imported/saved content or settings open the relevant boxes so admins do not miss existing data.

- [ ] **Step 3: Implement toggle-driven editor**

Always show core event fields and event admins. Hide optional editors until selected: FAQ, Notice of Race, Sailing Instructions, Results, Registration, Ask phone, Ask question, Teams, and Entry fees. Do not show Ask gender.

- [ ] **Step 4: Remove internal notes UI**

Remove `Internal notes` from the edit page. If the schema cleanup happens in Task 9, do not leave hidden form fields or translation strings that imply the feature remains.

- [ ] **Step 5: Verify Task 10**

Run: `npm run test -- src/components/mit-sailing/admin/events/AdminEventFormView.test.tsx`

Expected: PASS.

## Task 11: Deferred Deletion Notification Issue

**Files:**
- GitHub issue only; no repo code changes.

- [x] **Step 1: Create the follow-up issue**

Open a GitHub issue titled `Send registrant notifications when deleting events` with body covering:
- snapshot-before-delete payloads;
- one BullMQ job per registrant;
- React Email notification with event details and event admin contacts;
- abort delete if enqueue fails;
- worker/action/email tests.

Expected: issue URL recorded for final output.

## Task 12: Verification And Local Review Hardening

**Files:**
- Artifact directory: `~/.codex/tmp/mitsailing-event-admin-access/task-12/`

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run test
npm run lint
npm run check:types
npm run check:i18n
npm run check:deps
npm run test:e2e -- tests/e2e/AdminEvents.e2e.ts
```

Expected: PASS, or document exact E2E environment blocker.

- [ ] **Step 2: Run CodeRabbit pass 1**

Run: `coderabbit review --agent -c AGENTS.md --base main`

Save raw output to `~/.codex/tmp/mitsailing-event-admin-access/task-12/coderabbit-pass-1.raw.txt` and parsed decisions to `coderabbit-pass-1.parsed.md`.

- [ ] **Step 3: Fix actionable pass 1 findings and rerun gate**

Fix only real issues relevant to this PR, then rerun the smallest targeted test plus `npm run lint` and `npm run check:types`.

- [ ] **Step 4: Run CodeRabbit pass 2**

Run: `coderabbit review --agent -c AGENTS.md --base main`

Save raw output to `~/.codex/tmp/mitsailing-event-admin-access/task-12/coderabbit-pass-2.raw.txt` and parsed decisions to `coderabbit-pass-2.parsed.md`.

- [ ] **Step 5: Final local gate**

Rerun the full command set from Step 1. Record pass/fail status compactly.

## Task 13: PR Hardening

**Files:**
- Git branch: `fix/event-admin-access-fix`
- GitHub PR

- [ ] **Step 1: Commit and push**

Commit with Conventional Commits and push `fix/event-admin-access-fix`.

- [ ] **Step 2: Create or update ready-for-review PR**

If a PR already exists for the branch, update it. Otherwise create a ready PR against `main`. Include verification and the deferred issue link in the body.

- [ ] **Step 3: Confirm CodeRabbit starts**

If CodeRabbit does not start automatically, comment `@coderabbitai full review` and confirm it starts or reports a review in progress.

- [ ] **Step 4: Run up to five bounded post-PR rounds**

Each round uses one fresh subagent, starts from current PR state only, inspects checks/review comments/CodeRabbit comments, fixes relevant actionable issues, runs local verification, commits once, and pushes once. After a push, stop live waiting and schedule one 30-minute recheck if checks or review bots are pending.

- [ ] **Step 5: Final PR comment**

Post one compact PR comment with local commands run, latest pushed commit, GitHub checks status, CodeRabbit/GitHub review status, grouped fixes, and remaining risks.
