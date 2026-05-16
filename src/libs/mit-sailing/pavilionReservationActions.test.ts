import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PavilionReservationSubmitState } from '@/libs/mit-sailing/pavilionReservationTypes';

type TestTransactionClient = {
  $executeRaw: typeof txExecuteRaw;
  pavilionReservationRequest: {
    create: typeof requestCreate;
    findFirst: typeof findFirstReservation;
    findUnique: typeof findUniqueReservation;
  };
};

type TestTransactionRunner = (tx: TestTransactionClient) => Promise<unknown>;

const {
  after,
  afterCallbacks,
  findFirstReservation,
  findUniqueReservation,
  defaultQueue,
  enqueuePavilionReservationSubmittedEmail,
  getDefaultQueue,
  listVisiblePavilionReservableItems,
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
  revalidatePath: vi.fn(),
  requestCreate: vi.fn(),
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
}));

vi.mock('next/server', () => ({
  after,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: transaction,
  },
}));

vi.mock('@/worker/defaultQueue', () => ({
  getDefaultQueue,
}));

vi.mock('@/worker/pavilionReservationSubmittedEmailJob', () => ({
  enqueuePavilionReservationSubmittedEmail,
}));

vi.mock('@/libs/mit-sailing/pavilionReservationQueries', () => ({
  listVisiblePavilionReservableItems,
}));

function validFormData(): FormData {
  const formData = new FormData();
  formData.set('requesterEmail', 'pavilion-requester@example.com');
  formData.set('persona', 'mit_student');
  formData.set('firstName', 'Pavilion');
  formData.set('lastName', 'Requester');
  formData.set('phone', '617-555-0142');
  formData.set('eventName', 'Late night pavilion booking');
  formData.set('groupName', '');
  formData.set('groupSize', '12');
  formData.set('description', 'A waterfront event.');
  formData.set('hasTent', 'false');
  formData.set('servesAlcohol', 'false');
  formData.set('projectTitle', '');
  formData.set('advisorName', '');
  formData.set('advisorEmail', '');
  formData.set('costCenter', '');
  formData.set('mitId', '123456789');
  formData.set('mitAccount', '1234567');
  formData.set(
    'slots',
    JSON.stringify([
      {
        itemId: 'space-1',
        date: '2026-07-01',
        startMinutes: 25 * 60,
        endMinutes: 26 * 60,
      },
    ])
  );
  formData.set('services', JSON.stringify([]));
  return formData;
}

function formDataWithServices(serviceIds: string[]): FormData {
  const formData = validFormData();
  formData.set('services', JSON.stringify(serviceIds));
  return formData;
}

function setPavilionReservationSystemTime() {
  vi.setSystemTime(new Date('2026-06-29T04:00:00.000Z'));
}

beforeEach(() => {
  after.mockClear();
  afterCallbacks.length = 0;
  findFirstReservation.mockReset();
  findUniqueReservation.mockReset();
  defaultQueue.add.mockReset();
  enqueuePavilionReservationSubmittedEmail.mockReset();
  getDefaultQueue.mockReset();
  listVisiblePavilionReservableItems.mockReset();
  revalidatePath.mockClear();
  requestCreate.mockReset();
  transaction.mockReset();
  txExecuteRaw.mockReset();

  findFirstReservation.mockResolvedValue(null);
  findUniqueReservation.mockResolvedValue(null);
  listVisiblePavilionReservableItems.mockResolvedValue([
    {
      description: 'A casual pavilion reservation space.',
      displayOrder: 1,
      id: 'space-1',
      imageUrl: null,
      kind: 'space',
      minDurationHours: null,
      name: 'Casual party space',
      prices: {
        mit_academic: 1000,
        mit_community: 1000,
        mit_student: 1000,
        non_mit: 1000,
      },
      pricingType: 'hourly',
      slug: 'casual-party-space',
    },
  ]);
  requestCreate.mockResolvedValue({ id: 'request-1' });
  getDefaultQueue.mockReturnValue(defaultQueue);
  enqueuePavilionReservationSubmittedEmail.mockImplementation(async () => {});
  txExecuteRaw.mockImplementation(
    async (_strings: TemplateStringsArray, lockKey: string) => {
      await Promise.resolve();
      if (lockKey.includes('\0')) {
        throw new Error('invalid byte sequence for encoding "UTF8": 0x00');
      }
      return 1;
    }
  );
  transaction.mockImplementation(
    async (runInTransaction: TestTransactionRunner) => {
      const tx: TestTransactionClient = {
        $executeRaw: txExecuteRaw,
        pavilionReservationRequest: {
          create: requestCreate,
          findFirst: findFirstReservation,
          findUnique: findUniqueReservation,
        },
      };
      const result = await runInTransaction(tx);
      return result;
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('submitPavilionReservationRequestAction', () => {
  it('does not run dedupe checks when payload validation fails', async () => {
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

  it('allows corrected submission after validation error', async () => {
    setPavilionReservationSystemTime();
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

    expect(invalidResult).toEqual({
      status: 'error',
      errors: ['error_validation'],
    });
    expect(validResult.status).toBe('confirmed');
    expect(findFirstReservation).toHaveBeenCalledTimes(1);
    expect(requestCreate).toHaveBeenCalledTimes(1);
  });

  it('submits after-midnight reservations with a PostgreSQL-safe lock key', async () => {
    setPavilionReservationSystemTime();
    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      validFormData()
    );

    expect(result.status).toBe('confirmed');
    expect(txExecuteRaw).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String)
    );
    expect(txExecuteRaw.mock.calls[0]?.[1]).not.toContain('\0');
  });

  it('schedules submitted email for background retry after confirmed persistence', async () => {
    setPavilionReservationSystemTime();
    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      validFormData()
    );

    expect(result.status).toBe('confirmed');
    expect(after).toHaveBeenCalledTimes(1);
    await afterCallbacks[0]?.();
    expect(getDefaultQueue).toHaveBeenCalledTimes(1);
    expect(enqueuePavilionReservationSubmittedEmail).toHaveBeenCalledWith(
      defaultQueue,
      {
        eventName: 'Late night pavilion booking',
        referenceCode: expect.stringMatching(/^PAV-/),
        requesterEmail: 'pavilion-requester@example.com',
        scheduleLines: [
          'Casual party space: Wed, Jul 1, 2026 · 1:00 AM (next day) - 2:00 AM (next day)',
        ],
      }
    );
  });

  it('returns confirmation before submitted email enqueue resolves', async () => {
    setPavilionReservationSystemTime();
    const pendingEnqueue = Promise.withResolvers<undefined>();
    enqueuePavilionReservationSubmittedEmail.mockImplementation(async () => {
      await pendingEnqueue.promise;
    });
    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const resultPromise = submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      validFormData()
    );

    const blocked = Promise.withResolvers<'blocked'>();
    setTimeout(() => {
      blocked.resolve('blocked');
    }, 0);
    const result = await Promise.race([resultPromise, blocked.promise]);

    expect(result).toEqual(expect.objectContaining({ status: 'confirmed' }));
  });

  it('includes hourly services in estimated totals and persisted service rows', async () => {
    setPavilionReservationSystemTime();
    listVisiblePavilionReservableItems.mockResolvedValue([
      {
        description: 'A casual pavilion reservation space.',
        displayOrder: 1,
        id: 'space-1',
        imageUrl: null,
        kind: 'space',
        minDurationHours: null,
        name: 'Casual party space',
        prices: {
          mit_academic: 1000,
          mit_community: 1000,
          mit_student: 1000,
          non_mit: 1000,
        },
        pricingType: 'hourly',
        slug: 'casual-party-space',
      },
      {
        description: 'Staffing support billed hourly.',
        displayOrder: 2,
        id: 'service-hourly',
        imageUrl: null,
        kind: 'service',
        minDurationHours: null,
        name: 'Event staffing',
        prices: {
          mit_academic: 2500,
          mit_community: 2500,
          mit_student: 2500,
          non_mit: 2500,
        },
        pricingType: 'hourly',
        slug: 'event-staffing',
      },
    ]);

    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      formDataWithServices(['service-hourly'])
    );

    expect(result.status).toBe('confirmed');
    expect(requestCreate).toHaveBeenCalledTimes(1);
    expect(requestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estimatedTotalCents: 3500,
        services: {
          create: [
            {
              itemId: 'service-hourly',
              itemKind: 'service',
              estimatedAmountCents: 2500,
            },
          ],
        },
      }),
    });
  });

  it('deduplicates repeated hourly service ids before pricing', async () => {
    setPavilionReservationSystemTime();
    listVisiblePavilionReservableItems.mockResolvedValue([
      {
        description: 'A casual pavilion reservation space.',
        displayOrder: 1,
        id: 'space-1',
        imageUrl: null,
        kind: 'space',
        minDurationHours: null,
        name: 'Casual party space',
        prices: {
          mit_academic: 1000,
          mit_community: 1000,
          mit_student: 1000,
          non_mit: 1000,
        },
        pricingType: 'hourly',
        slug: 'casual-party-space',
      },
      {
        description: 'Staffing support billed hourly.',
        displayOrder: 2,
        id: 'service-hourly',
        imageUrl: null,
        kind: 'service',
        minDurationHours: null,
        name: 'Event staffing',
        prices: {
          mit_academic: 2500,
          mit_community: 2500,
          mit_student: 2500,
          non_mit: 2500,
        },
        pricingType: 'hourly',
        slug: 'event-staffing',
      },
    ]);

    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      formDataWithServices(['service-hourly', 'service-hourly'])
    );

    expect(requestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estimatedTotalCents: 3500,
        services: {
          create: [
            {
              itemId: 'service-hourly',
              itemKind: 'service',
              estimatedAmountCents: 2500,
            },
          ],
        },
      }),
    });
  });
});
