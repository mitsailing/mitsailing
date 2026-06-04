import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnToSailWaitlistEntryStatus } from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  learnToSailWaitlistEntryAggregate: vi.fn(),
  learnToSailWaitlistEntryCreate: vi.fn(),
  learnToSailWaitlistEntryFindUnique: vi.fn(),
  queryRaw: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
  mocks.learnToSailWaitlistEntryAggregate.mockReset();
  mocks.learnToSailWaitlistEntryCreate.mockReset();
  mocks.learnToSailWaitlistEntryFindUnique.mockReset();
  mocks.queryRaw.mockReset();
  mocks.redirect.mockClear();
  mocks.requireCurrentUser.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.transaction.mockReset();

  mocks.requireCurrentUser.mockResolvedValue({
    email: 'user@example.test',
    id: 'user-1',
    name: 'User One',
  });
  mocks.learnToSailWaitlistEntryAggregate.mockResolvedValue({
    _max: { sequence: 183 },
  });
  mocks.learnToSailWaitlistEntryCreate.mockResolvedValue({
    id: 'waitlist-entry-184',
  });
  mocks.learnToSailWaitlistEntryFindUnique.mockResolvedValue(null);
  mocks.transaction.mockImplementation(
    async (
      transactionOperation: (client: {
        $queryRaw: typeof mocks.queryRaw;
        learnToSailWaitlistEntry: {
          aggregate: typeof mocks.learnToSailWaitlistEntryAggregate;
          create: typeof mocks.learnToSailWaitlistEntryCreate;
          findUnique: typeof mocks.learnToSailWaitlistEntryFindUnique;
        };
      }) => Promise<unknown>
    ) => {
      const result = await transactionOperation({
        $queryRaw: mocks.queryRaw,
        learnToSailWaitlistEntry: {
          aggregate: mocks.learnToSailWaitlistEntryAggregate,
          create: mocks.learnToSailWaitlistEntryCreate,
          findUnique: mocks.learnToSailWaitlistEntryFindUnique,
        },
      });
      return result;
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('joinLearnToSailWaitlistAction', () => {
  it('creates the next annual waitlist entry behind a season lock', async () => {
    const { joinLearnToSailWaitlistAction } =
      await import('@/libs/mit-sailing/learnToSailWaitlistActions');

    await expect(
      joinLearnToSailWaitlistAction('en', '/events/mid-week-123/register')
    ).rejects.toThrow('NEXT_REDIRECT:/events/mid-week-123/register');

    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(mocks.learnToSailWaitlistEntryFindUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { activeEntryKey: '2026:user-1' },
    });
    expect(mocks.learnToSailWaitlistEntryAggregate).toHaveBeenCalledWith({
      _max: { sequence: true },
      where: { seasonYear: 2026 },
    });
    expect(mocks.learnToSailWaitlistEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeEntryKey: '2026:user-1',
        seasonYear: 2026,
        sequence: 184,
        status: LearnToSailWaitlistEntryStatus.active,
        userId: 'user-1',
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/events/mid-week-123/register'
    );
  });

  it('does not create a duplicate active waitlist entry', async () => {
    mocks.learnToSailWaitlistEntryFindUnique.mockResolvedValue({
      id: 'waitlist-entry-existing',
    });
    const { joinLearnToSailWaitlistAction } =
      await import('@/libs/mit-sailing/learnToSailWaitlistActions');

    await expect(
      joinLearnToSailWaitlistAction('en', '/events/mid-week-123/register')
    ).rejects.toThrow('NEXT_REDIRECT:/events/mid-week-123/register');

    expect(mocks.learnToSailWaitlistEntryAggregate).not.toHaveBeenCalled();
    expect(mocks.learnToSailWaitlistEntryCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/events/mid-week-123/register'
    );
  });

  it('does not create a waitlist entry before April 1', async () => {
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));
    const { joinLearnToSailWaitlistAction } =
      await import('@/libs/mit-sailing/learnToSailWaitlistActions');

    await expect(
      joinLearnToSailWaitlistAction('en', '/events/mid-week-123/register')
    ).rejects.toThrow(
      'NEXT_REDIRECT:/events/mid-week-123/register?waitlist=not_open'
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.learnToSailWaitlistEntryCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
