# Admin Upload Rate Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate limiting by admin user, session, and IP for CMS media admin upload control routes before request bodies, upload status checks, queue writes, or DB mutations run.

**Architecture:** Use the existing Arcjet integration in `src/libs/Arcjet.ts` and add a focused server-only helper for CMS media admin upload control routes. Routes authenticate the admin first, call the limiter second, and only then parse body or touch storage/DB/external upload services.

**Tech Stack:** Next.js 16 App Router route handlers, Better Auth session data, Arcjet fixed-window rules, Vitest unit tests.

---

## File Map

- Create `src/libs/mit-sailing/adminUploadRateLimit.ts`: shared admin actor lookup and Arcjet rate-limit enforcement.
- Create `src/libs/mit-sailing/adminUploadRateLimit.test.ts`: unit tests for actor extraction and denied decisions.
- Modify `src/app/api/admin/cms-media/uploads/route.ts`: rate-limit upload session creation.
- Modify `src/app/api/admin/cms-media/uploads/route.test.ts`: verify 429 exits before body/DB work.
- Modify `src/app/api/admin/cms-media/uploads/[id]/route.ts`: rate-limit upload status reads and cancellation.
- Modify `src/app/api/admin/cms-media/uploads/[id]/route.test.ts`: verify 429 exits before asset lookup/mutation.
- Modify `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`: rate-limit finalization before tusd `HEAD` and queue mutation.
- Modify `src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts`: verify 429 exits before asset lookup/tusd/queue work.
- Modify `docs/media-maintenance.md`: document the operational limits and expected 429 behavior.

## Design Decisions

- Limit the admin control endpoints, not tusd byte transfer itself. `tusd` continues enforcing upload size and token checks for `/cms-media/uploads/*`.
- Call the limiter only after an authenticated admin session is known. Unauthenticated and non-admin requests should keep returning `401` and should not consume admin upload quota.
- Use three Arcjet fixed-window rules:
  - `userId`: `30` requests per minute across all sessions for one admin.
  - `sessionId`: `20` requests per minute for one browser/session.
  - IP default: `60` requests per minute from one IP, using the base Arcjet `ip.src` characteristic.
- If `ARCJET_KEY` is missing, keep local/test behavior open by skipping the limiter. This matches `src/proxy.ts`, which only calls Arcjet when `process.env.ARCJET_KEY` is configured.
- Return `{ error: 'rate_limited' }` with status `429` for rate-limit denials. Return `{ error: 'forbidden' }` with status `403` for non-rate-limit Arcjet denials.

## Task 1: Add the Shared Rate-Limit Helper

**Files:**
- Create: `src/libs/mit-sailing/adminUploadRateLimit.ts`
- Create: `src/libs/mit-sailing/adminUploadRateLimit.test.ts`

- [ ] **Step 1: Write the failing helper test**

Create `src/libs/mit-sailing/adminUploadRateLimit.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  loggerWarn: vi.fn(),
  protect: vi.fn(),
  withRule: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/libs/Arcjet', () => ({
  default: {
    withRule: mocks.withRule,
  },
}));

vi.mock('@arcjet/next', () => ({
  fixedWindow: vi.fn((options: unknown) => ({ options })),
}));

function adminSession() {
  return {
    session: { id: 'session-1' },
    user: {
      email: 'admin@example.com',
      id: 'admin-1',
      role: 'admin',
    },
  };
}

function deniedDecision() {
  return {
    id: 'req_1',
    isDenied: () => true,
    reason: {
      isRateLimit: () => true,
    },
  };
}

function allowedDecision() {
  return {
    id: 'req_2',
    isDenied: () => false,
    reason: {
      isRateLimit: () => false,
    },
  };
}

async function subject() {
  return import('@/libs/mit-sailing/adminUploadRateLimit');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('admin upload rate limit', () => {
  it('returns null actor without an admin session', async () => {
    mocks.withRule.mockReturnValue({ protect: mocks.protect, withRule: mocks.withRule });
    mocks.getSession.mockResolvedValue({
      session: { id: 'session-1' },
      user: { id: 'user-1', role: 'user' },
    });
    const { currentAdminUploadActor } = await subject();

    await expect(currentAdminUploadActor()).resolves.toBeNull();
  });

  it('returns admin user and session identifiers for limiting', async () => {
    mocks.withRule.mockReturnValue({ protect: mocks.protect, withRule: mocks.withRule });
    mocks.getSession.mockResolvedValue(adminSession());
    const { currentAdminUploadActor } = await subject();

    await expect(currentAdminUploadActor()).resolves.toEqual({
      sessionId: 'session-1',
      userId: 'admin-1',
    });
  });

  it('skips Arcjet when no key is configured', async () => {
    mocks.withRule.mockReturnValue({ protect: mocks.protect, withRule: mocks.withRule });
    const { enforceAdminUploadRateLimit } = await subject();

    await expect(
      enforceAdminUploadRateLimit({
        actor: { sessionId: 'session-1', userId: 'admin-1' },
        request: new Request('https://mitsailing.test/api/admin/cms-media/uploads'),
      })
    ).resolves.toBeNull();
    expect(mocks.protect).not.toHaveBeenCalled();
  });

  it('returns 429 when Arcjet denies the upload control request for rate limit', async () => {
    vi.stubEnv('ARCJET_KEY', 'test-key');
    mocks.withRule.mockReturnValue({ protect: mocks.protect, withRule: mocks.withRule });
    mocks.protect.mockResolvedValue(deniedDecision());
    const { enforceAdminUploadRateLimit } = await subject();

    const response = await enforceAdminUploadRateLimit({
      actor: { sessionId: 'session-1', userId: 'admin-1' },
      request: new Request('https://mitsailing.test/api/admin/cms-media/uploads'),
    });

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(mocks.protect).toHaveBeenCalledWith(expect.any(Request), {
      sessionId: 'session-1',
      userId: 'admin-1',
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Blocked admin CMS media upload control request',
      {
        decisionId: 'req_1',
        rateLimited: true,
        sessionId: 'session-1',
        userId: 'admin-1',
      }
    );
  });

  it('returns null when Arcjet allows the request', async () => {
    vi.stubEnv('ARCJET_KEY', 'test-key');
    mocks.withRule.mockReturnValue({ protect: mocks.protect, withRule: mocks.withRule });
    mocks.protect.mockResolvedValue(allowedDecision());
    const { enforceAdminUploadRateLimit } = await subject();

    await expect(
      enforceAdminUploadRateLimit({
        actor: { sessionId: 'session-1', userId: 'admin-1' },
        request: new Request('https://mitsailing.test/api/admin/cms-media/uploads'),
      })
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm run test -- src/libs/mit-sailing/adminUploadRateLimit.test.ts
```

Expected: FAIL because `src/libs/mit-sailing/adminUploadRateLimit.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/libs/mit-sailing/adminUploadRateLimit.ts`:

```ts
import 'server-only';
import { fixedWindow } from '@arcjet/next';
import { NextResponse } from 'next/server';
import arcjet from '@/libs/Arcjet';
import { getSession } from '@/libs/auth/dal';
import { normalizeRole, Role } from '@/libs/auth/roles';
import { logger } from '@/libs/Logger';

type AdminUploadActor = {
  sessionId: string;
  userId: string;
};

const adminUploadRateLimiter = arcjet
  .withRule(
    fixedWindow({
      characteristics: ['userId'],
      max: 30,
      mode: 'LIVE',
      window: '1m',
    })
  )
  .withRule(
    fixedWindow({
      characteristics: ['sessionId'],
      max: 20,
      mode: 'LIVE',
      window: '1m',
    })
  )
  .withRule(
    fixedWindow({
      max: 60,
      mode: 'LIVE',
      window: '1m',
    })
  );

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function currentAdminUploadActor(): Promise<AdminUploadActor | null> {
  const session = await getSession();
  const userId = stringValue(session?.user?.id);
  const sessionId = stringValue(session?.session?.id);
  if (!userId || !sessionId) {
    return null;
  }
  if (normalizeRole(session?.user?.role) !== Role.ADMIN) {
    return null;
  }
  return { sessionId, userId };
}

export async function enforceAdminUploadRateLimit(props: {
  actor: AdminUploadActor;
  request: Request;
}): Promise<NextResponse | null> {
  if (!process.env.ARCJET_KEY) {
    return null;
  }
  const decision = await adminUploadRateLimiter.protect(props.request, {
    sessionId: props.actor.sessionId,
    userId: props.actor.userId,
  });
  if (!decision.isDenied()) {
    return null;
  }
  const rateLimited = decision.reason.isRateLimit();
  logger.warn('Blocked admin CMS media upload control request', {
    decisionId: decision.id,
    rateLimited,
    sessionId: props.actor.sessionId,
    userId: props.actor.userId,
  });
  return NextResponse.json(
    { error: rateLimited ? 'rate_limited' : 'forbidden' },
    { status: rateLimited ? 429 : 403 }
  );
}
```

- [ ] **Step 4: Run the helper test**

Run:

```bash
npm run test -- src/libs/mit-sailing/adminUploadRateLimit.test.ts
```

Expected: PASS.

## Task 2: Rate-Limit Upload Session Creation

**Files:**
- Modify: `src/app/api/admin/cms-media/uploads/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/route.test.ts`

- [ ] **Step 1: Write the failing route test**

In `src/app/api/admin/cms-media/uploads/route.test.ts`, add `enforceAdminUploadRateLimit` and `currentAdminUploadActor` to the mocks:

```ts
  currentAdminUploadActor: vi.fn(),
  enforceAdminUploadRateLimit: vi.fn(),
```

Add this mock:

```ts
vi.mock('@/libs/mit-sailing/adminUploadRateLimit', () => ({
  currentAdminUploadActor: mocks.currentAdminUploadActor,
  enforceAdminUploadRateLimit: mocks.enforceAdminUploadRateLimit,
}));
```

Add this test after the non-admin test:

```ts
  it('rate limits upload session creation before reading the body', async () => {
    mocks.currentAdminUploadActor.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'admin-1',
    });
    mocks.enforceAdminUploadRateLimit.mockResolvedValue(
      Response.json({ error: 'rate_limited' }, { status: 429 })
    );

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(response.status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
npm run test -- src/app/api/admin/cms-media/uploads/route.test.ts
```

Expected: FAIL because the route does not call the new rate-limit helper.

- [ ] **Step 3: Replace local auth helper usage in the route**

In `src/app/api/admin/cms-media/uploads/route.ts`, remove these imports:

```ts
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
```

Add this import:

```ts
import {
  currentAdminUploadActor,
  enforceAdminUploadRateLimit,
} from '@/libs/mit-sailing/adminUploadRateLimit';
```

Delete the local `currentAdminUserId()` function.

At the start of `POST`, replace:

```ts
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
```

with:

```ts
  const actor = await currentAdminUploadActor();
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rateLimitResponse = await enforceAdminUploadRateLimit({
    actor,
    request,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
```

Replace `uploadedByUserId: userId,` with:

```ts
      uploadedByUserId: actor.userId,
```

- [ ] **Step 4: Run the upload session route test**

Run:

```bash
npm run test -- src/app/api/admin/cms-media/uploads/route.test.ts
```

Expected: PASS.

## Task 3: Rate-Limit Upload Status and Cancellation

**Files:**
- Modify: `src/app/api/admin/cms-media/uploads/[id]/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests for GET and DELETE**

In `src/app/api/admin/cms-media/uploads/[id]/route.test.ts`, add the same two helper mocks and module mock from Task 2.

Add this helper:

```ts
function stubLimitedAdmin(): void {
  mocks.currentAdminUploadActor.mockResolvedValue({
    sessionId: 'session-1',
    userId: 'admin-1',
  });
  mocks.enforceAdminUploadRateLimit.mockResolvedValue(
    Response.json({ error: 'rate_limited' }, { status: 429 })
  );
}
```

Add these tests after the unauthenticated tests:

```ts
  it('rate limits upload status reads before asset lookup', async () => {
    stubLimitedAdmin();

    const response = await GET(cancelRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(response.status).toBe(429);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rate limits upload cancellation before asset lookup', async () => {
    stubLimitedAdmin();

    const response = await DELETE(cancelRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(response.status).toBe(429);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
npm run test -- 'src/app/api/admin/cms-media/uploads/[id]/route.test.ts'
```

Expected: FAIL because `GET` and `DELETE` do not call the rate-limit helper.

- [ ] **Step 3: Apply the helper to GET and DELETE**

In `src/app/api/admin/cms-media/uploads/[id]/route.ts`, replace the local `getCurrentUser`/`Role` import and `currentAdminUserId()` helper with the shared import from Task 2.

At the start of both `GET` and `DELETE`, replace the current admin check with:

```ts
  const actor = await currentAdminUploadActor();
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rateLimitResponse = await enforceAdminUploadRateLimit({
    actor,
    request: _request,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
```

- [ ] **Step 4: Run the upload status/cancel route test**

Run:

```bash
npm run test -- 'src/app/api/admin/cms-media/uploads/[id]/route.test.ts'
```

Expected: PASS.

## Task 4: Rate-Limit Upload Finalization

**Files:**
- Modify: `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`
- Modify: `src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts`

- [ ] **Step 1: Write the failing finalization test**

In `src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts`, add the same two helper mocks and module mock from Task 2.

Add this test after the unauthenticated test:

```ts
  it('rate limits upload finalization before asset lookup or tusd status checks', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    mocks.currentAdminUploadActor.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'admin-1',
    });
    mocks.enforceAdminUploadRateLimit.mockResolvedValue(
      Response.json({ error: 'rate_limited' }, { status: 429 })
    );

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(response.status).toBe(429);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the finalization route test and verify it fails**

Run:

```bash
npm run test -- 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: FAIL because finalization does not call the rate-limit helper.

- [ ] **Step 3: Apply the helper to finalization**

In `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`, replace the local `getCurrentUser`/`Role` import and `currentAdminUserId()` helper with the shared import from Task 2.

Rename `_request` to `request` in the `POST` signature:

```ts
export async function POST(
  request: Request,
  props: CmsMediaUploadFinalizeRouteProps
) {
```

At the start of `POST`, replace the current admin check with:

```ts
  const actor = await currentAdminUploadActor();
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rateLimitResponse = await enforceAdminUploadRateLimit({
    actor,
    request,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
```

- [ ] **Step 4: Run the finalization route test**

Run:

```bash
npm run test -- 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: PASS.

## Task 5: Document 429 Behavior

**Files:**
- Modify: `docs/media-maintenance.md`

- [ ] **Step 1: Add an operations note**

Add this paragraph near the production upload flow section:

```md
Admin upload control routes are rate-limited before request bodies, tusd status checks, queue writes, or DB mutations run. Limits are keyed by admin user, session, and IP through Arcjet; exhausted limits return `429` with `{ "error": "rate_limited" }`. The byte upload path `/cms-media/uploads/*` remains handled by tusd and its `MEDIA_UPLOAD_MAX_BYTES` limit.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/adminUploadRateLimit.test.ts src/app/api/admin/cms-media/uploads/route.test.ts 'src/app/api/admin/cms-media/uploads/[id]/route.test.ts' 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: PASS.

## Task 6: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/adminUploadRateLimit.test.ts src/app/api/admin/cms-media/uploads/route.test.ts 'src/app/api/admin/cms-media/uploads/[id]/route.test.ts' 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run type checks**

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

- [ ] **Step 4: Commit**

Run:

```bash
git add src/libs/mit-sailing/adminUploadRateLimit.ts src/libs/mit-sailing/adminUploadRateLimit.test.ts src/app/api/admin/cms-media/uploads/route.ts src/app/api/admin/cms-media/uploads/route.test.ts 'src/app/api/admin/cms-media/uploads/[id]/route.ts' 'src/app/api/admin/cms-media/uploads/[id]/route.test.ts' 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts' 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts' docs/media-maintenance.md
git commit -m "fix: rate limit admin media upload controls"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: The plan adds user, session, and IP rate limiting to every app-owned admin CMS media upload control route.
- Placeholder scan: No task uses placeholders or deferred implementation language.
- Type consistency: The shared actor uses `userId` and `sessionId`, and route tests consistently assert `429` with `rate_limited`.
