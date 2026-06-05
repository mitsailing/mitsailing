import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentStatus,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { getOnboardingTaskHrefForUser } from '@/libs/mit-sailing/onboardingTask';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const mocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      findFirst: mocks.paymentFindFirst,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

function currentRequest(
  overrides: {
    readonly acceptedUserId?: string | null;
    readonly cardType?: SailingCardType;
    readonly status?: SailingCardRequestStatus;
  } = {}
) {
  return {
    cardType: overrides.cardType ?? SailingCardType.normal,
    cardYear: 2026,
    legalAgreementAcceptance: {
      acceptedUserId:
        overrides.acceptedUserId === undefined
          ? 'user-1'
          : overrides.acceptedUserId,
      agreementHash: sailingCardAgreementHash(),
      agreementVersion: sailingCardAgreement.version,
      source: 'SAILING_CARD_ONBOARDING',
    },
    status: overrides.status ?? SailingCardRequestStatus.pending,
    user: {
      emergencyContactName: 'Grace Hopper',
      emergencyContactPhone: '+16175550101',
      phone: '+16175550100',
    },
    userId: 'user-1',
  };
}

describe('getOnboardingTaskHrefForUser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T12:00:00-04:00'));
    mocks.paymentFindFirst.mockReset();
    mocks.userFindUnique.mockReset();
  });

  it('links to onboarding when the user has no current request', async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ sailingCardRequests: [] });

    await expect(
      getOnboardingTaskHrefForUser({ userId: 'user-1' })
    ).resolves.toBe('/onboarding');

    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          sailingCardRequests: expect.objectContaining({
            select: expect.objectContaining({
              legalAgreementAcceptance: expect.objectContaining({
                select: expect.objectContaining({ acceptedUserId: true }),
              }),
            }),
            where: { cardYear: 2026 },
          }),
        }),
        where: { id: 'user-1' },
      })
    );
  });

  it('clears onboarding for completed normal-card requests', async () => {
    mocks.userFindUnique.mockResolvedValueOnce({
      sailingCardRequests: [currentRequest()],
    });

    await expect(
      getOnboardingTaskHrefForUser({ userId: 'user-1' })
    ).resolves.toBeNull();

    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
  });

  it('links to onboarding when deleted-user legal evidence has been anonymized', async () => {
    mocks.userFindUnique.mockResolvedValueOnce({
      sailingCardRequests: [currentRequest({ acceptedUserId: null })],
    });

    await expect(
      getOnboardingTaskHrefForUser({ userId: 'user-1' })
    ).resolves.toBe('/onboarding');

    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
  });

  it('requires a paid membership payment for paid card types', async () => {
    mocks.userFindUnique.mockResolvedValue({
      sailingCardRequests: [
        currentRequest({ cardType: SailingCardType.team_racing }),
      ],
    });
    mocks.paymentFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'payment-1',
    });

    await expect(
      getOnboardingTaskHrefForUser({ userId: 'user-1' })
    ).resolves.toBe('/onboarding');
    await expect(
      getOnboardingTaskHrefForUser({ userId: 'user-1' })
    ).resolves.toBeNull();

    expect(mocks.paymentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true },
        where: expect.objectContaining({
          cardType: SailingCardType.team_racing,
          cardYear: 2026,
          status: PaymentStatus.paid,
          userId: 'user-1',
        }),
      })
    );
  });
});
