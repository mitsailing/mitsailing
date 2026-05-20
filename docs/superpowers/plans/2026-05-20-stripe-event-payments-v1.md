# Stripe Event Payments V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **AI control plane:** The main agent acts as project manager. It keeps conversation updates minimal, updates this document as the source of truth, assigns one bounded worker per phase or task packet, reviews every worker diff before continuing, and keeps only the active phase plus review findings in context.

**Goal:** Add Stripe Embedded Checkout payments for MIT Sailing event registrations, including event payment settings, per-registration payment records, admin operations, webhooks, receipt/request/reminder emails, and minimal user payment status.

**Architecture:** `zenstack/schema.zmodel` remains the schema source of truth and generated Prisma artifacts follow from it. Payments are modeled as immutable per-registration ledger rows that reference the selected `EventEntryFee`, with Stripe Checkout Sessions created on demand and webhook events applied idempotently. Event editors manage per-event settings and roster payment actions, while global payment ledger access uses `PAYMENTS_VIEW`; background email/reminder behavior uses existing BullMQ and transactional email patterns.

**Tech Stack:** TypeScript, Next.js App Router, React 19, next-intl, ZenStack v3, Prisma 7, PostgreSQL, BullMQ, React Email, Stripe Node SDK, Stripe.js Embedded Checkout, Vitest, Playwright.

---

## Execution Status

- Branch/worktree: `feature/stripe-event-payments-v1` at `/Users/andrewkelley/GitHub/mitsailing-stripe-event-payments-v1`
- Base: `origin/main`
- Current phase: `Phase 4 - checkout, public event, profile, admin UI`
- Last updated: `2026-05-20`
- User-visible updates: only this plan document after implementation starts, except hard blockers.

## Open Product Decision

Decision: can a user change their selected fee after a payment record exists?

Recommended answer: no. Once a fee-bearing registration creates its payment record, the selected `EventEntryFee` is locked onto that payment. If the wrong fee was selected, an event editor can cancel or mark the payment as handled by MIT Sailing, and V1 avoids mutable Stripe line items, receipt mismatch, and refund ambiguity.

Implementation default unless corrected: lock fee selection after payment record creation.

## Docs And References Checked

- Stripe skill: `/Users/andrewkelley/.agents/skills/stripe-best-practices/SKILL.md`
- Stripe payments reference: `/Users/andrewkelley/.agents/skills/stripe-best-practices/references/payments.md`
- Stripe security reference: `/Users/andrewkelley/.agents/skills/stripe-best-practices/references/security.md`
- Context7 Stripe Node: `/stripe/stripe-node`
- Context7 Stripe docs: `/websites/stripe`
- Context7 Stripe.js docs: `/websites/stripe_js`
- Repo rules: `AGENTS.md`, `.cursor/rules/package-first-simple.mdc`, `.cursor/rules/tdd.mdc`, `.cursor/rules/e2e-verification.mdc`, `.cursor/rules/admin-list-usability.mdc`, `.cursor/rules/dates-us-eastern.mdc`, `.cursor/rules/ui-color-tokens.mdc`

Important Stripe conclusions:

- Use Checkout Sessions for one-time event payments.
- Use Embedded Checkout via Stripe.js.
- Do not pass `payment_method_types` for web checkout; let Dashboard dynamic payment methods apply.
- Verify webhook signatures using raw request body plus `STRIPE_WEBHOOK_SECRET`.
- Store and skip duplicate Stripe event ids.
- Use request idempotency keys when creating Checkout Sessions.
- Prefer restricted API keys operationally; the app env name remains `STRIPE_SECRET_KEY` unless product decides to rename.

## Repo Findings

- Event models and policies live in `zenstack/schema.zmodel`; `prisma/schema.prisma` is generated and must not be edited directly.
- Event fees already use integer USD cents via `EventEntryFee.amountCents`.
- Money helpers already exist in `src/libs/money/stripeUsdMinorUnits.ts`.
- Event registration flow locks the event row and checks capacity in `src/libs/mit-sailing/eventRegistrationActions.ts`.
- Event admin status changes and fee CRUD live in `src/libs/admin/events/eventAdminActions.ts`.
- Event admin data loading lives in `src/libs/admin/events/eventAdminQueries.ts`.
- Event admin UI lives in `src/components/mit-sailing/admin/events/AdminEventFormView.tsx` and `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`.
- Public event UI lives in `src/components/mit-sailing/events/EventDetailView.tsx`, `EventRegistrationCta.tsx`, and `EventRegistrationFormClient.tsx`.
- Transactional email sends through `src/libs/email/sendTransactional.ts`; templates live in `emails/`.
- BullMQ default worker dispatch lives in `src/worker/index.ts` and `src/worker/defaultQueue.ts`.
- `PAYMENTS_VIEW` and `PAYMENTS_OVERRIDE` already exist. `PAYMENTS_VIEW` is granted to dock masters and admins; `PAYMENTS_OVERRIDE` is admin-only through `ALL_PERMISSIONS`.

## File Map

Schema and generated artifacts:

- Modify: `zenstack/schema.zmodel` for event address fields, payment settings, event payment records, Stripe webhook idempotency, and notification log markers.
- Generated after schema: `prisma/schema.prisma`, `src/generated/prisma/**`, ZenStack generated artifacts.
- Add migration under `prisma/migrations/*_stripe_event_payments_v1/`.

Stripe and payment domain:

- Create: `src/libs/stripe/stripeClient.ts` for server-side Stripe client construction.
- Create: `src/libs/stripe/stripeCheckoutSessions.ts` for Embedded Checkout Session creation.
- Create: `src/libs/stripe/stripeWebhookEvents.ts` for event parsing, typing, idempotency, and status dispatch.
- Create: `src/libs/mit-sailing/eventPayments.ts` for eligibility, status transitions, manual handling, reminder/digest eligibility, and receipt URL capture.
- Create: `src/libs/mit-sailing/eventPayments.test.ts`.
- Create: `src/libs/mit-sailing/eventPaymentCheckout.ts` for user checkout access and session-client-secret orchestration.
- Create: `src/libs/mit-sailing/eventPaymentCheckout.test.ts`.

Admin events:

- Modify: `src/libs/admin/events/eventAdminSchemas.ts` for payment settings and manual handling forms.
- Modify: `src/libs/admin/events/eventAdminActions.ts` for payment settings, approval-created payment requests, resend, and manual handling.
- Modify: `src/libs/admin/events/eventAdminQueries.ts` to include payment state on editor, roster, and ledger DTOs.
- Modify: `src/libs/admin/events/eventAdminPaths.ts` for admin payment paths.
- Modify: `src/components/mit-sailing/admin/events/AdminEventFormView.tsx` to replace the Stripe placeholder with payment settings and address controls.
- Modify: `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx` to add payment status, resend, manual handled action, and note dialog/popover.
- Create: `src/components/mit-sailing/admin/payments/AdminPaymentsLedgerView.tsx`.
- Create: `src/app/[locale]/(marketing)/(site)/admin/payments/page.tsx`.

Public/profile checkout:

- Create: `src/app/[locale]/(marketing)/(site)/events/[slug]/checkout/page.tsx`.
- Create: `src/components/mit-sailing/events/EventPaymentCheckout.tsx`.
- Modify: `src/libs/mit-sailing/eventRegistrationActions.ts` to create payment records during auto-approved registration and after admin approval.
- Modify: `src/libs/mit-sailing/eventQueries.ts` and public DTOs to include address and payment CTA state.
- Modify: `src/components/mit-sailing/events/EventDetailView.tsx` and `EventRegistrationCta.tsx` for address links and payment CTA.
- Create: `src/app/[locale]/(auth)/profile/payments/page.tsx`.
- Modify: `src/components/auth/profile/ProfileSideNav.tsx` for profile payment navigation.
- Create: `src/components/auth/profile/ProfilePaymentsView.tsx`.

Webhooks, jobs, and email:

- Create: `src/app/api/stripe/webhooks/route.ts`.
- Create: `src/app/api/stripe/webhooks/route.test.ts`.
- Create: `emails/event-payment-request.tsx`, `emails/event-payment-receipt.tsx`, `emails/event-payment-reminder.tsx`, `emails/event-payment-admin-digest.tsx`.
- Create: `src/libs/email/event-payment-emails.ts`.
- Create: `src/worker/eventPaymentEmailJob.ts`.
- Modify: `src/worker/index.ts` to dispatch event payment jobs.
- Modify: `src/libs/email/emailMessages.ts` and schema enums to include event payment email categories.

Config, locales, tests:

- Modify: `package.json` and lockfile for `stripe` and `@stripe/stripe-js`.
- Modify: `src/libs/Env.ts`, `src/libs/Env.test.ts`, `.env.example`, `.env.staging.example`, `.env.production.example`, `.env.production.worker.example`.
- Modify: `src/locales/en.json` for all visible strings.
- Add/modify focused unit, component, and e2e tests listed per phase.

## Data Model Decisions

- `Event.paymentsEnabled`: explicit toggle, default `false`.
- `Event.paymentDeadlineAt`: nullable timestamp; payment requests cannot be sent unless set when payments are enabled.
- Event address fields are stored on `Event` and backfilled to Pavilion:
  - `addressName`
  - `addressLine1`
  - `addressLine2`
  - `addressCity`
  - `addressState`
  - `addressPostalCode`
  - `addressCountry`
  - `addressPreset` with `pavilion`, `bluewater`, and `custom`.
- `EventPayment` is one row per fee-bearing registration payment. It stores immutable amount/fee snapshot and current payment state.
- `EventPayment.amountCents` is constrained positive and `currency` is constrained to `usd` in the migration.
- `EventPayment.selectedFeeId` references the fee used to create the line item; `selectedFeeDescription` and `amountCents` snapshot the receipt data.
- `EventPayment.status` values: `pending`, `checkout_created`, `paid`, `past_due`, `handled`, `cancelled`, `refunded`, `disputed`.
- Manual handled rows require `manualHandledNote`, `manualHandledByUserId`, and `manualHandledAt`.
- Stripe ids are nullable and unique where present:
  - `stripeCustomerId`
  - `stripeCheckoutSessionId`
  - `stripePaymentIntentId`
  - `stripeChargeId`
- `stripeReceiptUrl` is stored only when Stripe supplies it.
- `StripeWebhookEvent` stores Stripe event id, event type, created timestamp, processed timestamp, and optional processing error for idempotency.
- `EventPaymentNotification` stores payment id, kind, sent date key, provider email id, and timestamps to dedupe reminders/digests.
  Notification rows are internal; event managers can read/manage them through payment update access, but payment owners cannot read provider email markers through policy clients.

## Phase Plan

### Phase 0: Planning And Decision Lock

Owner: main agent.

- [x] Create feature worktree from `origin/main`.
- [x] Inspect Stripe skill and current Stripe docs through Context7.
- [x] Dispatch read-only exploration subagents for schema/auth, UI/tests, and email/jobs.
- [x] Write this control-plane implementation plan.
- [x] Resolve the fee-change decision above or keep the recommended immutable-fee default.
- [x] Run baseline verification before code workers:

```bash
npm run lint
npm run check:types
npm run test
```

Baseline result: `npm ci` was required because the new worktree had no `node_modules`. `npm run lint` passed. `npm run check:types` passed when run with the existing local `.env` from `/Users/andrewkelley/GitHub/mitsailing/.env`; without that env file, Env validation reports missing local secrets. `npm run test` passed with the same env.

Gate: passed.

### Phase 1: Dependencies, Env, Schema, Migration

Worker ownership:

- `package.json`, lockfile
- `src/libs/Env.ts`
- env examples
- `zenstack/schema.zmodel`
- generated Prisma/ZenStack artifacts
- migration SQL
- schema/policy/env tests

Worker prompt:

```text
You are implementing Phase 1 of docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md in /Users/andrewkelley/GitHub/mitsailing-stripe-event-payments-v1. You are not alone in the codebase; do not revert edits by others. Own only dependency/env/schema/migration/generated artifacts and related tests. Follow AGENTS.md, package-first-simple, tdd, and dates-us-eastern rules. Edit zenstack/schema.zmodel first; do not hand-edit prisma/schema.prisma except through generation. Add stripe and @stripe/stripe-js, Stripe env validation, event payment/address models, webhook idempotency, notification dedupe, and policy tests. Run focused tests and generation commands. Update this plan's Phase 1 checklist with results and changed files.
```

Steps:

- [x] Add failing env validation tests in `src/libs/Env.test.ts` for Stripe keys required in staging/production and optional locally.
- [x] Add Stripe dependencies with the repo package manager, preserving lockfile format.
- [x] Add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` to `Env.ts` and env examples.
- [x] Add ZModel enums and models for event payment status, address preset, payment records, webhook idempotency, and notification dedupe.
- [x] Add event payment/address fields to `Event` with defaults/backfill-compatible nullability.
- [x] Add policy rules:
  - event editors can read/manage event-scoped payment records for their events;
  - users can read their own payment records;
  - only app/admin service paths use raw Prisma for webhook mutation after signature verification;
  - global ledger reads stay behind app permission checks, not public policies.
- [x] Generate Prisma/ZenStack artifacts using the repo's established commands.
- [x] Create migration that backfills existing events to Pavilion and keeps `paymentsEnabled=false`.
- [x] Add policy tests for user read, event editor manage, and global payment access denial.
- [x] Run:

```bash
npm run check:types
npm run test -- src/libs/Env.test.ts src/libs/zenstack/eventPolicies.test.ts
```

Phase 1 changed files:

- `package.json`, `package-lock.json`
- `.env.example`, `.env.staging.example`, `.env.production.example`, `.env.production.worker.example`
- `src/libs/Env.ts`, `src/libs/Env.test.ts`
- `zenstack/schema.zmodel`, `zenstack/schema.ts`, `zenstack/models.ts`, `zenstack/input.ts`
- `prisma/schema.prisma`; `src/generated/prisma/**` was regenerated locally and remains gitignored
- `prisma/migrations/20260520090000_stripe_event_payments_v1/migration.sql`
- `src/libs/zenstack/eventPolicies.test.ts`
- `docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md`

Phase 1 verification:

- `npm run test -- src/libs/Env.test.ts` failed before `Env.ts` changes because Stripe env vars were not validated/exposed, then passed after implementation.
- `npx zen check --schema zenstack/schema.zmodel` passed with the existing generator warning.
- `npx zen generate --schema zenstack/schema.zmodel` passed.
- `npx prisma generate` passed.
- `npx prisma validate` passed.
- `BETTER_AUTH_SECRET=... DATABASE_URL=... NEXT_PUBLIC_APP_URL=... npm run lint` passed.
- `BETTER_AUTH_SECRET=... DATABASE_URL=... NEXT_PUBLIC_APP_URL=... npm run check:types` passed.
- `npm run test -- src/libs/Env.test.ts src/libs/zenstack/eventPolicies.test.ts` passed for Env tests; policy database cases were skipped by the existing `RUN_DATABASE_TESTS=1`/`TEST_DATABASE_URL` guard.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` could not run because this repo's Prisma config has no `datasource.shadowDatabaseUrl`.
- Main review patched missing `bluewater` address preset, added payment amount/currency DB checks to the migration, tightened notification log reads to event managers, and isolated Env tests so legacy-production validation cases do not fail for missing Stripe keys.
- After main review patches: `npx zen generate --schema zenstack/schema.zmodel`, `npx prisma generate`, `npx prisma validate`, `npm run lint`, `npm run check:types`, and `npm run test -- src/libs/Env.test.ts src/libs/zenstack/eventPolicies.test.ts` passed.

Review gate:

- [x] Main agent reviews schema for cascade behavior, uniqueness, status enum naming, generated churn, and direct Prisma schema edits.
- [x] Main agent runs `npm run lint`, `npm run check:types`, and targeted tests before Phase 2.

### Phase 2: Payment Domain And Stripe Server Integration

Worker ownership:

- `src/libs/stripe/**`
- `src/libs/mit-sailing/eventPayments*`
- `src/libs/mit-sailing/eventPaymentCheckout*`
- focused unit tests

Worker prompt:

```text
Implement Phase 2 from docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md. You are not alone in the codebase; do not revert edits by others. Own only Stripe server helpers, payment domain logic, checkout orchestration, and their tests. Use Stripe Checkout Sessions with Embedded Checkout, omit payment_method_types, verify webhook signature helpers against raw body, use integer USD cents, and keep fee selections immutable after payment record creation. Update the plan checklist with changed files and verification.
```

Steps:

- [x] Write failing tests for event payment eligibility:
  - payments disabled returns ineligible;
  - no fee returns ineligible;
  - enabled with no deadline returns ineligible for request send;
  - enabled with fee/deadline returns eligible.
- [x] Implement eligibility helpers in `src/libs/mit-sailing/eventPayments.ts`.
- [x] Write failing tests for status transitions:
  - pending to paid stores Stripe ids and receipt URL;
  - duplicate paid transition does not send a second receipt marker;
  - paid cannot return to pending;
  - manual handled requires internal note and admin id;
  - refunded/disputed are terminal for reminders.
- [x] Implement transition helpers with explicit status guards.
- [x] Write failing tests for reminder/digest eligibility at `7:00 AM America/New_York`.
- [x] Implement reminder/digest eligibility using existing Eastern time helpers.
- [x] Create `src/libs/stripe/stripeClient.ts` with a singleton Stripe client, latest API version supported by installed SDK, and no key logging.
- [x] Create Checkout Session helper with `ui_mode: "embedded"`, `mode: "payment"`, `return_url`, `client_reference_id`, metadata linking payment id/event id/registration id, line item price data from payment snapshot, and request idempotency key.
  - Implementation note: Stripe SDK `22.1.1` / API `2026-04-22.dahlia` types use `ui_mode: "embedded_page"` for Embedded Checkout, so the helper uses the SDK-supported value.
- [x] Write tests that assert `payment_method_types` is not sent.
- [x] Implement checkout access helper that returns a client secret only for the payment owner or event editor.
- [x] Run:

```bash
npm run test -- src/libs/mit-sailing/eventPayments.test.ts src/libs/mit-sailing/eventPaymentCheckout.test.ts
npm run check:types
```

Review gate:

- [x] Main agent reviews Stripe API usage, idempotency keys, status transition invariants, and tests.
- [x] Main agent runs `npm run lint`, `npm run check:types`, and Phase 2 tests.

Phase 2 changed files:

- `src/libs/mit-sailing/eventPayments.ts`
- `src/libs/mit-sailing/eventPayments.test.ts`
- `src/libs/mit-sailing/eventPaymentCheckout.ts`
- `src/libs/mit-sailing/eventPaymentCheckout.test.ts`
- `src/libs/stripe/stripeClient.ts`
- `src/libs/stripe/stripeCheckoutSessions.ts`
- `src/libs/stripe/stripeWebhookEvents.ts`
- `src/libs/stripe/stripeWebhookEvents.test.ts`
- `docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md`

Phase 2 verification:

- `npm run test -- src/libs/mit-sailing/eventPayments.test.ts src/libs/mit-sailing/eventPaymentCheckout.test.ts` failed before implementation because the Phase 2 modules did not exist.
- `npm run test -- src/libs/mit-sailing/eventPayments.test.ts src/libs/mit-sailing/eventPaymentCheckout.test.ts src/libs/stripe/stripeWebhookEvents.test.ts` passed with 25 tests.
- `BETTER_AUTH_SECRET=... DATABASE_URL=... NEXT_PUBLIC_APP_URL=... npm run check:types` passed.
- `BETTER_AUTH_SECRET=... DATABASE_URL=... NEXT_PUBLIC_APP_URL=... npm run lint` passed.
- Main review patched reminder eligibility so user reminders run daily before and after the deadline, while admin digests stay overdue-only. It also blocked stale paid transitions from terminal non-paid statuses.
- After main review patches: `npm run lint`, `npm run check:types`, and `npm run test -- src/libs/mit-sailing/eventPayments.test.ts src/libs/mit-sailing/eventPaymentCheckout.test.ts src/libs/stripe/stripeWebhookEvents.test.ts` passed with 28 tests.

### Phase 3: Registration And Admin Event Operations

Worker ownership:

- `src/libs/mit-sailing/eventRegistrationActions.ts`
- `src/libs/admin/events/eventAdminActions.ts`
- `src/libs/admin/events/eventAdminSchemas.ts`
- `src/libs/admin/events/eventAdminQueries.ts`
- `src/libs/admin/events/eventAdminPaths.ts`
- focused action/query/schema tests

Worker prompt:

```text
Implement Phase 3 from docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md. You are not alone in the codebase; do not revert edits by others. Own only event registration/admin server actions, schemas, query DTOs, and paths. Preserve existing capacity locking. Auto-approved paid registrations create payment records immediately and redirect toward checkout. Approval-required paid registrations create/send payment requests only after approval. Event editors can resend and mark handled with a required note. Update the plan checklist with results.
```

Steps:

- [x] Add schema tests for event payment settings form parsing and manual handled note requirement.
- [x] Add payment settings parser/action that saves `paymentsEnabled`, `paymentDeadlineAt`, and event address fields.
- [x] Extend event editor DTOs to include payment settings and address fields.
- [x] Extend registration action tests for auto-approved paid event creating one payment record inside the existing transaction.
- [x] Update public registration action to create a payment record when auto-approved and payment eligible.
- [x] Update redirect behavior so auto-approved paid registration lands on `/events/[slug]/checkout`.
- [x] Extend admin registration status tests for approval-required paid event creating a payment record and request email marker after approval.
- [x] Update admin approval action to create payment record and enqueue request email when status transitions to approved.
- [x] Add resend one/all unpaid actions with dedupe-safe notification behavior.
- [x] Add manual handled action requiring note and event-editor access.
- [x] Extend admin registration query DTOs with payment status, amount, deadline, receipt URL, manual note/admin, and resend eligibility.
- [x] Run:

```bash
npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts
npm run check:types
```

Review gate:

- [x] Main agent reviews transaction boundaries, capacity checks, payment creation idempotency, redirects, and permission gates.
- [x] Main agent runs `npm run lint`, `npm run check:types`, and Phase 3 tests.

Phase 3 review notes:

- Main review patched approval-request behavior so paid approval creates the immutable payment row but only writes a request notification marker when the event has a payment deadline.
- Main review patched resend actions to require an event payment deadline before marking request notifications.
- Main review added server-side materialization for Pavilion and Bluewater address presets so blank preset forms cannot erase the backfilled address.
- Main review scrubbed Stripe values that a worker had written to the ignored local `.env`.
- After main review patches: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts`, `npm run lint`, and `npm run check:types` passed.

### Phase 4: Checkout, Public Event, Profile, Admin UI

Worker ownership:

- event checkout route/component
- public event payment/address UI
- profile payments route/component
- admin event payment settings UI
- admin registration payment controls
- global admin payments ledger
- component tests and locale strings

Worker prompt:

```text
Implement Phase 4 from docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md. You are not alone in the codebase; do not revert edits by others. Own only UI/routes/locales/component tests for checkout, public/profile/admin payment surfaces. Follow admin-list-usability, ui-color-tokens, next-intl, and React single props rules. Use Stripe Embedded Checkout client APIs from @stripe/stripe-js. No hard-coded user-visible strings. Update the plan checklist with results.
```

Steps:

- [x] Add checkout page route `/events/[slug]/checkout` backed by one canonical checkout component.
- [x] Add Embedded Checkout client component that loads Stripe with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, fetches client secret from a server action/route, mounts checkout, and unmounts on cleanup.
- [x] Add component tests for loading, missing payment, already paid, and mounted checkout states with Stripe.js mocked.
- [x] Replace `StripePlaceholder` in admin event form with payment settings and address preset/custom controls.
- [x] Add address map link rendering on public event pages and receipt-supporting DTOs.
- [x] Add roster payment column/card content, resend buttons, manual handled form, and responsive manual-note dialog/popover.
- [x] Add `/admin/payments` ledger page behind `PAYMENTS_VIEW` with filters, Stripe connection/webhook health, payment rows, and Stripe deep links.
- [x] Add profile payments page with online payment status and Stripe receipt links when available; manual handled rows show status text only.
- [x] Update profile side nav and admin dashboard links.
- [x] Add/extend locale keys in `src/locales/en.json`.
- [x] Run:

```bash
npm run test -- src/components/mit-sailing/admin/events src/components/mit-sailing/events src/components/auth/profile
npm run check:i18n
npm run check:types
```

Review gate:

- [x] Main agent reviews UI for task fit, responsive behavior, text overflow, i18n, accessibility, and admin usability.
- [x] Main agent runs `npm run lint`, `npm run check:i18n`, `npm run check:types`, and Phase 4 tests.

Phase 4 changed files:

- `src/app/[locale]/(marketing)/(site)/events/[slug]/checkout/page.tsx`
- `src/components/mit-sailing/events/EventPaymentCheckout.tsx`
- `src/components/mit-sailing/events/EventPaymentCheckout.test.tsx`
- `src/libs/mit-sailing/eventPaymentCheckoutActions.ts`
- `src/libs/mit-sailing/eventPaymentCheckoutQueries.ts`
- `src/libs/mit-sailing/eventQueries.ts`
- `src/components/mit-sailing/events/EventDetailView.tsx`
- `src/components/mit-sailing/events/EventRegistrationCta.tsx`
- `src/components/mit-sailing/events/EventRegistrationCta.test.tsx`
- `src/components/mit-sailing/admin/events/AdminEventFormView.tsx`
- `src/components/mit-sailing/admin/events/AdminEventRegistrationsView.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/payments/page.tsx`
- `src/components/mit-sailing/admin/payments/AdminPaymentsLedgerView.tsx`
- `src/libs/admin/payments/adminPaymentQueries.ts`
- `src/app/[locale]/(auth)/profile/payments/page.tsx`
- `src/components/auth/profile/ProfilePaymentsView.tsx`
- `src/components/auth/profile/ProfileSideNav.tsx`
- `src/components/auth/profile/ProfileSideNav.test.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/page.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/adminIndexPage.test.tsx`
- `src/libs/admin/adminNavigation.ts`
- `src/locales/en.json`

Phase 4 verification:

- `npm run test -- src/components/mit-sailing/admin/events src/components/mit-sailing/events src/components/auth/profile` passed. The existing profile side-nav component-test harness still logs a React warning because the mocked link forwards `prefetch={false}` to an `<a>`.
- `npm run check:i18n` passed.
- `npm run check:types` passed.
- `npm run lint` passed.
- Rendered browser screenshots were not run for this phase; review was code/component-test based because these routes depend on authenticated DB state and Stripe checkout setup.

### Phase 5: Webhooks, Emails, Reminders, Admin Digest

Worker ownership:

- Stripe webhook route and tests
- payment email templates/wrappers
- BullMQ jobs and worker dispatch
- reminder/digest scheduler logic
- email category/logging updates

Worker prompt:

```text
Implement Phase 5 from docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md. You are not alone in the codebase; do not revert edits by others. Own only webhooks, email templates/wrappers, notification dedupe, BullMQ jobs, worker dispatch, and tests. Verify raw-body Stripe signature handling, idempotent Stripe event storage, receipt email only after local transition to paid, and daily reminder/admin digest dedupe. Update the plan checklist with results.
```

Steps:

- [ ] Add webhook route tests for missing signature, invalid signature, duplicate event id, checkout completion, payment intent success, charge receipt URL capture, refund, and dispute.
- [ ] Implement `POST /api/stripe/webhooks` using raw request text/arrayBuffer and Stripe `constructEvent`.
- [ ] Store webhook event id before processing, skip duplicates, and persist processing errors.
- [ ] Apply local status transitions for:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `charge.succeeded` or charge payload receipt URL capture
  - refund events
  - dispute events
- [ ] Add React Email templates for payment request, receipt, reminder, and admin digest.
- [ ] Add email wrapper functions using `sendTransactionalEmail`.
- [ ] Add worker job payload schemas and dispatch cases.
- [ ] Add request/receipt/reminder/digest notification dedupe using `EventPaymentNotification`.
- [ ] Add daily reminder scheduler at 7:00 AM US Eastern that skips paid, handled, refunded, disputed, cancelled, and event-date-past rows.
- [ ] Add admin overdue digest scheduler at 7:00 AM US Eastern with one email per event.
- [ ] Run:

```bash
npm run test -- src/app/api/stripe/webhooks/route.test.ts src/libs/email src/worker
npm run check:types
```

Review gate:

- [ ] Main agent reviews raw-body handling, no unverified webhook processing, dedupe, receipt send point, scheduler timing, and email copy.
- [ ] Main agent runs `npm run lint`, `npm run check:types`, and Phase 5 tests.

### Phase 6: E2E And Final Hardening

Worker ownership:

- e2e tests and helpers only unless fixing defects found by e2e
- final bugfixes assigned as small follow-up packets

Worker prompt:

```text
Implement Phase 6 from docs/superpowers/plans/2026-05-20-stripe-event-payments-v1.md. You are not alone in the codebase; do not revert edits by others. Own e2e coverage and small defect fixes discovered by those e2e tests. Use existing Postgres helper patterns and real login forms. Mock Stripe only at the app boundary needed for deterministic tests; do not bypass registration/login flows under test. Update this plan with changed files, failures, and verification.
```

Steps:

- [ ] Add e2e coverage: admin enables payments with deadline/address.
- [ ] Add e2e coverage: auto-approved paid registration lands on embedded checkout page.
- [ ] Add e2e coverage: approval-required registration creates payment request after approval.
- [ ] Add e2e coverage: admin can resend payment request, view overdue state, and mark handled by MIT Sailing.
- [ ] Add e2e coverage: profile shows payment status and receipt/manual handled behavior.
- [ ] Run full verification:

```bash
npm run lint
npm run check:types
npm run check:deps
npm run check:i18n
npm run test
npm run test:e2e
```

Final review gate:

- [ ] Main agent performs thorough code review of the full branch, focusing on bugs, payment/security risks, transaction boundaries, webhook idempotency, stale generated artifacts, and missing tests.
- [ ] Main agent resolves review findings through small worker packets or direct scoped fixes.
- [ ] Main agent reruns all final verification commands.
- [ ] Main agent records final verification results in this plan.

## Review Checklist

Run this after every phase and at the end:

- [ ] No direct `process.env` reads outside `Env.ts`.
- [ ] No `payment_method_types` in Stripe web checkout calls.
- [ ] No secret values in logs, tests, fixtures, or examples.
- [ ] Webhooks reject missing/invalid signatures before DB mutation.
- [ ] Webhook event ids are unique and duplicate-safe.
- [ ] Payment amount and fee description are snapshotted before Stripe session creation.
- [ ] Registration capacity checks remain under event row lock.
- [ ] Receipt email sends only after local transition to `paid`.
- [ ] Reminder/digest dedupe prevents duplicate daily sends.
- [ ] Manual handled requires internal note and admin id.
- [ ] Event editor permissions work for assigned admins, dock staff, dock masters, and admins.
- [ ] Global ledger stays behind `PAYMENTS_VIEW`.
- [ ] All visible strings are in `src/locales/en.json`.
- [ ] Public/profile/admin UI has responsive controls and no text overlap.
- [ ] Generated Prisma/ZenStack files are current.

## Verification Log

Record command results here as phases complete.

- `2026-05-20 Phase 0`: worktree created from `origin/main`; exploration complete; plan written.
- `2026-05-20 Baseline`: `npm ci` completed; `npm run lint` passed; `npm run check:types` passed with local env sourced; `npm run test` passed with 213 files passed, 2 skipped, 1606 tests passed, 13 skipped.
- `2026-05-20 Phase 1`: worker completed dependencies/env/schema/migration/generated artifacts. Main review fixed Bluewater preset, DB checks, notification policy scope, and Env test isolation. Phase gate passed.
- `2026-05-20 Phase 2`: worker completed Stripe client/session/webhook helpers and event payment domain logic. Main review fixed reminder timing and stale terminal-status paid transitions. Phase gate passed.
- `2026-05-20 Phase 3`: completed registration/admin payment operations in `src/libs/mit-sailing/eventRegistrationActions.ts`, `src/libs/admin/events/eventAdminActions.ts`, `src/libs/admin/events/eventAdminSchemas.ts`, `src/libs/admin/events/eventAdminQueries.ts`, and focused tests. Request email work is represented by dedupe-safe `EventPaymentNotificationKind.request` markers until Phase 5 email jobs/templates. Main review fixed deadline-gated request markers, preset address materialization, and scrubbed local ignored Stripe env values. Verification passed: `npm run test -- src/libs/admin/events/eventAdminSchemas.test.ts src/libs/admin/events/eventAdminActions.test.ts src/libs/admin/events/eventAdminQueries.test.ts src/libs/mit-sailing/eventRegistrationActions.test.ts`, `npm run lint`, and `npm run check:types`.
