import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PavilionReservationSubmitState } from '@/libs/mit-sailing/pavilionReservationTypes';

type TestTransactionClient = {
  $executeRaw: typeof txExecuteRaw;
  pavilionReservationRequest: {
    create: typeof requestCreate;
    deleteMany: typeof requestDeleteMany;
    findFirst: typeof findFirstReservation;
    findMany: typeof requestFindMany;
    findUnique: typeof findUniqueReservation;
    update: typeof requestUpdate;
  };
  pavilionReservationService: {
    deleteMany: typeof serviceDeleteMany;
  };
  pavilionReservationSlot: {
    deleteMany: typeof slotDeleteMany;
  };
};

type TestTransactionRunner = (tx: TestTransactionClient) => Promise<unknown>;

const {
  after,
  afterCallbacks,
  cancelPavilionReservationAbandonEmailJobs,
  findFirstReservation,
  findUniqueReservation,
  defaultQueue,
  enqueuePavilionReservationSubmittedEmail,
  getDefaultQueue,
  listVisiblePavilionReservableItems,
  loggerError,
  revalidatePath,
  requestCreate,
  requestDeleteMany,
  requestFindMany,
  requestUpdate,
  serviceDeleteMany,
  slotDeleteMany,
  transaction,
  txExecuteRaw,
} = vi.hoisted(() => ({
  after: vi.fn((scheduledWork: () => Promise<void> | void) => {
    afterCallbacks.push(scheduledWork);
  }),
  afterCallbacks: [] as (() => Promise<void> | void)[],
  cancelPavilionReservationAbandonEmailJobs: vi.fn(),
  findFirstReservation: vi.fn(),
  findUniqueReservation: vi.fn(),
  defaultQueue: { add: vi.fn(), getJob: vi.fn() },
  enqueuePavilionReservationSubmittedEmail: vi.fn(),
  getDefaultQueue: vi.fn(),
  listVisiblePavilionReservableItems: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  requestCreate: vi.fn(),
  requestDeleteMany: vi.fn(),
  requestFindMany: vi.fn(),
  requestUpdate: vi.fn(),
  serviceDeleteMany: vi.fn(),
  slotDeleteMany: vi.fn(),
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

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerError,
  },
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

vi.mock('@/worker/pavilionReservationAbandonEmailJob', () => ({
  cancelPavilionReservationAbandonEmailJobs,
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
  formData.set('eventName', 'Late Night Pavilion Booking');
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
  cancelPavilionReservationAbandonEmailJobs.mockReset();
  findFirstReservation.mockReset();
  findUniqueReservation.mockReset();
  defaultQueue.add.mockReset();
  enqueuePavilionReservationSubmittedEmail.mockReset();
  getDefaultQueue.mockReset();
  listVisiblePavilionReservableItems.mockReset();
  loggerError.mockClear();
  revalidatePath.mockClear();
  requestCreate.mockReset();
  requestDeleteMany.mockReset();
  requestFindMany.mockReset();
  requestUpdate.mockReset();
  serviceDeleteMany.mockReset();
  slotDeleteMany.mockReset();
  transaction.mockReset();
  txExecuteRaw.mockReset();

  findFirstReservation.mockResolvedValue(null);
  findUniqueReservation.mockResolvedValue(null);
  requestFindMany.mockResolvedValue([]);
  requestDeleteMany.mockResolvedValue({ count: 0 });
  requestUpdate.mockResolvedValue({ id: 'draft-1' });
  slotDeleteMany.mockResolvedValue({ count: 0 });
  serviceDeleteMany.mockResolvedValue({ count: 0 });
  cancelPavilionReservationAbandonEmailJobs.mockImplementation(async () => {
    await Promise.resolve();
  });
  listVisiblePavilionReservableItems.mockResolvedValue([
    {
      description: 'A casual pavilion reservation space.',
      displayOrder: 1,
      id: 'space-1',
      imageUrl: null,
      kind: 'space',
      publicGroup: 'venue',
      media: [],
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
          deleteMany: requestDeleteMany,
          findFirst: findFirstReservation,
          findMany: requestFindMany,
          findUnique: findUniqueReservation,
          update: requestUpdate,
        },
        pavilionReservationService: {
          deleteMany: serviceDeleteMany,
        },
        pavilionReservationSlot: {
          deleteMany: slotDeleteMany,
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

  it('preserves event name casing while deduplicating case-insensitively', async () => {
    setPavilionReservationSystemTime();
    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      validFormData()
    );

    expect(result.status).toBe('confirmed');
    expect(findFirstReservation).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        createdAt: { gte: new Date('2026-06-29T03:55:00.000Z') },
        eventName: {
          equals: 'Late Night Pavilion Booking',
          mode: 'insensitive',
        },
        requesterEmail: 'pavilion-requester@example.com',
        status: { not: 'draft' },
      },
    });
    expect(txExecuteRaw.mock.calls[0]?.[1]).toContain(
      'late night pavilion booking'
    );
    expect(requestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'Late Night Pavilion Booking',
      }),
      select: { id: true },
    });
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
    expect(getDefaultQueue).toHaveBeenCalledTimes(2);
    expect(enqueuePavilionReservationSubmittedEmail).toHaveBeenCalledWith(
      defaultQueue,
      {
        referenceCode: expect.stringMatching(/^PAV-/),
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
    const [scheduled] = afterCallbacks;
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

  it('includes hourly services in estimated totals and persisted service rows', async () => {
    setPavilionReservationSystemTime();
    listVisiblePavilionReservableItems.mockResolvedValue([
      {
        description: 'A casual pavilion reservation space.',
        displayOrder: 1,
        id: 'space-1',
        imageUrl: null,
        kind: 'space',
        publicGroup: 'venue',
        media: [],
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
        publicGroup: null,
        media: [],
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
      select: { id: true },
    });
  });

  it('promotes an existing draft when resume token matches', async () => {
    setPavilionReservationSystemTime();
    findFirstReservation.mockImplementation(
      (args: { where?: Record<string, unknown> }) => {
        if (args.where && 'resumeToken' in args.where) {
          return {
            id: 'draft-1',
            referenceCode: 'PAV-DRAFT01',
            requesterEmail: 'pavilion-requester@example.com',
            resumeToken: 'resume-token-1',
            status: 'draft',
          };
        }
        return null;
      }
    );

    const { submitPavilionReservationRequestAction } =
      await import('@/libs/mit-sailing/pavilionReservationActions');

    const formData = validFormData();
    formData.set('resumeToken', 'resume-token-1');
    formData.set('draftRequestId', 'draft-1');

    const result = await submitPavilionReservationRequestAction(
      'en',
      { errors: [], status: 'idle' } satisfies PavilionReservationSubmitState,
      formData
    );

    expect(result.status).toBe('confirmed');
    expect(result.referenceCode).toBe('PAV-DRAFT01');
    expect(requestCreate).not.toHaveBeenCalled();
    expect(requestUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resumeToken: null,
        status: 'pending',
      }),
      where: { id: 'draft-1' },
    });
    expect(after).toHaveBeenCalledTimes(1);
    await afterCallbacks[0]?.();
    expect(cancelPavilionReservationAbandonEmailJobs).toHaveBeenCalledWith(
      defaultQueue,
      ['draft-1']
    );
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
        publicGroup: 'venue',
        media: [],
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
        publicGroup: null,
        media: [],
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
      select: { id: true },
    });
  });
});
