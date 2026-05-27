import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  sailingCardRequestFindMany: vi.fn(),
  userFindMany: vi.fn(),
  userAuditFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    sailingCardRequest: {
      findMany: mocks.sailingCardRequestFindMany,
    },
    user: {
      findMany: mocks.userFindMany,
    },
    userAudit: {
      findMany: mocks.userAuditFindMany,
    },
  },
}));

describe('adminSailingCardUiQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending requests with latest onboarding agreement acceptance', async () => {
    mocks.sailingCardRequestFindMany.mockResolvedValue([
      {
        firstName: 'Submitted',
        id: 'user-1',
        lastName: 'Name',
        mitId: '987654321',
        sailingCardRequestedAt: new Date('2026-05-22T16:00:00.000Z'),
        requestedAt: new Date('2026-05-22T16:00:00.000Z'),
        sailingAffiliation: 'MIT_ALUM',
        legalAgreementAcceptance: {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementVersion: 'v1',
        },
        user: {
          email: 'ada@mit.edu',
          id: 'user-1',
          mitId: '123456789',
          name: 'Ada Lovelace',
          sailingAffiliation: 'MIT_STUDENT',
        },
      },
    ]);
    const { listPendingSailingCardRequests } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(listPendingSailingCardRequests()).resolves.toEqual([
      {
        agreementAcceptedAt: new Date('2026-05-21T16:00:00.000Z'),
        agreementVersion: 'v1',
        email: 'ada@mit.edu',
        id: 'user-1',
        mitId: '987654321',
        name: 'Submitted Name',
        requestedAt: new Date('2026-05-22T16:00:00.000Z'),
        sailingAffiliation: 'MIT_ALUM',
      },
    ]);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.sailingCardRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cardYear: 2026,
          status: 'pending',
        }),
      })
    );
  });

  it('returns old card history even after many unrelated audits', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, index) => ({
        auditedChanges: { after: { name: `User ${index}` }, before: null },
        createdAt: new Date(
          `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
        ),
        id: `audit-${index}`,
      })),
      {
        auditedChanges: {
          after: { sailingCardNumber: 42, sailingCardYear: 2027 },
          before: { sailingCardNumber: null, sailingCardYear: null },
        },
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'card-audit',
      },
    ]);
    const { getAdminSailingCardHistory } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(getAdminSailingCardHistory('user-1')).resolves.toEqual([
      {
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'card-audit',
        number: 42,
        year: 2027,
      },
    ]);
    expect(mocks.userAuditFindMany.mock.calls[0]?.[0]).not.toHaveProperty(
      'take'
    );
  });

  it('uses the previous card number for reissue history', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        auditedChanges: {
          after: { sailingCardNumber: 60, sailingCardYear: 2027 },
          before: { sailingCardNumber: 42, sailingCardYear: 2026 },
        },
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'reissue-audit',
      },
    ]);
    const { getAdminSailingCardHistory } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(getAdminSailingCardHistory('user-1')).resolves.toEqual([
      {
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'reissue-audit',
        number: 42,
        year: 2026,
      },
    ]);
  });
});
