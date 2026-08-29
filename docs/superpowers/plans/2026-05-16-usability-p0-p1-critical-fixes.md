# Usability P0/P1 Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the P0/P1 usability issues identified in `usability/usability-audit.md` so critical public, reservation, and staff workflows are task-completable and trustworthy.

**Architecture:** Work in a dedicated implementation branch after this plan PR lands. Keep fixes scoped to existing Next.js App Router, server actions, Prisma query modules, shared MIT Sailing components, and current e2e suites. Do not add a usability harness or accessibility-specific work; this plan only implements the audit’s critical/high task-fit findings.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, next-intl, Tailwind v4, Vitest, Playwright.

---

## Scope And Source

Source audit: `usability/usability-audit.md`, dated May 16, 2026.

Covered findings:

- P0 Event registration admin comparison and bulk approval.
- P0 Pavilion reservation mobile selected-space completion.
- P1 Fleet catalog broken media.
- P1 Site-wide demo/stale alert.
- P1 Public classes list missing decision facts.
- P1 Admin Pavilion reservation mobile triage.
- P1 CMS policy pages sample content.
- P1 Reservation confirmation reference-code exposure.
- P1 Admin dashboard navigation-only hub, from the audit’s top critical/high list.

Out of scope for this plan:

- P2/P3 backlog items: auth callback context, profile ratings, long admin form sticky actions, site text bulk workflow, donation CTA wording, event registration schedule display, mobile nav drawer, contact/Mashnee content, ratings mobile table, and revision/association polish.
- Axe/WCAG/a11y-specific verification. The `/accessibility` policy page content cleanup is in scope only because it is visibly sample content.
- Committing `/usability` generated evidence. Use it as local reference only.

---

## File Structure

- Modify `src/libs/admin/events/eventAdminQueries.ts`
  - Add registration-review fields needed by the admin comparison table: capacity, ordered questions, normalized answer values, and pending-first ordering.

- Modify `src/libs/admin/events/eventAdminActions.ts`
  - Add a bulk registration status server action with the same authorization, transaction, capacity guard, revalidation, and redirect style as the existing single-row action.

- Modify `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
  - Replace desktop card-only review with a comparison table, bulk controls, capacity summary, and mobile cards.

- Modify `tests/e2e/AdminEvents.e2e.ts`
  - Cover admin registration table, bulk actions, counts, and capacity guard.

- Modify `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx`
  - Fix mobile sticky footer overlap, invalid-field focus/scroll, confirmation copy, group-type pricing context, and staff-reviewed price display.

- Modify `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx`
  - Cover footer invalid state, pricing labels, confirmation copy, and group-type pricing context.

- Modify `tests/e2e/MitSailingCatalog.e2e.ts`
  - Cover reservation mobile completion and confirmation copy, class card decision facts, and fleet media/fallback behavior.

- Modify `src/data/mit-sailing/classesFleetSeed.ts`
  - Either point fleet boats at committed local image assets or mark missing media so intentional fallback UI renders.

- Create or modify `src/data/mit-sailing/classesFleetSeed.test.ts`
  - Validate every local fleet image path exists when the seed references one.

- Modify `src/components/mit-sailing/fleet/FleetListView.tsx`
  - Render real images or a deliberate fallback without broken-image panels.

- Modify `src/components/mit-sailing/fleet/FleetViews.test.tsx`
  - Cover fleet image and fallback rendering.

- Modify `src/data/mit-sailing/siteAlertsSeed.ts`
  - Remove demo/stale production-like seed copy.

- Modify `src/components/mit-sailing/site/SiteAlertsBanner.tsx`
  - Cap mobile height, show active period/update/status context, and support persisted collapse/dismissal.

- Modify `tests/e2e/SiteAlerts.e2e.ts`
  - Stop asserting demo copy; assert useful active alert behavior and dismissal/collapse.

- Modify class catalog query modules used by `/classes`
  - Add next date, registration state, capacity/open cue, and prerequisite/rating metadata for cards.

- Modify `src/components/mit-sailing/classes/ClassesCatalogView.tsx`
  - Show class decision facts and clearer next action.

- Modify `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/page.tsx`
  - Keep desktop table and add mobile triage cards; put actionable queue before empty schedule content on mobile.

- Modify `tests/e2e/AdminHub.e2e.ts`
  - Cover admin dashboard operational cards and Pavilion reservation mobile triage if no narrower existing spec is a better fit.

- Modify `src/data/mit-sailing/cmsSeed.ts`
  - Replace sample policy copy and add policy owner/review status or publishing guard content/metadata where the current CMS seed supports it.

- Modify `src/data/mit-sailing/cmsSeed.test.ts`
  - Assert policy pages no longer contain sample labels or sample legal caveats.

- Modify `src/app/[locale]/(marketing)/(site)/admin/page.tsx` and related admin query helpers if needed.
  - Add operational cards: pending event registrations, pending Pavilion reservations, active/stale alerts, draft/stale CMS, and upcoming events needing review.

- Modify `src/locales/en.json`
  - Add or update all user-visible labels, status text, button text, errors, summaries, and confirmation copy.

---

### Task 1: Admin Event Registration Comparison Table And Bulk Actions

**Files:**
- Modify: `src/libs/admin/events/eventAdminQueries.ts`
- Modify: `src/libs/admin/events/eventAdminActions.ts`
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- Modify: `src/locales/en.json`
- Test: `tests/e2e/AdminEvents.e2e.ts`

- [ ] **Step 1: Write failing e2e coverage for the comparison table**

Add tests to `tests/e2e/AdminEvents.e2e.ts` for `/admin/events/bluewater-boston-provincetown/registrations`.

Required assertions:

- The page shows a table at desktop.
- Pending registrations appear before approved/cancelled registrations when viewing all registrations.
- The table has columns for registrant, email/contact, status, submitted, swim agreement, and each seeded Bluewater registration question.
- A registration without an answer shows an explicit empty answer label, not a blank cell.
- The page shows confirmed count, pending count, capacity, remaining seats, and selected count.

- [ ] **Step 2: Run focused e2e and confirm failure**

Run:

```bash
npm run e2e:preflight
npm run e2e:build
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminEvents.e2e.ts --project=chromium --grep "registrations"
```

Expected: FAIL because the current page renders cards, not a comparison table or bulk controls.

- [ ] **Step 3: Extend admin registration query DTO**

In `eventAdminQueries.ts`, update `AdminEventRegistrationsDto` and `loadAdminEventRegistrationsBySlug` so the view receives:

- `maxParticipants: number | null`
- ordered `questions`
- `registrationCounts`
- registrations sorted pending first, then newest first inside each status group
- each registration’s answers normalized by question ID for table rendering while preserving the existing answer list for mobile cards if helpful

Do not add a database migration.

- [ ] **Step 4: Add bulk status server action**

In `eventAdminActions.ts`, add a bulk action that:

- Requires admin using the existing `requireAdmin(locale)` pattern.
- Parses selected registration IDs and target status from `FormData`.
- Rejects empty selections with `validation_failed`.
- Opens a Prisma transaction.
- Locks the event row with the same `FOR UPDATE` pattern used by `updateAdminEventRegistrationStatusAction`.
- For approved bulk updates, counts already-approved registrations excluding the selected IDs, then rejects if selected-to-approve would exceed `maxParticipants`.
- Updates only registrations belonging to the requested event slug.
- Revalidates with `revalidateEventAdminMutation(locale, [slug])`.
- Redirects back to `adminEventRegistrationsPath(slug)` with the existing error-code redirect style on failure.

- [ ] **Step 5: Implement desktop table and mobile cards**

In `AdminEventRegistrationsView.tsx`:

- Keep status filters.
- Add a desktop-only comparison table.
- Add row checkboxes for pending and approved/cancellable rows.
- Add a bulk action form around selected rows and bulk buttons.
- Show capacity summary near the controls.
- Keep row-level approve/cancel/reopen forms.
- Keep mobile cards, but compact answer display and show the same capacity/status facts.
- Keep the disabled bulk email placeholder unchanged unless layout requires moving it.

- [ ] **Step 6: Add translations**

Add `AdminEvents` keys for:

- selected count
- capacity summary
- remaining seats
- approve selected
- cancel selected
- no answer
- over-capacity disabled reason
- comparison table label
- registration contact column labels

- [ ] **Step 7: Verify focused coverage**

Run:

```bash
npm run test
npm run check:types
npm run check:i18n
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminEvents.e2e.ts --project=chromium --grep "registrations"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/libs/admin/events/eventAdminQueries.ts src/libs/admin/events/eventAdminActions.ts src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx src/locales/en.json tests/e2e/AdminEvents.e2e.ts
git commit -m "feat: improve event registration admin triage"
```

---

### Task 2: Pavilion Reservation Mobile Completion And Confirmation

**Files:**
- Modify: `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx`
- Modify: `src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx`
- Modify: `tests/e2e/MitSailingCatalog.e2e.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing component tests**

Add tests that assert:

- After selecting a space without date/time, the invalid reason appears near the slot/date-time controls.
- Clicking the disabled/invalid next action scrolls/focuses the first unresolved field.
- Staff-reviewed/TBD items render “Pricing confirmed after review,” not `$0.00`.
- The default group type pricing context is visible before prices are relied on.
- Confirmation renders “Stew will contact you shortly” style copy and does not render the reference code.

- [ ] **Step 2: Run component tests and confirm failure**

Run:

```bash
npm run test -- src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx
```

Expected: FAIL on missing invalid-field placement, old confirmation reference code, or pricing/context assertions.

- [ ] **Step 3: Fix mobile footer and invalid-field placement**

In `PavilionReservationWizard.tsx`:

- Keep the spaces-step footer fixed only when it does not cover active controls.
- Increase bottom padding on the form enough for the largest mobile footer state.
- Make the footer error row compact and non-overlapping on 390px width.
- Render slot/date-time validation text next to the incomplete slot controls when `showErrors` is true.
- Ensure `scrollToSpacesStepProblem` scrolls to `emailRef`, `slotsRef`, or `spacesRef` and focuses the email field when relevant.

- [ ] **Step 4: Fix pricing context and staff-reviewed labels**

Use the existing `pricingType === 'tbd'` / `price === null` path so staff-reviewed items display review-pricing text. Do not show `$0.00` for “Fees arranged with Sailing Master.”

Keep a selected default group type only if a visible explanation appears above price-dependent options. If the component cannot make the default clear enough, change initial persona state to require explicit selection and update hidden fields/schema tests accordingly.

- [ ] **Step 5: Fix confirmation semantics**

Remove public reference-code rendering from `PavilionReservationConfirmation`. Add confirmation text that:

- says the request was received
- says Stew will contact the requester shortly
- says no payment has been captured
- shows Stew’s direct contact if available in existing seed/content constants
- links to the public MIT Sailing contact path

Do not remove backend reference-code generation or staff/email reference-code usage.

- [ ] **Step 6: Add mobile e2e coverage**

Extend `tests/e2e/MitSailingCatalog.e2e.ts`:

- Use mobile viewport.
- Open `/reserve`.
- Select a space.
- Trigger next without completing date/time.
- Assert the date/time controls and invalid message are visible and not covered by the footer.
- Complete a valid request far enough to reach confirmation when the existing test helpers can safely clean up submitted data.
- Assert confirmation does not show a reference code.

- [ ] **Step 7: Verify**

Run:

```bash
npm run test -- src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx
npm run check:types
npm run check:i18n
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/MitSailingCatalog.e2e.ts --project=chromium --grep "reservation"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.tsx src/components/mit-sailing/pavilion-reservations/PavilionReservationWizard.test.tsx tests/e2e/MitSailingCatalog.e2e.ts src/locales/en.json
git commit -m "fix: improve pavilion reservation mobile completion"
```

---

### Task 3: Fleet Catalog Media

**Files:**
- Modify: `src/data/mit-sailing/classesFleetSeed.ts`
- Create: `src/data/mit-sailing/classesFleetSeed.test.ts`
- Modify: `src/components/mit-sailing/fleet/FleetListView.tsx`
- Modify: `src/components/mit-sailing/fleet/FleetViews.test.tsx`
- Modify if assets are available: `public/images/boats/*`

- [ ] **Step 1: Write failing seed path test**

Create a co-located test that iterates fleet seed image paths. For every path that starts with `/`, assert the corresponding file exists under `public/`.

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm run test -- src/data/mit-sailing/classesFleetSeed.test.ts
```

Expected: FAIL because `/images/boats/...` files are missing.

- [ ] **Step 3: Fix image source behavior**

Choose one implementation based on available assets:

- If real boat assets are available, add them under `public/images/boats/` using the existing seed filenames.
- If assets are not available, change seed `image` values to empty/null-compatible values and render intentional fallback cards without large broken-image panels.

Do not replace broken local paths with remote stock URLs.

- [ ] **Step 4: Cover fallback rendering**

Update `FleetViews.test.tsx` to assert:

- Boats with valid images render image alt text from boat name.
- Boats without images render the intentional placeholder.
- The placeholder is not a broken image.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- src/data/mit-sailing/classesFleetSeed.test.ts src/components/mit-sailing/fleet/FleetViews.test.tsx
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/mit-sailing/classesFleetSeed.ts src/data/mit-sailing/classesFleetSeed.test.ts src/components/mit-sailing/fleet/FleetListView.tsx src/components/mit-sailing/fleet/FleetViews.test.tsx public/images/boats
git commit -m "fix: prevent broken fleet catalog media"
```

If no assets were added, omit `public/images/boats` from `git add`.

---

### Task 4: Site Alert Banner Trust And Mobile Fit

**Files:**
- Modify: `src/data/mit-sailing/siteAlertsSeed.ts`
- Modify: `src/components/mit-sailing/site/SiteAlertsBanner.tsx`
- Modify: `tests/e2e/SiteAlerts.e2e.ts`
- Modify: `src/locales/en.json` if new strings are needed

- [ ] **Step 1: Write failing e2e coverage**

Update `SiteAlerts.e2e.ts` so it asserts:

- The active seed alert does not contain “Demo site alert.”
- Mobile alert content does not dominate the first viewport.
- Alert active period or updated/status context is visible.
- Collapse/dismiss persists across navigation or reload for the same alert ID.

- [ ] **Step 2: Run focused e2e and confirm failure**

Run:

```bash
npm run e2e:preflight
npm run e2e:build
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/SiteAlerts.e2e.ts --project=chromium
```

Expected: FAIL while demo copy and missing persisted collapse/status behavior remain.

- [ ] **Step 3: Replace demo seed copy**

Update `siteAlertsSeed.ts` so seed content is production-like and time-bounded. Avoid copy that says “demo,” “seeded for local testing,” or visible through 2030 unless that date is truly needed.

- [ ] **Step 4: Improve banner UI**

In `SiteAlertsBanner.tsx`:

- Cap mobile height.
- Provide collapse/dismiss control if active alert content is long.
- Persist collapse/dismissal by alert ID.
- Show active period, updated date, or status context in concise text.
- Keep existing alert links safe and sanitized according to current CMS rendering patterns.

- [ ] **Step 5: Verify**

Run:

```bash
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/SiteAlerts.e2e.ts --project=chromium
npm run test
npm run check:types
npm run check:i18n
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/mit-sailing/siteAlertsSeed.ts src/components/mit-sailing/site/SiteAlertsBanner.tsx tests/e2e/SiteAlerts.e2e.ts src/locales/en.json
git commit -m "fix: make site alerts production-ready"
```

---

### Task 5: Classes List Decision Support

**Files:**
- Modify class catalog query modules used by `/classes`
- Modify: `src/components/mit-sailing/classes/ClassesCatalogView.tsx`
- Modify: `tests/e2e/MitSailingCatalog.e2e.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing e2e coverage**

Extend the `/classes` e2e test to assert each representative class card shows:

- class level/name
- next date or “No upcoming dates”
- registration/open/full/closed status
- capacity cue when available
- prerequisite or rating cue
- a direct next action

- [ ] **Step 2: Run focused e2e and confirm failure**

Run:

```bash
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/MitSailingCatalog.e2e.ts --project=chromium --grep "/classes"
```

Expected: FAIL because current cards only show level, name, description, and generic CTA.

- [ ] **Step 3: Extend class catalog data**

Update the server-side class catalog query/DTO so each card can render:

- next upcoming related event date
- registration state for that next event when available
- capacity/open/full cue when available
- prerequisite/rating summary

Use existing event/class relationship helpers where possible. Keep detail pages unchanged.

- [ ] **Step 4: Render decision facts**

Update `ClassesCatalogView.tsx` cards:

- Keep current category grouping.
- Add compact metadata rows.
- Use sentence-case translations.
- Use direct CTA text: `View dates`, `Register`, or `View class` depending on available state.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test
npm run check:types
npm run check:i18n
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/MitSailingCatalog.e2e.ts --project=chromium --grep "/classes"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mit-sailing/classes/ClassesCatalogView.tsx src/libs/mit-sailing src/locales/en.json tests/e2e/MitSailingCatalog.e2e.ts
git commit -m "feat: add class catalog decision support"
```

---

### Task 6: Admin Pavilion Reservation Mobile Triage

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/page.tsx`
- Modify: `tests/e2e/AdminHub.e2e.ts` or a narrower existing admin Pavilion spec
- Modify: `src/locales/en.json` if new strings are needed

- [ ] **Step 1: Write failing mobile e2e coverage**

Add a mobile viewport test that signs in as admin, opens `/admin/pavilion-reservations`, and asserts:

- request card shows reference
- event name
- requester
- status
- first slot
- estimate
- conflict state
- primary action link
- empty schedule days do not appear before the actionable queue on mobile

- [ ] **Step 2: Run focused e2e and confirm failure**

Run:

```bash
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminHub.e2e.ts --project=chromium --grep "pavilion"
```

Expected: FAIL because the mobile route currently exposes a wide table and empty schedule content first.

- [ ] **Step 3: Add mobile cards**

In the Pavilion reservations admin page:

- Keep the desktop table unchanged for `md`/`lg` and wider breakpoints.
- Hide the wide table on mobile.
- Render mobile cards with the required triage facts.
- Put actionable request queue above empty schedule cards on mobile, or collapse empty days by default.

- [ ] **Step 4: Verify**

Run:

```bash
npm run check:types
npm run check:i18n
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminHub.e2e.ts --project=chromium --grep "pavilion"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/[locale]/(marketing)/(site)/admin/pavilion-reservations/page.tsx' tests/e2e/AdminHub.e2e.ts src/locales/en.json
git commit -m "fix: improve pavilion reservation admin mobile triage"
```

---

### Task 7: CMS Policy Content And Review Guard

**Files:**
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/data/mit-sailing/cmsSeed.test.ts`
- Modify CMS admin/page edit code only if existing models already support review/owner metadata

- [ ] **Step 1: Write failing seed tests**

Update `cmsSeed.test.ts` to assert the published `/privacy`, `/terms`, and `/accessibility` CMS pages:

- do not contain “Sample content”
- do not contain “sample”
- do not contain placeholder legal caveats
- include a meaningful owner/review-status cue if supported by existing CMS fields

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm run test -- src/data/mit-sailing/cmsSeed.test.ts
```

Expected: FAIL because current seed policy pages contain sample content.

- [ ] **Step 3: Replace sample policy copy**

Update `cmsSeed.ts` with reviewed, non-placeholder copy for privacy, terms, and accessibility statement pages.

Use existing CMS page fields. Do not add new schema fields in this task unless the current model already has owner/review metadata fields that are unused.

- [ ] **Step 4: Add owner/review or publishing guard using current architecture**

If current CMS admin already exposes draft/publish/revision state, add visible owner/review status copy or edit guidance there. If no such field exists, add a seed/test guard that prevents publishing copy containing sample labels and document that deeper workflow is deferred to the later CMS productivity plan.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- src/data/mit-sailing/cmsSeed.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/mit-sailing/cmsSeed.ts src/data/mit-sailing/cmsSeed.test.ts
git commit -m "fix: replace sample policy content"
```

---

### Task 8: Admin Operations Dashboard

**Files:**
- Modify: `src/app/[locale]/(marketing)/(site)/admin/page.tsx`
- Modify or create admin dashboard query helper under `src/libs/admin`
- Modify: `tests/e2e/AdminHub.e2e.ts`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing admin dashboard e2e coverage**

Extend `AdminHub.e2e.ts` so `/admin` asserts operational cards for:

- pending event registrations
- pending Pavilion reservation requests
- active or stale site alerts
- draft/stale CMS pages
- upcoming events needing review

Each card must show a count and link to the relevant admin route.

- [ ] **Step 2: Run focused e2e and confirm failure**

Run:

```bash
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminHub.e2e.ts --project=chromium --grep "admin dashboard"
```

Expected: FAIL because the current dashboard is primarily navigation.

- [ ] **Step 3: Add admin operations query**

Create or extend an admin query helper to load counts for the cards. Keep queries small and server-only:

- pending event registrations
- pending Pavilion reservations
- active alerts and stale alerts
- draft/stale CMS pages if the CMS model supports status timestamps
- upcoming events missing review-relevant fields where existing data can determine this safely

If a count cannot be derived reliably from existing data, omit that specific metric and include the nearest supported operational card rather than adding schema.

- [ ] **Step 4: Render dashboard cards**

Update `/admin` page:

- Keep existing navigation links.
- Add operations cards above navigation.
- Each card has title, count, short description, and route link.
- Use compact, work-focused admin styling consistent with current admin components.

- [ ] **Step 5: Verify**

Run:

```bash
npm run check:types
npm run check:i18n
PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/AdminHub.e2e.ts --project=chromium --grep "admin dashboard"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/[locale]/(marketing)/(site)/admin/page.tsx' src/libs/admin tests/e2e/AdminHub.e2e.ts src/locales/en.json
git commit -m "feat: add admin operations dashboard"
```

---

### Task 9: Full Verification

**Files:**
- Verify all files changed by Tasks 1-8.

- [ ] **Step 1: Run unit and component tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run type check**

Run:

```bash
npm run check:types
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run i18n check**

Run:

```bash
npm run check:i18n
```

Expected: PASS.

- [ ] **Step 5: Run full e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Confirm `/usability` artifacts are not staged**

Run:

```bash
git status --short --ignored usability
```

Expected: `/usability` is ignored or absent; no `/usability` files are staged.

- [ ] **Step 7: Complete development branch**

Announce:

```text
I'm using the finishing-a-development-branch skill to complete this work.
```

Then use `superpowers:finishing-a-development-branch` to present final verification, commit state, and PR/push options.

---

## Execution Notes

- Use a fresh implementation branch after this plan PR is reviewed.
- Do not implement this plan on `main`.
- Prefer subagent-driven development for Task 1 and Task 2 because they touch multiple files and require careful test coverage.
- Stop and ask for clarification if:
  - fleet assets are unavailable and fallback UI would be unacceptable
  - admin dashboard counts require schema changes
  - full e2e is blocked by Docker, ports, or seed data
  - bulk registration approval cannot be implemented safely with existing status semantics

## Verification Summary

This plan is considered complete only when:

- All P0/P1 rows in `usability/usability-audit.md` are addressed.
- The audit’s top critical/high admin dashboard issue is addressed.
- Site alert active period/update/status and CMS policy owner/review guard coverage are included.
- `npm run test`, `npm run check:types`, `npm run lint`, `npm run check:i18n`, and `npm run test:e2e` pass or any blocker is explicitly documented.
