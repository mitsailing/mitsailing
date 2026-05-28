import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

describe('getNextAvailableSailingCardNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 60 when no current-year cards exist', async () => {
    mocks.userFindMany.mockResolvedValue([]);
    const { getNextAvailableSailingCardNumber } =
      await import('@/libs/admin/cards/adminSailingCardQueries');

    await expect(
      getNextAvailableSailingCardNumber({ cardYear: 2027 })
    ).resolves.toBe(60);
  });

  it('skips used current-year numbers and returns the first free number', async () => {
    mocks.userFindMany.mockResolvedValue([
      { sailingCardNumber: 60 },
      { sailingCardNumber: 61 },
      { sailingCardNumber: 63 },
    ]);
    const { getNextAvailableSailingCardNumber } =
      await import('@/libs/admin/cards/adminSailingCardQueries');

    await expect(
      getNextAvailableSailingCardNumber({ cardYear: 2027 })
    ).resolves.toBe(62);
  });

  it('ignores previous card years', async () => {
    mocks.userFindMany.mockResolvedValue([{ sailingCardNumber: 60 }]);
    const { getNextAvailableSailingCardNumber } =
      await import('@/libs/admin/cards/adminSailingCardQueries');

    await getNextAvailableSailingCardNumber({ cardYear: 2027 });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sailingCardNumber: { not: null },
          sailingCardYear: 2027,
        },
      })
    );
  });

  it('does not reserve the number', async () => {
    mocks.userFindMany.mockResolvedValue([]);
    const { getNextAvailableSailingCardNumber } =
      await import('@/libs/admin/cards/adminSailingCardQueries');

    await getNextAvailableSailingCardNumber({ cardYear: 2027 });

    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
  });

  it('throws when the configured card range is full', async () => {
    const { MAX_SAILING_CARD_NUMBER, getNextAvailableSailingCardNumber } =
      await import('@/libs/admin/cards/adminSailingCardQueries');
    mocks.userFindMany.mockResolvedValue(
      Array.from({ length: MAX_SAILING_CARD_NUMBER - 59 }, (_value, index) => ({
        sailingCardNumber: index + 60,
      }))
    );

    await expect(
      getNextAvailableSailingCardNumber({ cardYear: 2027 })
    ).rejects.toThrow('No available sailing card numbers.');
  });
});
