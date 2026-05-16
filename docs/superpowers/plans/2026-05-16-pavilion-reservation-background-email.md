# Pavilion Reservation Background Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden Pavilion reservation submitted-email delivery so reservation confirmation does not wait for email work while BullMQ owns durable delivery and retry.

**Architecture:** Keep the Server Action persistence flow intact. Use Next.js `after()` only to enqueue a BullMQ job after successful persistence; keep actual email delivery, retry, backoff, idempotent `jobId`, and delivery failure logging in the worker. Add the missing regression coverage for enqueue failure logging inside the `after()` callback, then change source only if the test exposes a still-valid issue.

**Tech Stack:** Next.js Server Actions, `next/server` `after()`, BullMQ, TypeScript, Vitest.

---

## File Structure

- `src/libs/mit-sailing/pavilionReservationActions.ts`: Server Action that persists a Pavilion reservation and schedules submitted-email job enqueueing with `after()`.
- `src/libs/mit-sailing/pavilionReservationActions.test.ts`: Unit tests for reservation submission, including non-blocking background email enqueue behavior and enqueue failure logging.
- `src/worker/pavilionReservationSubmittedEmailJob.ts`: BullMQ job enqueue and processing helpers for submitted-email delivery.
- `src/worker/pavilionReservationSubmittedEmailJob.test.ts`: Unit tests for BullMQ job options and worker failure logging/retry behavior.

### Task 1: Add enqueue-failure regression coverage

**Files:**
- Modify: `src/libs/mit-sailing/pavilionReservationActions.test.ts`
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`

- [ ] **Step 1: Add a logger mock to the action test hoist**

Update the `vi.hoisted` destructuring near the top of `src/libs/mit-sailing/pavilionReservationActions.test.ts` so it includes `loggerError`:

```ts
const {
  after,
  afterCallbacks,
  findFirstReservation,
  findUniqueReservation,
  defaultQueue,
  enqueuePavilionReservationSubmittedEmail,
  getDefaultQueue,
  listVisiblePavilionReservableItems,
  loggerError,
  revalidatePath,
  requestCreate,
  transaction,
  txExecuteRaw,
} = vi.hoisted(() => ({
  after: vi.fn((scheduledWork: () => Promise<void> | void) => {
    afterCallbacks.push(scheduledWork);
  }),
  afterCallbacks: [] as (() => Promise<void> | void)[],
  findFirstReservation: vi.fn(),
  findUniqueReservation: vi.fn(),
  defaultQueue: { add: vi.fn() },
  enqueuePavilionReservationSubmittedEmail: vi.fn(),
  getDefaultQueue: vi.fn(),
  listVisiblePavilionReservableItems: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  requestCreate: vi.fn(),
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
}));
```

- [ ] **Step 2: Mock the shared logger in the action test**

Add this mock after the existing `next/server` mock in `src/libs/mit-sailing/pavilionReservationActions.test.ts`:

```ts
vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerError,
  },
}));
```

- [ ] **Step 3: Reset the logger mock in `beforeEach`**

Add this line to the existing `beforeEach` reset block:

```ts
  loggerError.mockClear();
```

- [ ] **Step 4: Add the enqueue-failure regression test**

Add this test immediately after `returns confirmation before submitted email enqueue resolves`:

```ts
  it('logs submitted email enqueue failures after confirmation', async () => {
    setPavilionReservationSystemTime();
    const error = Object.assign(new Error('Redis unavailable'), {
      code: 'ECONNREFUSED',
    });
    enqueuePavilionReservationSubmittedEmail.mockRejectedValue(error);
    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      validFormData()
    );

    expect(result).toEqual(expect.objectContaining({ status: 'confirmed' }));
    const scheduled = afterCallbacks[0];
    if (!scheduled) {
      throw new Error('Expected submitted email enqueue callback');
    }
    await expect(scheduled()).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledWith(
      '[pavilion-reservation:create-email-enqueue] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
      {
        errorCode: 'ECONNREFUSED',
        errorName: 'Error',
        referenceCode: expect.stringMatching(/^PAV-/),
      }
    );
  });
```

- [ ] **Step 5: Run the focused action test**

Run:

```bash
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts
```

Expected: PASS. If it fails because enqueue failures escape the `after()` callback or the log payload differs from the design, proceed to Task 2. If it passes, skip Task 2 with the reason: current source already matches the approved design and the new test locks the behavior.

- [ ] **Step 6: Commit the regression test**

Run:

```bash
git add src/libs/mit-sailing/pavilionReservationActions.test.ts
git commit -m "test: cover pavilion email enqueue failure logging"
```

Expected: commit succeeds.

### Task 2: Fix the still-valid enqueue handling issue if the test fails

**Files:**
- Modify: `src/libs/mit-sailing/pavilionReservationActions.ts`
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`

- [ ] **Step 1: Update the submitted-email scheduling block**

If Task 1 fails because the action awaits email work inline, blocks on enqueue completion, or does not catch enqueue errors inside `after()`, replace the submitted-email scheduling block in `src/libs/mit-sailing/pavilionReservationActions.ts` with:

```ts
  after(async () => {
    try {
      await enqueuePavilionReservationSubmittedEmail(getDefaultQueue(), {
        eventName: parsed.data.eventName,
        referenceCode,
        requesterEmail: parsed.data.requesterEmail,
        scheduleLines: scheduleLinesForEmail({ itemById, slots }),
      });
    } catch (error) {
      logger.error(
        '[pavilion-reservation:create-email-enqueue] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
        {
          errorCode: safeErrorCode(error) ?? 'unknown',
          errorName: safeErrorName(error),
          referenceCode,
        }
      );
    }
  });
```

- [ ] **Step 2: Run the focused action test again**

Run:

```bash
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the minimal source fix**

Run only if `src/libs/mit-sailing/pavilionReservationActions.ts` changed:

```bash
git add src/libs/mit-sailing/pavilionReservationActions.ts src/libs/mit-sailing/pavilionReservationActions.test.ts
git commit -m "fix: enqueue pavilion emails after confirmation"
```

Expected: commit succeeds.

### Task 3: Verify BullMQ job best-practice behavior

**Files:**
- Modify: none unless a focused test exposes a still-valid issue
- Test: `src/worker/pavilionReservationSubmittedEmailJob.test.ts`

- [ ] **Step 1: Run the focused worker job test**

Run:

```bash
npm run test -- src/worker/pavilionReservationSubmittedEmailJob.test.ts
```

Expected: PASS, including coverage for retry attempts, exponential backoff, stable `jobId`, delivery failure logging, and rethrow for BullMQ retry.

- [ ] **Step 2: Fix worker job options only if the focused test fails**

If the worker test fails because job options no longer include the approved behavior, restore the options in `src/worker/pavilionReservationSubmittedEmailJob.ts`:

```ts
const PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};
```

Keep the enqueue helper using this `jobId`:

```ts
jobId: `${PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME}:${data.referenceCode}`,
```

- [ ] **Step 3: Re-run the focused worker job test if Task 3 Step 2 changed source**

Run:

```bash
npm run test -- src/worker/pavilionReservationSubmittedEmailJob.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit a worker fix only if source changed**

Run only if `src/worker/pavilionReservationSubmittedEmailJob.ts` changed:

```bash
git add src/worker/pavilionReservationSubmittedEmailJob.ts src/worker/pavilionReservationSubmittedEmailJob.test.ts
git commit -m "fix: keep pavilion email jobs retryable"
```

Expected: commit succeeds.

### Task 4: Run required repository verification

**Files:**
- Modify: none
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`, `src/worker/pavilionReservationSubmittedEmailJob.test.ts`

- [ ] **Step 1: Run both focused tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts src/worker/pavilionReservationSubmittedEmailJob.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Run type checking**

Run:

```bash
npm run check:types
```

Expected: exits 0.

- [ ] **Step 4: Commit verification-only fixes if required**

Run only if lint or type checking required a follow-up change:

```bash
git add src/libs/mit-sailing/pavilionReservationActions.test.ts src/libs/mit-sailing/pavilionReservationActions.ts src/worker/pavilionReservationSubmittedEmailJob.ts src/worker/pavilionReservationSubmittedEmailJob.test.ts
git commit -m "chore: align pavilion email background job checks"
```

Expected: commit succeeds if there are follow-up changes; otherwise skip with the reason: validation passed without additional edits.
