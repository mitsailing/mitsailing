# Pavilion Validation-safe Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure public Pavilion reservation validation errors never consume duplicate-submit rate-limit quota, and lock that behavior with focused unit tests.

**Architecture:** Keep the existing reservation submit flow and advisory-lock dedupe strategy intact. Add explicit unit coverage around invalid submissions and follow-up valid submissions so the rate-limit check only applies to fully validated requests. Use minimal refactoring only if needed to make control flow explicit and testable.

**Tech Stack:** Next.js Server Actions, TypeScript, Vitest (unit), Prisma transaction mocks.

---

### Task 1: Add failing tests for validation-safe rate limiting

**Files:**
- Modify: `src/libs/mit-sailing/pavilionReservationActions.test.ts`
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`

- [ ] **Step 1: Write a failing test for invalid payloads not touching rate-limit checks**

```ts
it('does not touch dedupe checks when payload validation fails', async () => {
  const { submitPavilionReservationRequestAction } =
    await import('@/libs/mit-sailing/pavilionReservationActions');

  const invalid = validFormData();
  invalid.set('slots', '[]');

  const result = await submitPavilionReservationRequestAction(
    'en',
    { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
    invalid
  );

  expect(result).toEqual({ status: 'error', errors: ['error_validation'] });
  expect(transaction).not.toHaveBeenCalled();
  expect(findFirstReservation).not.toHaveBeenCalled();
  expect(requestCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write a failing test for invalid-then-valid flow not triggering rate-limit errors**

```ts
it('allows a corrected valid submission after a validation error', async () => {
  vi.setSystemTime(new Date('2026-06-29T04:00:00.000Z'));
  const { submitPavilionReservationRequestAction } =
    await import('@/libs/mit-sailing/pavilionReservationActions');

  const invalid = validFormData();
  invalid.set('slots', '[]');

  const invalidResult = await submitPavilionReservationRequestAction(
    'en',
    { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
    invalid
  );

  const validResult = await submitPavilionReservationRequestAction(
    'en',
    { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
    validFormData()
  );

  expect(invalidResult).toEqual({ status: 'error', errors: ['error_validation'] });
  expect(validResult.status).toBe('confirmed');
  expect(findFirstReservation).toHaveBeenCalledTimes(1);
  expect(requestCreate).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run targeted test file to confirm failures**

Run:
```bash
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts
```

Expected: FAIL on the new tests before implementation adjustments.

- [ ] **Step 4: Commit failing test changes**

```bash
git add src/libs/mit-sailing/pavilionReservationActions.test.ts
git commit -m "test: cover validation-safe reservation rate limiting"
```

### Task 2: Make rate-limit eligibility explicit in submit action

**Files:**
- Modify: `src/libs/mit-sailing/pavilionReservationActions.ts`
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`

- [ ] **Step 1: Add a small helper for validation error state (if needed for clarity)**

```ts
function validationErrorState(): PavilionReservationSubmitState {
  return { status: 'error', errors: ['error_validation'] };
}
```

- [ ] **Step 2: Use the helper to make early-return validation branches explicit**

```ts
const parsed = parsePavilionReservationFormData(formData);
if (!parsed.success) {
  return validationErrorState();
}

// ...
if (slotRows.some((row) => row === null)) {
  return validationErrorState();
}
```

- [ ] **Step 3: Ensure dedupe/rate-limit checks remain only inside transaction path for valid requests**

```ts
const persistence = await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  if (await hasRecentMatchingReservationRequest(/* ... */)) {
    return { kind: 'rate_limited' as const };
  }

  // create reservation only for validated data
});
```

- [ ] **Step 4: Re-run targeted test file and confirm pass**

Run:
```bash
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts
```

Expected: PASS for all tests in this file.

- [ ] **Step 5: Commit implementation changes**

```bash
git add src/libs/mit-sailing/pavilionReservationActions.ts src/libs/mit-sailing/pavilionReservationActions.test.ts
git commit -m "fix: keep pavilion rate limiting isolated from validation errors"
```

### Task 3: Run required repository verification for touched scope

**Files:**
- Modify: none
- Test: `src/libs/mit-sailing/pavilionReservationActions.test.ts`

- [ ] **Step 1: Run repo-required checks for this change scope**

Run:
```bash
npm run lint
npm run check:types
npm run test -- src/libs/mit-sailing/pavilionReservationActions.test.ts
```

Expected:
- `lint`: exits 0
- `check:types`: exits 0
- targeted `test`: exits 0

- [ ] **Step 2: Commit if any follow-up fixes were required**

```bash
git add -A
git commit -m "chore: align pavilion reservation validation-rate-limit tests"
```

(Only commit if this step produced new changes.)
