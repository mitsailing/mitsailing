# Racing Membership Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert paid racing memberships into a July 15 annual subscription flow while keeping normal membership free for anyone with MIT Recreation membership, including MIT students as the automatic membership case, and giving admins maintainable pricing, search, and payment issue tools.

**Architecture:** Keep the existing sailing-card request and event-payment systems intact. Add a small membership-billing domain beside them: eligibility helpers decide whether a user can request paid racing, a pricing catalog stores editable effective-dated prices, Stripe Checkout and webhooks sync subscription/payment state, and admin pages read from local records instead of querying Stripe at page render time. Each PR must stay below the 100-file hard cap; target under 80 changed files by splitting pricing/admin setup from checkout/webhook/cancellation work and reusing existing Stripe, admin, email, and sailing-card patterns.

**Tech Stack:** Next.js App Router, Server Actions, Prisma/ZenStack, Stripe Checkout/Billing, next-intl, Vitest, Playwright.

**Stripe/package-first guard:** Do not build a subscription engine from scratch. Use the official `stripe` SDK plus Stripe Checkout, Billing, Prices, Subscriptions, invoices, automatic payment retry/dunning, and Customer Portal wherever they cover the lifecycle. MIT Sailing code should only hold local eligibility, consent snapshots, audit/payment records, admin issue state, and idempotent webhook side effects needed for this app. Before adding custom billing tables, schedulers, renewal logic, retry loops, or wrapper services, document why Stripe Billing/Checkout/Portal or an existing local helper cannot do it. Do not add a third-party Stripe subscription abstraction unless it is actively maintained, broadly adopted, and reduces code in this repo without hiding July 15 renewal, MIT eligibility, legacy payment, admin override, or audit requirements.

---

## Execution Reconciliation Notes

- Start from latest `origin/main`. PR #143's runbook work is already merged and its branch may be deleted; do not depend on that branch. PR #145 (`feat: add sailing card payment onboarding foundation`) is also merged and changed the app implementation. Before coding, reconcile this plan against current `main` and skip work already landed in PR #145.
- Current `main` already includes `SailingCardRequest.hasFitnessMembership` as the canonical MIT Recreation self-report and `SailingCardOnboardingInput.hasFitnessMembership` as `boolean | null`. Steps below that previously named `mitRecreationMembershipSelfReported` should use the existing `hasFitnessMembership` field instead of adding a duplicate column.
- Current `main` already includes one `Payment` model for event and membership payments with `purpose`, `source`, Stripe IDs, legacy fields, and admin-override fields. Steps below that mention separate membership payment/refund tables must be reconciled through the structural simplicity gate before implementation; do not copy older schema snippets unchanged. Stripe subscription lifecycle state is different: PR 4A must add one focused `SailingCardSubscription` table because Stripe's subscription docs recommend storing subscription identity/status locally for access decisions.
- Current `main` already includes paid-card-without-payment bypass evidence on `SailingCardRequest` plus an `admin_override` membership `Payment`. Preserve that narrow override shape; do not create a generic notes, waiver, or payment-exception framework.
- Current admin card issuance is person-centered through `/admin/users` and `/admin/users/[id]`. Do not recreate a standalone `/admin/cards` route or card queue page.
- Linear/GitHub mirrors already exist for this feature. Do not create a fresh batch of child issues from the issue plan unless the user approves new or missing tracker items after duplicate checks.
- PR file budget is a hard constraint: 100 changed files max. Every slice should split at 70 changed files and should not be submitted above 80 unless the user explicitly approves the file-list rationale.

## Autonomous Execution And Parallel Work

The execution goal is to finish the remaining plan without routine user involvement. A conductor agent should keep moving through the remaining PRs, create focused branches/worktrees, dispatch bounded sub-agents, run local review gates, push draft PRs, fix review/CI findings, and continue to the next unblocked slice. Ask the user only for a true product decision, missing secret/external access, protected production action, merge/squash action that policy blocks, or an impossible conflict between requirements.

Use one conductor ledger for the overall feature and one run ledger per PR branch. Read only compact prior artifacts from `local/agent-runs/**`: `conductor.md`, `personas.md`, decision tables, summaries, and verification results. Do not load huge transcripts, raw logs, full agent outputs, or copied command dumps unless a specific blocker requires them.

Parallelize discovery and review freely; parallelize implementation only when branches do not depend on each other and do not touch the same files. Use separate git worktrees or separate Codex threads per implementation branch. The conductor owns merge order and rebases any stacked/follow-on branch after its base PR lands.

Safe parallel work:

- Read-only reconciliation against current `main`, persona checks, `impeccable`, Context7 Stripe/Next.js audits, and structural simplicity reviews for any upcoming PR.
- PR 3 webhook dispatcher hardening can be prepared in parallel with PR 2A/2B because it should not depend on pricing schema.
- Test-plan drafting and risk review for PR 4A/4B/5/6 can run while earlier implementation PRs are in review, but code should wait for the schema/API it depends on.

Sequential or stacked work:

- PR 2B depends on PR 2A pricing schema/helpers.
- PR 4A depends on the reconciled pricing/Stripe Price foundation from PR 2A/2B.
- PR 4B depends on PR 3 and PR 4A.
- PR 5 depends on the local payment/subscription states created by PR 4A/4B.
- PR 6 depends on subscription, cancellation, and renewal price state from PR 4A/4B and pricing from PR 2A/2B.

Within each PR, use sub-agents for independent work units: implementation, spec compliance review, code-quality/bug review, `impeccable` product/admin workflow review, structural simplicity review, and focused CI/review-comment fixes. Do not let two implementation agents edit the same files concurrently.

### Autonomous Conductor Starter Prompt

Use this prompt for the fresh conductor agent that will finish the plan:

```text
You are the autonomous conductor for the MIT Sailing racing membership subscription implementation in /Users/andrewkelley/GitHub/mitsailing.

Goal: finish the remaining racing membership subscription plan with minimal user involvement. Keep moving PR-by-PR until the plan is complete or you hit a real blocker.

Start state:
- Start from latest origin/main.
- The docs/runbook work from PR #143 is already merged; its branch may be deleted and must not be used as a dependency.
- PR #145 (`feat: add sailing card payment onboarding foundation`) and PR #147 (`fix: reduce sailing card control complexity`) are already merged and changed current main.
- If this prompt was copied before the docs branch containing this section was merged, first bring the latest docs/runbook changes into your implementation branch or stop and report that the required plan/runbook update is missing.

First actions:
1. `git fetch origin main`
2. Create a new branch or worktree from latest `origin/main` for the first still-incomplete slice.
3. Read `AGENTS.md`.
4. Read this plan: `docs/superpowers/plans/2026-05-28-racing-membership-subscriptions.md`.
5. Read `docs/ai/pr-agent-orchestration.md`, `docs/ai/persona-matrix-template.md`, and `docs/ai/pr-run-ledger-template.md`.
6. Read only compact prior artifacts from `local/agent-runs/**` if useful: `conductor.md`, `personas.md`, decision tables, summaries, and verification results. Do not load huge transcripts, raw logs, full agent outputs, or command dumps unless a specific blocker requires them.
7. Reconcile this plan against current `main`. Mark already-completed PR #145/#147 work in the ledger and choose the first still-incomplete smallest slice.

Operating model:
- Use `superpowers:subagent-driven-development` for the active implementation PR.
- Use `superpowers:dispatching-parallel-agents` for independent discovery/review tasks.
- Use `impeccable` for product/admin/onboarding/copy flows.
- Use `grill-me` style checks before committing to a slice: ask whether the persona is a real user/admin and whether the website path is simple.
- Use Context7 for current library/platform docs when touching Stripe, Next.js, Prisma/ZenStack, GitHub CLI, or other evolving tools.

Persona requirement:
For each feature slice, create the persona once, then check it twice before relying on it:
1. Would this real person naturally start here on the website with this goal?
2. Is the website path obvious and minimal: find the thing, understand state, take action, recover from blockers?
3. Did the persona lead to complexity that does not make the user/admin path simpler?

Autonomous relay:
1. Implement one PR to local merge-readiness.
2. Run required local review gates: persona, impeccable when applicable, structural simplicity, independent bug review, focused tests, lint/types/i18n as required.
3. Commit, push, and create a draft PR with `gh pr create --draft`.
4. Watch/check CI with `gh pr checks`.
5. Fix local review, CI, and actionable PR findings.
6. If policy and permissions allow, enable auto-merge or merge after checks. If merge is blocked by policy, record the blocker and continue the next unblocked branch/worktree.
7. Start the next unblocked PR without waiting for routine user approval.

Parallelization:
- Parallelize read-only reconciliation, persona checks, Context7 audits, impeccable review, structural simplicity review, and independent bug review.
- Parallelize implementation only in separate worktrees/branches when the slices do not depend on each other and do not edit the same files.
- PR 3 can be prepared in parallel with PR 2A/2B.
- PR 4A waits for PR 2A/2B. PR 4B waits for PR 3 and PR 4A. PR 5 waits for PR 4A/4B. PR 6 waits for PR 2A/2B and PR 4A/4B.

Ask the user only for:
- true product judgment,
- missing credentials or external access,
- protected production actions,
- merge/squash actions blocked by repository policy,
- or a real conflict between requirements that cannot be resolved from repo context.

Hard constraints:
- Do not redo PR #145/#147 work.
- Do not add `mitRecreationMembershipSelfReported`; use existing `SailingCardRequest.hasFitnessMembership`.
- Do not recreate `/admin/cards` or a standalone card queue.
- Keep admin card work person-centered through `/admin/users` and `/admin/users/[id]`.
- Do not create parallel membership payment/refund tables unless current tests and Context7 Stripe docs prove the existing `Payment` model cannot represent the lifecycle.
- Do create one focused `SailingCardSubscription` table in PR 4A for local subscription status, customer/subscription/product IDs, period dates, cancellation flags, subscription item ID, and stale-event tracking.
- Avoid AI slop: no extra tables, pages, components, services, permissions, states, or workflows unless they directly simplify a real user/admin path or prove a lifecycle/permission/audit/retention/cardinality/transaction/operational/platform boundary.

Final report for each PR:
- branch and PR URL,
- slice completed,
- files changed,
- persona checks,
- structural simplicity decision,
- verification commands/results,
- remote checks/review state,
- next unblocked slice started or blocker requiring user input.
```

## Sources And Current Code Facts

**MIT Sailing code facts**
- `src/libs/mit-sailing/sailingCardValidity.ts` already treats July 15 in US Eastern as the sailing-card rollover date.
- `src/worker/sailingCardAnnualClearingJob.ts` already runs annual card clearing at midnight on July 15.
- `src/libs/mit-sailing/sailingCardMembership.ts` currently hard-codes spring/full racing prices and has no central free-normal eligibility guard.
- `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx` renders normal, racing, and team-racing card choices after the fitness question.
- `src/libs/mit-sailing/sailingCardOnboardingActions.ts` parses `hasFitnessMembership` in form values and `src/libs/mit-sailing/sailingCardOnboarding.ts` includes it in `SailingCardOnboardingInput` as `boolean | null`; central paid-racing eligibility enforcement and staff-visible verification handoff still need review.
- Event payments already provide reusable Stripe patterns in `src/libs/stripe/*`, `src/libs/mit-sailing/eventPaymentCheckout.ts`, `src/libs/mit-sailing/eventPayments.ts`, `src/app/api/stripe/webhooks/route.ts`, and `src/components/mit-sailing/admin/payments/AdminPaymentsLedgerView.tsx`.

**External patterns to adopt**
- Stripe Checkout subscription mode uses pre-created recurring Prices, supports one-time setup fee Prices in subscription Checkout, and syncs subscription changes through webhooks.
- Stripe subscription access state must be stored locally. The official build-subscriptions docs say webhook handlers should verify subscription status, check the subscribed product, and store `product.id`, `subscription.id`, `subscription.status`, and `customer.id` in the app database. For MIT Sailing, this means a focused `SailingCardSubscription` table is required in PR 4A; Stripe remains the billing source of truth, but app pages/admin/card issuance read local subscription state instead of querying Stripe at render time.
- Stripe Customer Portal is the simplest payment-method and invoice self-service surface; MIT Sailing should use an in-app cancellation form first so cancellation reason and local status are recorded before redirecting users to Stripe for payment-method updates.
- Next.js Server Actions should validate form input before mutation, call `revalidatePath` before `redirect`, and use Route Handlers for webhook raw-body processing.
- Cal.com separates payment concerns into customer lookup, Checkout creation, billing portal redirect, subscription lookup, and local payment records. It also validates safe return URLs for billing portal redirects and keeps Stripe-specific lookups in narrow modules such as `customer`, `subscriptions`, and `BillingPortalService`. Mirror that shape in smaller MIT Sailing modules instead of one large billing service.
- FTC-style negative-option best practices for subscriptions: clear material terms before payment, proof of consent, and cancellation that is at least as easy to find and complete as signup. Treat this as product trust guidance, not legal advice.
- Robinhood-style referral waitlists work by exposing rank and referral movement, but MIT Sailing already has scarcity. Do not add referral boosts in these PRs; preserve fairness and avoid growing demand.

### Stripe Subscription Checklist

Verified against Stripe official docs: [build subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [mixed one-time and recurring Checkout line items](https://docs.stripe.com/payments/checkout/migrating-prices), and [manage Prices](https://docs.stripe.com/products-prices/manage-prices).

- [x] Use Stripe Billing and Checkout Sessions for recurring paid racing/team-racing memberships; do not build manual renewal loops with raw PaymentIntents.
- [x] Use Stripe Products and Prices, not legacy Plans; local price rows map to immutable Stripe Price IDs and old Prices are archived with `active=false`.
- [x] Keep PR 2A limited to the pricing catalog; do not add subscription state before Checkout creates subscriptions.
- [ ] In PR 4A, add a focused `SailingCardSubscription` table that stores local subscription access state: app user, card type, Stripe customer ID, Stripe subscription ID, Stripe product ID, current renewal Price/local price IDs, subscription item ID, status, current period start/end, trial end, cancel-at-period-end/cancel/canceled/ended timestamps, canonical/duplicate state, and last processed subscription event timestamp/ID.
- [ ] Keep payment/invoice/charge/refund/dispute facts in `Payment` rows with `purpose: membership`; do not create separate membership payment/refund/invoice tables unless a test proves `Payment` cannot represent the lifecycle cleanly.
- [ ] Create Checkout in `mode: 'subscription'` with pre-created Price IDs. Spring checkout may include one recurring annual Price plus one one-time current-season Price only after Stripe test mode proves the initial invoice does not include the annual amount before July 15.
- [ ] Store metadata on both the Checkout Session and `subscription_data.metadata` so webhooks can link invoices/subscriptions back to local user, payment, initial price, and renewal price records even when events arrive out of order.
- [ ] Use webhook signature verification and existing `StripeWebhookEvent` idempotency for all membership billing events.
- [ ] Handle `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` by updating `SailingCardSubscription`; local access decisions must read this table.
- [ ] Handle `invoice.paid` and `invoice.payment_failed` by updating/creating membership `Payment` rows and profile/admin issue state.
- [ ] Before each July 15 renewal email is persisted or sent, move active auto-renew subscription items to the currently effective full annual Price, verify the applied renewal amount, then snapshot/email that applied amount. Use the stored Stripe subscription item ID and same-interval annual Price with `proration_behavior: 'none'` or an equivalent subscription schedule phase proven in Stripe test mode, so the next invoice uses the new amount without an immediate charge. If Stripe update or verification fails, block the reminder for that subscription and surface the issue to admins instead of emailing an amount that will not be charged.
- [ ] Preserve free-normal eligibility before paid checkout: MIT students, verified MIT Recreation members, and pending free-normal verification users must not enter paid Checkout.
- [ ] Use Stripe Customer Portal for payment-method and invoice recovery, but keep auto-renew cancellation in-app first so local cancellation state and optional feedback are recorded.

## Product Decisions Locked For Implementation

- **Legacy account-flow parity:** this is a Next.js migration of the old `sailing.mit.edu/new_account.php` flow, with known improvements. Preserve the old MIT Affiliation dropdown values and order. Preserve the Normal, Racing, and Team Racing request choices, but drop Virtual because it no longer exists. Preserve required phone, emergency contact name, emergency contact phone, and swim-agreement approval before any card request is considered complete.
- **Season year:** paid racing subscriptions renew on July 15 in US Eastern, matching existing sailing-card expiration and clearing.
- **Spring charge:** before July 15, Checkout charges the current season spring amount once, starts the annual subscription on a trial that ends at the next July 15 full-season renewal, and does not bill the annual Price before that date.
- **Full-season charge:** on or after July 15, Checkout charges the current season full amount once, starts the annual subscription on a trial that ends at the next July 15 renewal, and keeps every renewal anchored to July 15.
- **Free normal membership:** users with MIT Recreation membership receive normal membership without paid racing or team-racing checkout. MIT students are the automatic MIT Recreation membership case; verified non-student membership uses `User.gymMembershipVerifiedAt`. MIT sailing-team members are MIT students and use the same automatic MIT Recreation membership path; do not add a separate sailing-team membership field. Team racing is a paid plan, not a team-membership status.
- **MIT Recreation self-report:** onboarding can ask whether a user has MIT Recreation membership, but only staff verification sets `User.gymMembershipVerifiedAt`. Self-report hides paid options in the form, submits a normal sailing-card request for staff review, and makes the verification handoff visible to both the user and staff. Staff must not issue the free normal card for this path until `gymMembershipVerifiedAt` is set.
- **Paid racing eligibility:** paid `racing` and `team_racing` are only available to users who do not already qualify for free normal membership and who choose that paid card type intentionally.
- **Paid racing issuance:** staff can issue paid `racing` or `team_racing` Sailing Cards only after the local membership payment/subscription state is paid or active. V1 must include an explicit admin override path to issue a paid card without payment when staff intentionally waive or bypass payment; the override requires an internal note and is surfaced on the admin user record.
- **Simplest override shape:** do not build a generic notes system or payment-waiver framework for V1. Store the paid-card-without-payment override on the current `SailingCardRequest` approval/issuance path with a required note, approver, and timestamp, then show that state on `/admin/users/[id]` and any embedded pending-request/card controls.
- **Override permission:** use the existing card-number assignment permission for the V1 paid-card-without-payment override. Do not add a separate permission in V1; the required note and audit fields distinguish the override.
- **Admin user blockers:** the admin user page needs one visible current-blockers alert area for card-issuance blockers, including payment issues, MIT Recreation verification, intro-class prerequisites, and other current blockers. The top blocker area is status/navigation only, with links or focus targets to the owning section; remediation controls stay in the Sailing Card/payment sections. Refunded, disputed, failed, or past-due current-season paid racing payments block paid racing/team-racing access and pavilion card issuance until the payment is paid/active again or staff records an explicit handled/override note. A V1 paid-card-without-payment override clears the payment blocker for that card issuance while preserving the fact that payment was bypassed.
- **Payment issue notes:** handled/override notes for payment issues belong on the specific membership payment issue record, not as generic user notes. The admin user page surfaces the current/latest relevant issue summary from those records.
- **Legacy paid memberships:** V1 must bring over membership payments already made through the legacy system. These are separate from Stripe and must not be represented as Stripe charges, Checkout sessions, invoices, receipt URLs, or portal-managed subscriptions. Imported legacy payments should be visible on the admin user record and the member dashboard/status, should satisfy paid racing/team-racing access for the covered card year/season when matched to the user, and should show as a normal paid state labeled "paid through legacy system" without offering a Stripe receipt.
- **Legacy payment matching:** confidently matched legacy paid memberships can attach automatically. Unmatched or ambiguous legacy payments go to an admin review list/report and do not grant access until staff resolves them.
- **Legacy payment storage:** store legacy paid memberships in the same membership payment/access model as Stripe payments with a source/method discriminator such as `legacy`. Stripe-specific fields stay nullable and empty for legacy records.
- **Legacy-to-Stripe transition:** a legacy payment covers the imported/current season only and must not create a Stripe subscription or charge the member again for that covered season. Legacy-paid members should see a non-blocking dashboard/status prompt to add payment information and set up Stripe auto-renew for the next July 15 renewal. This prompt is optional and must not block current-season card issuance when the legacy payment is a confident match.
- **Pavilion card issuance:** Sailing Card numbers are assigned manually by staff at the pavilion after the user shows MIT ID or another legal ID. If the user is taking one of the three intro classes, staff assigns the card at the end of class at the pavilion. If onboarding is complete but the intro-class prerequisite is not complete, the request remains pending with copy telling the user to take the required class and that card issuance happens during/after class at the pavilion.
- **Profile pending state:** after a user submits onboarding, their profile must show the current-year Sailing Card request as pending until staff issues the card number. Legacy `sailing.mit.edu` shows "Requested," "Not yet assigned," and "Pending"; the Next.js profile can use clearer copy, but must preserve the status visibility.
- **Manual card numbers:** preserve the existing card-number rule. Auto-suggested/blank issuance starts at 60 so lower numbers are not auto-assigned, but admins with card assignment permission can manually enter any positive card number as long as it is not already assigned for that card year.
- **Admin pending search:** staff start from the person, not a queue. Preserve `/admin/users` and `/admin/users/[id]` as the primary Pavilion-staff path for finding a sailor, reviewing blockers, and issuing cards. Keep one user search across name, email, MIT ID, and card number. Add the simplest pending/card-type filters on `/admin/users` so staff can view pending normal, racing, or team racing requests, then open the user profile to resolve blockers and issue cards. Keep filtering bounded to the users surface; do not add a standalone card queue route or generic search framework.
- **Cancellation:** users can turn off auto-renew in one in-app flow without a required survey step. The server sets Stripe `cancel_at_period_end=true`; optional feedback can record a reason enum and note after or alongside the primary action.
- **Subscription consent:** paid Racing and Team Racing selection, required Sailing Card details, emergency contact fields, and swim-agreement approval stay in the signup/onboarding flow. Only after those required fields are complete does onboarding show the amount due today, the July 15 renewal amount, annual auto-renew behavior, and where to turn off auto-renew before sending the user to Stripe Checkout. The submit button says that the user is starting paid racing membership, not just continuing. Profile membership pages are for managing an existing paid membership after signup.
- **Admin pricing:** admins edit app pricing records with effective dates and change reasons. Stripe Prices are immutable, so each usable price row stores the Stripe Price ID created for that amount/interval. Checkout never uses a price row until Stripe sync succeeds. Price changes are not grandfathered for active auto-renew subscriptions: before the next July 15 renewal, the renewal job must move active subscription items to the currently effective full annual Stripe Price, verify the applied renewal amount, and only then persist/send the renewal email snapshot. Members should be charged the new annual amount on the renewal date, not an old subscription-item Price.
- **Admin operations:** admins can search members by name/email/card/payment/subscription status and Stripe identifiers, filter failed/past-due/cancelled records, open Stripe Dashboard links, and mark a local issue handled with an internal note without erasing the original issue status.
- **No racing/team reset surprise:** reminders go out before July 15 and explain the charge date, amount, renewal status, cancellation link, and any price increase that will be charged on the July 15 renewal date.

## Membership Policy Matrix

| User group | Normal membership cost | Paid racing/team-racing purchase path | Staff verification | Notes |
|---|---:|---|---|---|
| MIT students | $0 | Hidden and server-rejected | MIT affiliation from account/warehouse | Membership dues are covered; staff still controls ratings and team/racing requirements separately. |
| Verified MIT Recreation members | $0 | Hidden and server-rejected | `User.gymMembershipVerifiedAt` | User-facing copy says MIT Recreation membership, not gym membership. |
| Self-reported MIT Recreation members | $0 pending review | Hidden and server-rejected during onboarding | Staff verifies before issuing card | Request records `SailingCardRequest.hasFitnessMembership=true` as the MIT Recreation self-report. |
| Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, and other students | Normal membership requires MIT Recreation unless another verified free-normal rule applies; paid racing/team-racing uses the legacy non-MIT student paid price category | Visible when no free-normal rule applies | None for paid purchase | These are affiliation dropdown choices, not free-normal eligibility. Tests cover each student paid-price affiliation, both paid card types, before and after July 15. |
| MIT faculty/staff/alum/family/affiliate, other non-students, and non-MIT | Normal membership requires MIT Recreation unless another verified free-normal rule applies; paid racing/team-racing uses age-band pricing | Visible when no free-normal rule applies | None for paid purchase | Tests cover both paid card types, both age bands, before and after July 15. |

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
- Avoid agent slop: do not add tables, admin pages, components, services, permissions, states, or workflows when an existing surface plus a field, filter, or narrow helper fits the current slice. Split only when this PR proves a distinct lifecycle, permission, audit, retention, cardinality, transaction, operational, or external-platform boundary.
- Current code already uses one `Payment` model with `purpose` and `source` for event, membership, Stripe, legacy, and admin-override records. Preserve that unified payment-record direction for payments, invoices, refunds, disputes, legacy payments, and admin overrides. Stripe's subscription docs do justify a separate focused local subscription-state model, so PR 4A must introduce `SailingCardSubscription` for canonical subscription access state instead of overloading `Payment.stripeSubscriptionId`.

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
- Modify: `src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx`

#### Task 1.1: Preserve existing MIT Recreation self-report schema

- [ ] **Step 0: Confirm file budget**

Confirm the exact PR 1 file list before editing. Re-run the file-count check after the schema-generation handoff and before review. Split the admin verification control into a follow-up PR if PR 1 reaches 70 changed files.

- [ ] **Step 1: Write the schema expectation**

Add to `src/libs/mit-sailing/sailingCardRequestSchema.test.ts`:

```ts
it('preserves MIT Recreation self-report on sailing card requests', () => {
  expect(compactSchema).toContain('hasFitnessMembership Boolean?');
  expect(compactSchema).toContain('@map("has_fitness_membership")');
});
```

- [ ] **Step 2: Run the schema test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts`

Expected: PASS.

- [ ] **Step 3: Do not add sailing-team schema**

Do not add a second MIT Recreation self-report column. `SailingCardRequest.hasFitnessMembership Boolean? @map("has_fitness_membership")` already stores the pending verification state from onboarding; admin/user copy should read that field. Do not add `User.sailingTeamMembershipVerifiedAt`; MIT sailing-team members are MIT students and use the MIT student Normal path, while team racing is a paid plan.

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
  };

  it('grants free normal membership to MIT students', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      })
    ).toEqual({ kind: 'free_normal', reason: 'automatic_mit_recreation_membership' });
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
      membershipAccessForOnboardingRequest({
        ...baseUser,
        hasFitnessMembership: true,
      })
    ).toEqual({ kind: 'pending_recreation_verification' });
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
        access: { kind: 'free_normal', reason: 'automatic_mit_recreation_membership' },
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
  | { readonly kind: 'free_normal'; readonly reason: 'automatic_mit_recreation_membership' | 'verified_mit_recreation_membership' }
  | { readonly kind: 'pending_recreation_verification' }
  | { readonly kind: 'paid_racing_available' };

type SailingCardMembershipUser = {
  readonly gymMembershipVerifiedAt: Date | null;
  readonly sailingAffiliation: SailingAffiliation | null;
};

type SailingCardMembershipOnboardingRequest = SailingCardMembershipUser & {
  readonly hasFitnessMembership: boolean | null;
};

export function membershipAccessForSailingCardUser(
  user: SailingCardMembershipUser
): SailingCardMembershipAccess {
  if (user.sailingAffiliation === SailingAffiliation.MIT_STUDENT) {
    return { kind: 'free_normal', reason: 'automatic_mit_recreation_membership' };
  }
  if (user.gymMembershipVerifiedAt !== null) {
    return { kind: 'free_normal', reason: 'verified_mit_recreation_membership' };
  }
  return { kind: 'paid_racing_available' };
}

export function membershipAccessForOnboardingRequest(
  request: SailingCardMembershipOnboardingRequest
): SailingCardMembershipAccess {
  const verifiedAccess = membershipAccessForSailingCardUser(request);
  if (verifiedAccess.kind !== 'paid_racing_available') {
    return verifiedAccess;
  }
  if (request.hasFitnessMembership === true) {
    return { kind: 'pending_recreation_verification' };
  }
  return verifiedAccess;
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

Add `membershipAccessForOnboardingRequest` in the same module. It accepts the verified user facts plus the existing `hasFitnessMembership` self-report value and returns a pending-review access reason when the user reports MIT Recreation membership during onboarding. Server Actions and UI use this helper so self-report and verified eligibility cannot drift.

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

Add table-driven pricing policy tests for every `SailingAffiliation` other than `MIT_STUDENT`, covering `racing` and `team_racing` before and after July 15. Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, and other students keep the legacy non-MIT student paid racing price category. MIT faculty/staff/alum/family/affiliate, other non-students, and non-MIT use age-band paid racing pricing. Verified free-normal rules apply outside this pricing helper.

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardMembership.test.ts`

Expected: FAIL where paid pricing and free-normal eligibility are still coupled.

- [ ] **Step 3: Simplify student pricing**

In `src/libs/mit-sailing/sailingCardMembership.ts`, keep `MIT_STUDENT` as the only free-by-affiliation rule, but preserve the old-site non-MIT student paid racing price category for Wellesley, Brandeis, Northeastern, Winsor, Brooks, NROTC, and other students. Leave spring/full hard-coded prices in place until PR 2 replaces the source of truth with the pricing catalog.

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

```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/libs/mit-sailing/sailingCardOnboarding.test.ts`

Expected: FAIL because current code records `hasFitnessMembership`, but paid racing restrictions for MIT students and MIT Recreation-covered users are not yet centrally rejected.

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

In the Server Action, load the current user's `sailingAffiliation` and `gymMembershipVerifiedAt`, then call `membershipAccessForOnboardingRequest({ verified user facts, hasFitnessMembership: parsed.hasFitnessMembership })` and `canRequestPaidRacingMembership`. Do not duplicate the central eligibility logic in the Server Action. Persist the self-reported MIT Recreation answer on the existing `SailingCardRequest.hasFitnessMembership` field so staff can see that verification is required before issuing the card. Add an action-level test that a crafted form with `hasFitnessMembership=yes` and `cardType=racing` is rejected even when the UI is bypassed.

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
- Verified `gymMembershipVerifiedAt` users see only normal membership, because the UI receives and uses the same central eligibility state as the Server Action instead of relying only on affiliation and form state.
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

- Normal membership is free for anyone with MIT Recreation membership. MIT students qualify automatically; other users need verified MIT Recreation membership.
- Paid racing membership is only for sailors who need racing access and do not already qualify for free normal membership.
- Normal membership covers dues; racing access, team racing, and ratings may still require staff approval.
- Sign in to see the current racing membership price and renewal details. Do not link to `/profile/membership` in public copy until that route exists.

Add CMS validation or locale tests that the seeded public pricing copy includes "verified MIT Recreation" wording so the page does not imply self-report is approval.

- [ ] **Step 2: Run i18n and CMS tests**

Run: `npm run check:i18n`

Run focused CMS validation tests: `npm run test -- src/libs/mit-sailing/cmsValidation.test.ts`

Expected: PASS.

#### Task 1.7: Add staff visibility for verification-dependent free membership

- [ ] **Step 1: Write admin/review tests**

Add focused tests for the existing sailing-card request admin or member profile surface:

- Self-reported MIT Recreation membership appears as "MIT Recreation verification needed".
- Onboarding completion and dashboard/profile status show "MIT Recreation verification needed", "No payment needed now", and "Staff will verify before issuing your card" for self-reported MIT Recreation members.
- A verified MIT Recreation member no longer sees paid racing/team-racing purchase paths.

- [ ] **Step 2: Add the smallest admin control**

Reuse the existing member/request review surface. Display the MIT Recreation self-report state for staff. Preserve the pavilion workflow through `/admin/users` and `/admin/users/[id]`: staff must be able to use one user search, apply a pending/card-type filter when useful, open the user profile, and resolve blockers before issuing a card number. Keep pending visibility inside the users surface with bounded filtering over loaded rows. Do not introduce a separate team-management system, standalone card queue route, or generic search framework in this PR.

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'`

Run: `npm run check:i18n`.

Expected: PASS.

- [ ] **Step 4: Run PR 1 verification**

Run:

```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/sailingCardRequestSchema.test.ts src/libs/mit-sailing/sailingCardMembership.test.ts src/libs/mit-sailing/sailingCardMembershipEligibility.test.ts src/libs/mit-sailing/sailingCardOnboarding.test.ts src/libs/mit-sailing/sailingCardOnboardingActions.test.ts src/libs/mit-sailing/cmsValidation.test.ts src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/admin/cards/AdminSailingCardControls.test.tsx src/libs/admin/users/adminUserActions.test.ts 'src/app/[locale]/(marketing)/(site)/admin/users/adminUserPages.test.tsx'
npm run check:i18n
```

Expected: all commands pass.

### PR 2A/2B: Billing Foundation, Pricing Catalog, And Stripe Price Sync

**Goal:** Add the local billing schema foundation, then let admins maintain effective-dated membership prices in the app and sync immutable Stripe Prices without starting paid subscriptions yet.

**Readiness reconciliation:** The schema snippets below were written before the current unified `Payment` model landed. Treat the price catalog as the default PR 2 schema work; defer subscription, cancellation, notification, and checkout-specific `Payment` fields until the PR that first needs them. Do not add separate `SailingCardMembershipPayment` or `SailingCardMembershipRefund` tables unless the structural simplicity review, current Stripe docs via Context7, and failing tests prove that `Payment` plus `purpose`, `source`, `status`, Stripe IDs, and narrow extension fields cannot represent the current PR's payment/refund/invoice needs. Do add one focused `SailingCardSubscription` table in PR 4A because Stripe's subscription lifecycle docs call for local subscription identity/status storage for app access decisions. If any additional split is justified, record the lifecycle boundary in `local/agent-runs/<branch-slug>/conductor.md` before editing schema.

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
- Free-normal eligibility and paid-pricing category are separate: `MIT_STUDENT` is free by affiliation, Wellesley/Brandeis/Northeastern/Winsor/Brooks/NROTC/other students use legacy non-MIT student paid racing prices when paid cards are allowed, and other paid affiliations use age-band pricing.
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

- [ ] **Step 0: Reconcile schema shape against current `Payment`**

Before writing schema tests, inspect `zenstack/schema.zmodel`, current payment queries, legacy membership import, admin user payment history, and Stripe Billing docs via Context7. Fill the structural simplicity decision table in the conductor ledger. Default schema direction:

- Add only the pricing catalog models/enums needed for effective-dated admin-maintained prices in PR 2A.
- Defer subscription-state, cancellation, and notification schema until PR 4A/4B or the reminder PR first needs that state.
- Extend or reuse the existing `Payment` model for membership payment, legacy, Stripe, invoice, receipt, refund/dispute, and admin-override records unless tests prove a separate model is simpler.
- Do not duplicate `PaymentSource`, `PaymentStatus`, legacy source fields, Stripe payment IDs, receipt URL, or manual handled note fields in a parallel membership-payment table without a documented boundary.

- [ ] **Step 1: Write schema tests**

Add a focused schema test for the reconciled schema. If the structural simplicity decision keeps membership payments in `Payment`, update the expectations below to assert the reused `Payment` fields and only the new pricing fields that this PR actually adds. Do not blindly copy older expectations for separate membership payment/refund tables.

```ts
expect(compactSchema).toContain('model SailingCardMembershipPrice');
expect(compactSchema).toContain('enum SailingCardMembershipPriceKind');
expect(compactSchema).toContain('enum SailingCardMembershipPriceCategory');
expect(compactSchema).toContain('enum SailingCardMembershipBillingInterval');
expect(compactSchema).toContain('model Payment');
expect(compactSchema).toContain('purpose PaymentPurpose');
expect(compactSchema).toContain('membership');
expect(compactSchema).toContain('effectiveAt DateTime @map("effective_at")');
```

- [ ] **Step 2: Add schema models**

Add enums:

```prisma
enum SailingCardMembershipPriceKind {
  spring
  full
}

enum SailingCardMembershipPriceCategory {
  student
  under_30
  thirty_or_over
}

enum SailingCardMembershipBillingInterval {
  one_time
  annual
}
```

Add models for only the reconciled shape. Keep payment/refund rows in the existing
`Payment` model by default; add focused `Payment` extension fields in the checkout
or webhook PR that first needs them, not in this pricing PR.

```prisma
model SailingCardMembershipPrice {
  id String @id() @default(cuid())
  cardType SailingCardType @map("card_type")
  priceKind SailingCardMembershipPriceKind @map("price_kind")
  priceCategory SailingCardMembershipPriceCategory @map("price_category")
  billingInterval SailingCardMembershipBillingInterval @map("billing_interval")
  amountCents Int @map("amount_cents")
  currency String @default("usd")
  active Boolean @default(true)
  effectiveAt DateTime @map("effective_at")
  changeReason String @map("change_reason") @db.Text()
  stripePriceId String? @unique() @map("stripe_price_id")
  stripeSyncError String? @map("stripe_sync_error") @db.Text()
  stripeSyncedAt DateTime? @map("stripe_synced_at")
  createdByUserId String? @map("created_by_user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt() @map("updated_at")
  createdBy User? @relation("SailingCardMembershipPriceCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@unique([cardType, priceKind, priceCategory, billingInterval, effectiveAt])
  @@index([createdByUserId])
  @@map("sailing_card_membership_prices")
}
```

- [ ] **Step 3: Run schema tests and type generation**

Add inverse relation fields only for the new pricing relation(s), then run the maintainer-approved ZenStack generation step and the focused schema test. Include generated `prisma/schema.prisma` and any changed tracked `zenstack/**` artifacts in the PR file budget.

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
- Non-MIT student affiliations use the `student` price category and do not fall through to age pricing.
- Inactive prices are ignored.
- Future `effectiveAt` prices are ignored until their effective date.
- Future price changes keep the current checkout price active until `effectiveAt`.
- Price changes create a new immutable row. Following Stripe Price practice, checkout keeps using the previous synced active row until the replacement row has `stripePriceId`, no `stripeSyncError`, and `stripeSyncedAt`; then the old row can be archived by setting `active=false`.
- Duplicate effective dates for the same card type, price kind, price category, and billing interval fail validation before checkout selection can become ambiguous.
- `spring + annual` price rows fail validation; only `spring + one_time`, `full + one_time`, and `full + annual` are valid catalog combinations.
- Existing payments keep their initial and renewal price IDs, amount, and currency snapshot after later price changes.
- Invalid amounts below Stripe minimum return field error.
- Blank price-change reasons fail validation.

- [ ] **Step 2: Implement pricing helpers**

Create `membershipPricing.ts` with:

```ts
export function membershipPriceCategoryForCardRequest(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly dateOfBirth: string;
  readonly now: Date;
}): SailingCardMembershipPriceCategory | null;

export async function getActiveMembershipPrice(options: {
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly now: Date;
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly requireStripeReady?: boolean;
}): Promise<SailingCardMembershipPrice | null>;

export async function getCheckoutMembershipPrices(options: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly dateOfBirth: string;
  readonly now: Date;
  readonly requireStripeReady?: boolean;
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
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly effectiveAt: Date;
}): Promise<SailingCardMembershipPrice>;
```

Use the existing sailing-card date-only parser before category math; do not construct age categories from arbitrary JavaScript `Date` values. Do not call Stripe from read helpers. Keep historical rows for audit and reminders; never mutate amount/currency on a row that may already be referenced by a payment or subscription.

- [ ] **Step 3: Add admin pricing UI**

Create a compact admin page that lists active prices by card type, price kind, and price category. The edit form uses native number inputs, preserves dollars-to-cents conversion server-side, and shows the Stripe Price sync state.

The default admin page shows current active prices and sync state first. Retired/history rows and "subscriptions still using an older full-season Stripe Price" diagnostics live behind a history/details disclosure with a link to the filtered membership payments page. Pricing forms use dollar-prefix inputs, server-rendered cents preview, effective-date preview, a "will replace current price on {date}" summary, and disabled save until amount, effective date, and reason are valid. If a new row has not synced to Stripe, show that checkout will not use it until Stripe sync succeeds and that the previous synced price remains the checkout price.

- [ ] **Step 4: Add admin pricing action tests**

Create `src/libs/mit-sailing/membershipBilling/membershipPricingActions.test.ts` covering:

- non-admin users cannot replace prices
- dollars are converted to integer cents server-side
- `changeReason` is required
- `effectiveAt` must be a valid future-or-current date in US Eastern
- the previous matching row is archived only after the replacement Stripe Price is ready
- duplicate effective dates for the same price key are rejected
- `createdByUserId` is stored
- synced rows cannot have amount, currency, billing interval, card type, price kind, price category, effective date, or change reason edited in place
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
- When a locally active row with a synced `stripePriceId` is archived by setting `active=false`, the sync helper updates the matching Stripe Price to `active=false` instead of deleting or replacing it.

- [ ] **Step 2: Implement sync helper**

Create a helper that accepts a Stripe client dependency and creates immutable Prices with metadata:

```ts
metadata: {
  domain: 'sailing_card_membership',
  appPriceId: price.id,
  cardType: price.cardType,
  priceKind: price.priceKind,
  priceCategory: price.priceCategory,
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

**Goal:** Let eligible users choose paid racing or team racing during onboarding, review subscription terms after required Sailing Card details and swim-agreement approval, then start Stripe Checkout from that onboarding flow. Profile membership pages manage existing paid memberships, payment methods, invoices, and recovery states after signup. Membership webhooks and cancellation move to PR 4B so review stays small.

**Estimated changed files:** 28-42.

**Files:**
- Modify: `zenstack/schema.zmodel`
- Generated: `prisma/schema.prisma`
- Add: one migration directory for the checkout/subscription-state fields
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
- Modify: `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx`
- Modify: `src/components/mit-sailing/onboarding/SailingCardOnboardingCardRequestFields.tsx`
- Modify: `src/libs/mit-sailing/sailingCardOnboardingActions.ts`
- Modify: `src/libs/Env.ts`
- Modify: `src/app/[locale]/(auth)/layout.tsx`
- Modify: `src/app/[locale]/(auth)/profile/layout.tsx`
- Modify: `src/data/mit-sailing/cmsSeed.ts`
- Modify: `src/locales/en.json`

#### Task 4A.0: Confirm file budget

- [ ] **Step 1: Confirm exact file paths**

Before editing, confirm the listed route, action, component, navigation, and test files still match the current code. If navigation requires touching more than the two listed layout files, split navigation into the PR 4B follow-up instead of expanding PR 4A.

#### Task 4A.1: Implement subscription state helpers

- [ ] **Step 0: Add only checkout-needed subscription/payment schema**

Start PR 4A with a focused schema test for one local `SailingCardSubscription` model. This follows Stripe's build-subscriptions guidance to store subscription identity/status locally for access decisions and avoids overloading `Payment.stripeSubscriptionId`, which cannot represent one subscription producing many invoices/payments over time. Extend the existing `Payment` model only for checkout/session/consent/price snapshot fields and for linking membership payment rows to `SailingCardSubscription`; do not create parallel local tables for Stripe invoices, refunds, or events unless a test proves the app needs them. Defer cancellation reason fields to PR 4B and renewal-notification rows to the reminder PR unless this PR's tests need them.

Minimum PR 4A subscription schema checklist:

- [ ] `SailingCardSubscription` stores `userId`, `cardType`, Stripe customer ID, unique Stripe subscription ID, Stripe product ID, current renewal Stripe Price ID, local renewal price ID, Stripe subscription item ID, status, current period start/end, trial end, cancel-at-period-end, cancel/canceled/ended timestamps, canonical/duplicate state, created/updated timestamps, and last processed Stripe subscription event timestamp/ID.
- [ ] `SailingCardSubscription` relates to `User` and to membership `Payment` rows; `Payment` rows may keep invoice/charge/payment intent facts but must not be the canonical subscription-status record.
- [ ] `Payment.stripeSubscriptionId` uniqueness is removed or no longer used for multi-invoice membership payments once payments link to `SailingCardSubscription`; one Stripe subscription must be able to produce many local renewal payment rows.
- [ ] The schema still has no `SailingCardMembershipPayment`, `SailingCardMembershipRefund`, or Stripe invoice/event mirror tables.
- [ ] Local access/profile/admin state reads `SailingCardSubscription.status` plus current-season membership `Payment` status; it does not query Stripe during page render.

- [ ] **Step 1: Write subscription-state tests**

Create `src/libs/mit-sailing/membershipBilling/membershipSubscriptions.test.ts` covering active, trialing, incomplete, past-due, cancel-at-period-end, canceled, and duplicate-completion profile states. Include canonical active subscription selection, duplicate Stripe subscription completion recorded on the local subscription/payment issue state, and the "paid renewal may be unnecessary" state when free-normal eligibility appears on a user with an active paid subscription.

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
- Users with pending current-year or latest `SailingCardRequest.hasFitnessMembership=true` status cannot create Checkout; profile copy shows "MIT Recreation verification needed" until staff verifies or clears the request.
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

Use the existing `getStripeClient`, `Env.NEXT_PUBLIC_APP_URL`, and event-payment idempotency style. Split Checkout tests into three bites: date/price selection, pending payment/session idempotency, and Stripe Checkout request construction. Create or reuse a pending local membership payment row plus pending local subscription record in one transaction before calling Stripe. Use the existing `Payment` model with `purpose: membership`; use a separate membership-payment table only if a new failing test proves `Payment` cannot represent invoice/payment/charge rows. Store the accepted initial and renewal price IDs, amount due today, currency, card type, price kind, payment kind, `activeCheckoutKey`, `stripeCheckoutSessionUrl`, and `stripeCheckoutSessionExpiresAt` locally, then use the local payment ID as the Stripe idempotency-key source and metadata value. Store metadata on both the Checkout Session and `subscription_data.metadata`. Store `stripeSubscriptionItemId` on `SailingCardSubscription` during webhook completion so future price changes can update active auto-renew subscriptions before renewal with `proration_behavior: 'none'`.

Before calling `getCheckoutMembershipPrices`, Checkout must call the existing sailing-card membership eligibility helper and return no paid Checkout path for MIT students, verified MIT Recreation members, or pending free-normal verification users. Pricing helpers choose the paid price category only after free-normal eligibility has already been ruled out.

The implementation must prove in Stripe test mode that spring Checkout does not create a prorated recurring charge before July 15. If Checkout Session parameters cannot express that safely, switch this task to a two-step flow: one-time Checkout for spring/full access plus a server-created subscription anchored to July 15 after successful payment. Do not ship a path where the initial invoice can include both spring and annual charges.

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/libs/mit-sailing/membershipBilling/membershipStripeCheckout.test.ts`

Expected: PASS.

#### Task 4A.3: Add onboarding checkout and profile membership management

- [ ] **Step 1: Add route and action tests**

Add tests that assert:

- Eligible users who chose `racing` or `team_racing` in onboarding see the paid racing checkout call to action in onboarding after phone, emergency contact, date of birth, and swim agreement are complete.
- July 14 Eastern, July 15 00:00 Eastern, and after-July-15 onboarding component tests show the correct amount due today, next renewal date, and next renewal amount before redirecting to Stripe.
- Before Checkout, onboarding consent copy includes: "Today: {springAmount}", "Renews automatically on July 15, 2026 for {fullAmount}", "Then renews every July 15 until auto-renew is off", and "Turn off auto-renew from Profile > Membership before the renewal date."
- On and after July 15, consent copy includes: "Today: {fullAmount}" and the next July 15 renewal amount/date.
- The onboarding primary button says "Continue to Stripe and start paid racing membership" or the team racing equivalent for the selected card type.
- Eligible users can choose `racing` or `team_racing` when both paid options are available.
- Free-normal users see current eligibility in onboarding and no paid Checkout button.
- Submitted Checkout action redirects to Stripe URL.
- The saved consent acceptance snapshot exactly matches the terms block shown before the member leaves for Stripe, including amount, renewal date, auto-renew text, cancellation path, selected card type, and submit button text.
- Onboarding does not redirect eligible first-time paid users to `/profile/membership` as a separate initial purchase page. The checkout starts from the onboarding card choice after required details are complete.
- The profile/dashboard links to `/profile/membership` only for managing an existing paid membership, recovering a pending checkout/payment issue, or viewing active/canceled/past-due state.
- No user-facing onboarding or profile surface displays stale one-time racing prices from `sailingCardMembershipPriceCents` after this PR. Onboarding paid-card state shows the Checkout-backed amount due today and renewal amount before the Stripe redirect.
- Public/home copy updates after the membership route exists: authenticated users can go to onboarding when they need a new Sailing Card request and to profile membership when they already have a paid membership to manage.
- The profile membership page has clear states for free-normal, active, cancel-at-period-end, past-due, and canceled users; the first-purchase eligible-unpaid state belongs in onboarding.
- If free-normal eligibility appears on a user with an active paid subscription, the page flags that paid renewal may be unnecessary. PR 4B adds the one-step turn-off-auto-renew flow.
- Past-due/unpaid profile states show failed payment status, amount due if known, payment-method portal action, and whether racing access is still active or blocked.
- Public home pricing copy is updated after this route exists to send new requests through onboarding and existing paid members to `/profile/membership`.

State hierarchy for the profile page:

| State | Top status | Primary action |
|---|---|---|
| `free_normal` | "Normal membership is covered." | None unless another profile task is pending. |
| `pending_checkout` | "Checkout is not complete." | Resume checkout or start over from onboarding. |
| `active_paid` | "Paid racing membership is active through {date}." | Update payment method or invoice action; cancellation arrives in PR 4B. |
| `free_normal_active_paid` | "Paid renewal may be unnecessary." | PR 4B turn-off-auto-renew action. |
| `past_due` | "Payment needs attention." | Update payment method. |
| `canceled` | "Auto-renew is off." | Restart paid racing membership only when eligible. |

- [ ] **Step 2: Create page/action/component**

Use:

- `src/app/[locale]/(auth)/profile/membership/page.tsx`
- `src/app/[locale]/(marketing)/(site)/onboarding/page.tsx`
- `src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.ts`
- `src/components/mit-sailing/onboarding/SailingCardOnboardingForm.tsx`
- `src/components/mit-sailing/profile/ProfileMembershipBillingView.tsx`

Keep copy short:

- amount due today
- next renewal date
- next renewal amount
- auto-renew disclosure
- cancellation link location
- access-through date
- renewal status for active subscribers; the `Turn off auto-renew` action is added in PR 4B

Use a radio group or segmented control for paid card type selection in onboarding. The terms shown beside the onboarding Checkout button must update when the selected card type changes.

`ProfileMembershipBillingView` layout rule: top status summary, one primary management/recovery action, one compact renewal/access summary for active or pending paid memberships, then secondary payment-method and invoice actions. If profile state has no active, pending, or failed paid membership, do not show a paid card selector or first-purchase Checkout button. Add tests for fieldset/legend or equivalent group labels, visible labels, `aria-describedby` for help/errors, disabled/loading submit state, and keyboard order through card type, reason, note, and submit where those controls are actually rendered. Add mobile-width render assertions for single-column stacking, no unintended horizontal scrolling, and no broken button wrapping.

Use `useActionState` only where the component needs inline server validation errors.

- [ ] **Step 3: Add billing portal action**

Create `membershipBillingPortalActions.ts` with one Server Action that creates a Stripe Billing Portal session for the stored customer ID and returns to `/profile/membership`. Use a dedicated membership portal configuration ID from `Env` that disables subscription cancellation and plan changes, while allowing payment-method and invoice recovery. Keep auto-renew cancellation in the MIT Sailing page so the cancellation reason is recorded locally. Add tests that the portal session passes the configuration ID, does not pass `flow_data` for subscription cancel/update, and uses a fixed safe return path. Add a small admin diagnostic or health-check helper that retrieves the configured portal settings in Stripe test mode and flags cancellation/plan-change drift.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx 'src/app/[locale]/(auth)/profile/membership/profileMembershipPage.test.tsx' src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.test.ts src/libs/mit-sailing/membershipBilling/membershipBillingPortalActions.test.ts`

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
- reminders include amount, charge date, cancel link, and price-change disclosure when the currently effective renewal Price is higher than the subscriber's previously stored renewal amount
- reminder cancel links go directly to `/profile/membership?focus=auto-renew`, and the membership page reveals or focuses the turn-off-auto-renew form for that URL
- before reminders are sent, active auto-renew subscriptions are moved to the currently effective `full + annual` Stripe Price when that Price is Stripe-ready; reminder snapshots then use the applied new amount, not the old accepted renewal price
- active paid subscribers who now qualify for free normal membership do not receive generic renewal reminders; before renewal, the job sets `cancel_at_period_end=true` / `autoRenew=false` or otherwise blocks the paid renewal unless the member gives fresh explicit consent to paid racing renewal
- special free-normal renewal copy explains that paid renewal was turned off or blocked because normal membership is now covered, with a link to restart paid racing only if they intentionally need it
- duplicate reminders for the same subscription/window are skipped
- active auto-renew subscriptions are moved to the currently effective full annual Stripe Price before reminders with `proration_behavior: 'none'`, and a failed Stripe update blocks the reminder for that subscription instead of emailing an amount that will not be charged
- renewal price updates select the currently effective `full + annual` price by the member's age on the upcoming July 15 Eastern date, including a subscriber who moves from `under_30` to `thirty_or_over`
- renewal price updates only swap to a Stripe-ready annual Price for the same card type, currency, and tax behavior; tests assert no invoice or proration is created, the July 15 anchor/current period end remains unchanged, and the next Stripe invoice preview or test-clock renewal uses the new annual amount instead of the old subscription-item Price.

- [ ] **Step 2: Add or reuse the notification model**

If a notification model was not introduced earlier, add the smallest reminder-log model in this PR. It should store one row per subscription/window with recipient, amount/date/link snapshot, provider ID, sent timestamp, and delivery error. Do not add generic notification infrastructure.

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

These completed review batches are plan-hardening evidence only. They do not count as review of a future implementation branch. Each PR still needs fresh independent bug review, Impeccable/persona review, and structural simplicity review against the actual diff.

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
