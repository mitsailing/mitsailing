# Newsletter Implementation Context

Last updated: 2026-05-12.

## Goal

Build enterprise-capable newsletter support without turning the site into a CRM:

- multiple newsletter lists
- admin broadcasts to selected lists
- draft, preview, schedule, and send-live workflow
- per-recipient delivery tracking
- user preference management
- one-click unsubscribe and visible manage links
- bounce/suppression visibility for admins and users
- compliance basics for Google/Yahoo bulk sender rules, CAN-SPAM, and California/privacy review

Cal.com was used as a product/architecture reference, especially for typed email rendering, durable scheduled work, retry/cancel semantics, and clean send boundaries. No Cal.com code was imported.

## Completed In This Pass

### Email templates

- `emails/email-layout.tsx`
  - Transactional layout now brands as MIT Sailing instead of placeholder app/Auth.js copy.
  - Added `MarketingEmailLayout` with visible unsubscribe, manage preferences, and postal address footer.
  - Removed React Email `Head` usage because this repo lint flags duplicate head usage.
- `emails/newsletter-broadcast.tsx`
  - Now composes through `MarketingEmailLayout`.
- `emails/email-templates.test.tsx`
  - Added marketing layout and newsletter compliance footer assertions.

### Broadcast scheduling and delivery

Implemented by subagent Worker 1:

- `prisma/schema.prisma`
  - Added `NewsletterBroadcast.scheduledAt`, `startedAt`, `pausedAt`, `cancelledAt`.
  - Added `[status, scheduledAt]` index.
- `prisma/migrations/20260512120000_newsletter_broadcast_scheduling/migration.sql`
  - Adds lifecycle columns/index.
- `src/libs/newsletter/newsletterBroadcasts.ts`
  - Materializes deliveries on queue/schedule.
  - Enqueues after successful transaction.
  - Batches sends.
  - Rechecks final eligibility before send: global unsubscribe, subscriber suppression, list subscription state.
  - Handles pause/cancel state and continuation jobs.
  - Retries failed deliveries up to 3 attempts.
- `src/libs/newsletter/newsletterQueue.ts`
  - Accepts `scheduledAt`.
  - Uses BullMQ delay and deterministic job ids.
- `src/worker/index.ts`
  - Uses `Env.REDIS_URL` instead of direct `process.env`.

### Admin scheduling form

- `src/libs/newsletter/newsletterValidation.ts`
  - Parses optional `scheduledAt`.
- `src/libs/newsletter/newsletterAdminActions.ts`
  - Removed duplicate enqueue call. Core creation function now handles enqueue.
- `src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx`
  - Added `datetime-local` schedule field.
- `src/locales/en.json`
  - Added schedule labels and validation message.
- `src/libs/newsletter/newsletterValidation.test.ts`
  - Updated expected success payload with `scheduledAt: null`.

### Account email bounce visibility

- `prisma/schema.prisma`
  - Added `User.emailBouncedAt`, `emailSuppressedAt`, `emailSuppressionReason`.
- `prisma/migrations/20260512121000_user_email_deliverability/migration.sql`
  - Adds deliverability columns/indexes.
- `src/libs/email/accountEmailWebhooks.ts`
  - Handles Resend `email.bounced`, `email.complained`, `email.suppressed`.
  - Updates matching `User` by normalized recipient email.
  - Does not store full webhook payload.
- `src/app/api/resend/webhooks/route.ts`
  - Calls newsletter webhook handler and account email handler.
- `src/libs/admin/catalog/types.ts`
  - Extended `AdminUserRow` with deliverability fields/status.
- `src/libs/admin/users/usersAdminHandlers.ts`
  - Selects/maps deliverability status.
  - Clears stale deliverability fields when admin changes a user's email.
- `src/libs/admin/users/userAdminDefinitions.ts`
  - Adds `Email status` list column.
- `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
  - Shows email status and warning block.
- `src/app/[locale]/(auth)/profile/account/page.tsx`
  - Loads deliverability state.
- `src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx`
  - Shows non-blocking user banner when email is bouncing/suppressed.
- Tests updated:
  - `src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx`
  - `src/app/[locale]/(auth)/authRouteShells.test.tsx`

## Checks Run

- `npx prisma generate` passed after schema changes.
- Targeted tests initially had one expected-object failure because `scheduledAt: null` was new; expectation was updated.
- Last targeted test command to rerun:

```sh
npm run test -- emails/email-templates.test.tsx 'src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx' src/libs/newsletter/newsletterValidation.test.ts
```

## Current Changed Files

- `emails/email-layout.tsx`
- `emails/email-templates.test.tsx`
- `emails/newsletter-broadcast.tsx`
- `prisma/schema.prisma`
- `prisma/migrations/20260512120000_newsletter_broadcast_scheduling/migration.sql`
- `prisma/migrations/20260512121000_user_email_deliverability/migration.sql`
- `src/app/[locale]/(auth)/authRouteShells.test.tsx`
- `src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx`
- `src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx`
- `src/app/[locale]/(auth)/profile/account/page.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/newsletter-broadcasts/new/page.tsx`
- `src/app/[locale]/(marketing)/(site)/admin/users/[id]/page.tsx`
- `src/app/api/resend/webhooks/route.ts`
- `src/libs/admin/catalog/types.ts`
- `src/libs/admin/users/userAdminDefinitions.ts`
- `src/libs/admin/users/usersAdminHandlers.ts`
- `src/libs/email/accountEmailWebhooks.ts`
- `src/libs/newsletter/newsletterAdminActions.ts`
- `src/libs/newsletter/newsletterBroadcasts.ts`
- `src/libs/newsletter/newsletterQueue.ts`
- `src/libs/newsletter/newsletterValidation.test.ts`
- `src/libs/newsletter/newsletterValidation.ts`
- `src/locales/en.json`
- `src/worker/index.ts`

## Important Remaining Work

Keep next steps small and sequential:

1. Rerun targeted tests listed above.
2. Run `npm run check:types`.
3. Run `npm run lint`.
4. Add preview/test-send/admin broadcast detail pages only after the current core compiles cleanly.
5. Add focused webhook tests for `accountEmailWebhooks.ts`.
6. Add send confirmation/recipient-count UI before live send.
7. Run `npm run check:i18n`, `npm run check:deps`, and `npm run build-local`.
8. Run `npm run test:e2e` only after the unit/type/lint gate is clean.

## Product/Compliance Decisions To Preserve

- Newsletter broadcasts are marketing email.
- Transactional account emails remain outside newsletter preferences.
- One-click unsubscribe may unsubscribe from the specific list; the manage page must allow all-list preferences/global unsubscribe.
- Do not auto-subscribe account users without explicit consent unless legal review approves that policy.
- Admins should see email deliverability status, reason, and date only; avoid storing full provider payloads.
- Users are not forced to change bouncing emails; they see a non-blocking account-page notice.
- Avoid CRM scope: no journeys, lead scoring, A/B testing, click/open analytics dashboards, or drag-and-drop email builder.
