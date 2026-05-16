# Pavilion reservation background email design

## Context

Pavilion reservation submission creates a durable reservation record, then sends a public receipt email. A review finding asked to stop awaiting the email send in the creation flow and use Next.js `after()` instead.

As of May 2026, Next.js documents `after()` as a way to schedule non-blocking post-response work. BullMQ documents durable background jobs with retry attempts, exponential backoff, and `jobId`-based duplicate prevention. The best fit for this app is to use `after()` only to enqueue a BullMQ job, while the worker owns email delivery.

## Goals

- Return the reservation confirmation without waiting for email delivery.
- Preserve durable email retry behavior through BullMQ.
- Keep the submission receipt payload unchanged:
  - `eventName`
  - `referenceCode`
  - `requesterEmail`
  - `scheduleLines` from `scheduleLinesForEmail({ itemById, slots })`
- Log enqueue or delivery failures with safe error fields and `referenceCode`.
- Keep the change minimal and aligned with existing worker patterns.

## Non-goals

- Replace BullMQ with direct email sending from the Server Action.
- Change email copy, templates, recipients, or schedule formatting.
- Add broad queue infrastructure, monitoring, or worker concurrency changes.
- Refactor unrelated Pavilion reservation logic.

## Design

`submitPavilionReservationRequestAction` persists the reservation inside the existing transaction. After successful persistence, it schedules a Next.js `after(async () => { ... })` callback.

Inside that callback, the action enqueues `PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME` through `enqueuePavilionReservationSubmittedEmail(getDefaultQueue(), payload)`. The callback catches enqueue failures and logs them with `logger.error`, `safeErrorCode`, `safeErrorName`, and `referenceCode`.

`processPavilionReservationSubmittedEmailJob` parses job data, calls `sendPavilionReservationSubmittedEmail`, logs delivery failures with the same safe error fields, and rethrows so BullMQ can retry according to the job options.

The job options keep the durable-background-job behavior:

- `attempts: 5`
- exponential `backoff`
- bounded completed and failed job retention
- stable `jobId` based on `referenceCode` to prevent duplicate receipt jobs for the same reservation

## Finding triage

If current code already uses `after()` to enqueue the BullMQ job and tests prove the action returns before enqueue completion, the original finding is stale and no source change is required.

If validation finds the action still awaits direct email delivery or blocks on enqueue completion, update only the submission receipt path to match this design.

## Validation

Run focused tests first:

- `npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts`
- `npm run test -- src/worker/pavilionReservationSubmittedEmailJob.test.ts`

Then run the repo gates required for this scoped change:

- `npm run lint`
- `npm run check:types`

Report any stale remote-analysis caveat if a PR analyzer has not re-run after local validation.
