import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import {
  LegalAgreementAcceptanceSource,
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingAffiliation,
  SailingCardRequestStatus,
  SailingCardType,
  UserAuditAction,
} from '@/generated/prisma/enums';
import { Permission } from '@/libs/auth/permissions';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  txPaymentCreate: vi.fn(),
  txPaymentFindFirst: vi.fn(),
  txLegalAgreementAcceptanceFindFirst: vi.fn(),
  txSailingCardRequestCount: vi.fn(),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  txSailingCardRequestFindFirst: vi.fn(),
  txSailingCardRequestUpdate: vi.fn(),
  txSailingCardRequestUpdateMany: vi.fn(),
  txUserAuditCreate: vi.fn(),
  txUserAuditFindFirst: vi.fn(),
  txUserCount: vi.fn(),
  txUserFindMany: vi.fn(),
  txUserFindUnique: vi.fn(),
  txUserUpdate: vi.fn(),
  txUserUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

type MockTransactionClient = {
  readonly payment: {
    readonly create: typeof mocks.txPaymentCreate;
    readonly findFirst: typeof mocks.txPaymentFindFirst;
  };
  readonly legalAgreementAcceptance: {
    readonly findFirst: typeof mocks.txLegalAgreementAcceptanceFindFirst;
  };
  readonly sailingCardRequest: {
    readonly count: typeof mocks.txSailingCardRequestCount;
    readonly findFirst: typeof mocks.txSailingCardRequestFindFirst;
    readonly update: typeof mocks.txSailingCardRequestUpdate;
    readonly updateMany: typeof mocks.txSailingCardRequestUpdateMany;
  };
  readonly user: {
    readonly count: typeof mocks.txUserCount;
    readonly findMany: typeof mocks.txUserFindMany;
    readonly findUnique: typeof mocks.txUserFindUnique;
    readonly update: typeof mocks.txUserUpdate;
    readonly updateMany: typeof mocks.txUserUpdateMany;
  };
  readonly userAudit: {
    readonly create: typeof mocks.txUserAuditCreate;
    readonly findFirst: typeof mocks.txUserAuditFindFirst;
  };
};

type MockTransactionOperation = (tx: MockTransactionClient) => Promise<unknown>;

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

const existingUser = {
  sailingCardExpiresOn: null,
  sailingCardIssuedAt: null,
  sailingCardIssuedByUserId: null,
  sailingCardNumber: null,
  sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingCardSwimAgreementInitialedAt: null,
  sailingCardSwimAgreementInitials: null,
  sailingCardYear: null,
};

function formDataWithCardNumber(value: string) {
  const formData = new FormData();
  formData.set('cardNumber', value);
  return formData;
}

function formDataWithCardNumberAndPaymentBypassNote(
  cardNumber: string,
  paymentBypassNote: string
) {
  const formData = formDataWithCardNumber(cardNumber);
  formData.set('paymentBypassNote', paymentBypassNote);
  return formData;
}

function formDataWithRecreationVerification(cardNumber: string) {
  const formData = formDataWithCardNumber(cardNumber);
  formData.set('gymMembershipVerified', 'true');
  return formData;
}

function uniqueCardError(
  target: string | string[] = ['sailingCardYear', 'sailingCardNumber']
) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    clientVersion: 'test',
    code: 'P2002',
    meta: { target },
  });
}

async function expectIssueCardFormError(options: {
  readonly cardNumber?: string;
  readonly formData?: FormData;
  readonly formError: string;
}) {
  const { issueSailingCardAction } =
    await import('@/libs/admin/cards/adminSailingCardActions');

  await expect(
    issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      options.formData ?? formDataWithCardNumber(options.cardNumber ?? '61')
    )
  ).resolves.toEqual({
    fieldErrors: {},
    formError: options.formError,
    status: 'error',
  });
}

function expectNoCardIssueWrites() {
  expect(mocks.txSailingCardRequestUpdateMany).not.toHaveBeenCalled();
  expect(mocks.txUserUpdateMany).not.toHaveBeenCalled();
  expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
}

describe('adminSailingCardActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ user: { id: 'admin-1' } });
    mocks.txSailingCardRequestCount.mockResolvedValue(0);
    mocks.txUserCount.mockResolvedValue(0);
    mocks.txUserFindMany.mockResolvedValue([]);
    mocks.txUserFindUnique.mockResolvedValue(existingUser);
    mocks.txUserUpdate.mockResolvedValue({});
    mocks.txUserUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txPaymentCreate.mockResolvedValue({});
    mocks.txPaymentFindFirst.mockResolvedValue(null);
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.normal,
      hasFitnessMembership: true,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      user: {
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      },
    });
    mocks.txSailingCardRequestUpdate.mockResolvedValue({});
    mocks.txSailingCardRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txLegalAgreementAcceptanceFindFirst.mockResolvedValue({
      acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
      agreementVersion: 'v1',
    });
    mocks.txUserAuditFindFirst.mockResolvedValue({ version: 4 });
    mocks.txUserAuditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(
      async (operation: MockTransactionOperation) => {
        const result = await operation({
          payment: {
            create: mocks.txPaymentCreate,
            findFirst: mocks.txPaymentFindFirst,
          },
          user: {
            count: mocks.txUserCount,
            findMany: mocks.txUserFindMany,
            findUnique: mocks.txUserFindUnique,
            update: mocks.txUserUpdate,
            updateMany: mocks.txUserUpdateMany,
          },
          legalAgreementAcceptance: {
            findFirst: mocks.txLegalAgreementAcceptanceFindFirst,
          },
          sailingCardRequest: {
            count: mocks.txSailingCardRequestCount,
            findFirst: mocks.txSailingCardRequestFindFirst,
            update: mocks.txSailingCardRequestUpdate,
            updateMany: mocks.txSailingCardRequestUpdateMany,
          },
          userAudit: {
            create: mocks.txUserAuditCreate,
            findFirst: mocks.txUserAuditFindFirst,
          },
        });
        return result;
      }
    );
    vi.setSystemTime(new Date('2026-08-01T12:00:00-04:00'));
  });

  it('issueSailingCardAction requires card number assignment permission', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('')
      )
    ).resolves.toEqual({ fieldErrors: {}, status: 'success' });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.CARDS_ASSIGN_NUMBER,
      'en'
    );
  });

  it('blank manual card number uses suggested number', async () => {
    mocks.txUserFindMany.mockResolvedValue([{ sailingCardNumber: 60 }]);
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('')
    );

    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardNumber: 61,
          sailingCardYear: 2027,
        }),
      })
    );
  });

  it('manual card number accepts any unused positive integer', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber(' 110 ')
    );

    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardNumber: 110,
        }),
      })
    );
  });

  it('rejects malformed manual card numbers before opening a transaction', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('0')
      )
    ).resolves.toEqual({
      fieldErrors: { cardNumber: 'invalid' },
      status: 'error',
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('duplicate card number returns a field-level error', async () => {
    mocks.transaction.mockRejectedValue(uniqueCardError());
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    });
  });

  it('recognizes duplicate card numbers from string unique targets', async () => {
    mocks.transaction.mockRejectedValue(
      uniqueCardError('sailingCardYear_sailingCardNumber')
    );
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    });
  });

  it('returns not found when issuing for a deleted user', async () => {
    mocks.txUserFindUnique.mockResolvedValue(null);
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'missing-user',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'not_found',
      status: 'error',
    });

    expect(mocks.txSailingCardRequestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('does not issue a card when the user has no pending request', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue(null);

    await expectIssueCardFormError({ formError: 'not_pending_request' });

    expectNoCardIssueWrites();
  });

  it('does not issue a card over an already issued card', async () => {
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 61,
      sailingCardYear: 2027,
    });
    await expectIssueCardFormError({
      cardNumber: '62',
      formError: 'not_pending_request',
    });

    expectNoCardIssueWrites();
  });

  it('issues a current-year card over an expired previous-year card', async () => {
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2025-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 42,
      sailingCardYear: 2026,
    });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({ fieldErrors: {}, status: 'success' });

    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardNumber: 61,
          sailingCardYear: 2027,
        }),
      })
    );
    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalled();
  });

  it('does not issue a card when the user has no onboarding agreement acceptance', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
        userId: 'user-1',
      },
    });
    await expectIssueCardFormError({
      formError: 'missing_onboarding_agreement',
    });

    expectNoCardIssueWrites();
  });

  it('loads current-year pending request before issuing a card', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('61')
    );

    expect(mocks.txSailingCardRequestFindFirst).toHaveBeenCalledWith({
      where: {
        cardYear: 2027,
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      },
      select: {
        cardType: true,
        hasFitnessMembership: true,
        id: true,
        legalAgreementAcceptance: {
          select: {
            agreementHash: true,
            agreementVersion: true,
            source: true,
            userId: true,
          },
        },
        sailingAffiliation: true,
        user: {
          select: {
            gymMembershipVerifiedAt: true,
          },
        },
      },
    });
    expect(mocks.txLegalAgreementAcceptanceFindFirst).not.toHaveBeenCalled();
  });

  it('does not issue normal before mit recreation is verified', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.normal,
      hasFitnessMembership: false,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      user: {
        gymMembershipVerifiedAt: null,
      },
    });
    await expectIssueCardFormError({ formError: 'mit_recreation_required' });

    expectNoCardIssueWrites();
  });

  it('does not issue legacy normal requests before mit recreation is verified', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.normal,
      hasFitnessMembership: null,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      user: {
        gymMembershipVerifiedAt: null,
      },
    });
    await expectIssueCardFormError({ formError: 'mit_recreation_required' });

    expectNoCardIssueWrites();
  });

  it('does not issue self-reported normal requests before mit recreation is verified', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.normal,
      hasFitnessMembership: true,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      user: {
        gymMembershipVerifiedAt: null,
      },
    });
    await expectIssueCardFormError({ formError: 'mit_recreation_required' });

    expectNoCardIssueWrites();
  });

  it('verifies mit recreation while issuing a normal card when staff confirms it', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.normal,
      hasFitnessMembership: true,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      user: {
        gymMembershipVerifiedAt: null,
      },
    });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithRecreationVerification('61')
    );

    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gymMembershipVerifiedAt: new Date('2026-08-01T16:00:00.000Z'),
          sailingCardNumber: 61,
        }),
      })
    );
  });

  it('issuing a card sets yearly card fields without requiring initials', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('61')
    );

    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
          sailingCardIssuedByUserId: 'admin-1',
          sailingCardNumber: 61,
          sailingCardRequestedAt: null,
          sailingCardSwimAgreementInitials: null,
          sailingCardYear: 2027,
        }),
        where: expect.objectContaining({ id: 'user-1' }),
      })
    );
  });

  it('issuing a card writes user audit with old and new card values', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('61')
    );

    expect(mocks.txUserAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: UserAuditAction.update,
        auditableId: 'user-1',
        auditableType: 'user',
        auditedChanges: expect.objectContaining({
          after: expect.objectContaining({
            sailingCardNumber: 61,
            sailingCardYear: 2027,
          }),
          before: expect.objectContaining({
            sailingCardNumber: null,
            sailingCardYear: null,
          }),
        }),
        userId: 'admin-1',
        version: 5,
      }),
    });
  });

  it('issuing a card approves the current-year request row', async () => {
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('61')
    );

    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        cardYear: 2027,
        id: 'request-1',
        legalAgreementAcceptance: {
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
          source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
          userId: 'user-1',
        },
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      },
      data: {
        approvedAt: new Date('2026-08-01T16:00:00.000Z'),
        approvedByUserId: 'admin-1',
        issuedCardNumber: 61,
        status: SailingCardRequestStatus.approved,
      },
    });
  });

  it('issuing a paid card without a recorded payment creates an admin override payment', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.racing,
      hasFitnessMembership: null,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
    });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumberAndPaymentBypassNote(
        '61',
        'Director approved comped racing access.'
      )
    );

    expect(mocks.txPaymentFindFirst).toHaveBeenCalledWith({
      where: {
        cardType: SailingCardType.racing,
        cardYear: 2027,
        purpose: PaymentPurpose.membership,
        status: { in: [PaymentStatus.handled, PaymentStatus.paid] },
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(mocks.txPaymentCreate).toHaveBeenCalledWith({
      data: {
        amountCents: 0,
        cardType: SailingCardType.racing,
        cardYear: 2027,
        currency: 'usd',
        manualHandledAt: new Date('2026-08-01T16:00:00.000Z'),
        manualHandledByUserId: 'admin-1',
        manualHandledNote: 'Director approved comped racing access.',
        purpose: PaymentPurpose.membership,
        source: PaymentSource.admin_override,
        status: PaymentStatus.handled,
        userId: 'user-1',
      },
    });
    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentBypassAt: new Date('2026-08-01T16:00:00.000Z'),
          paymentBypassByUserId: 'admin-1',
          paymentBypassNote: 'Director approved comped racing access.',
        }),
      })
    );
  });

  it('issuing a paid team racing card without a recorded payment creates an admin override payment', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.team_racing,
      hasFitnessMembership: null,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
    });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumberAndPaymentBypassNote(
        '61',
        'Director approved comped team racing access.'
      )
    );

    expect(mocks.txPaymentFindFirst).toHaveBeenCalledWith({
      where: {
        cardType: SailingCardType.team_racing,
        cardYear: 2027,
        purpose: PaymentPurpose.membership,
        status: { in: [PaymentStatus.handled, PaymentStatus.paid] },
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(mocks.txPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardType: SailingCardType.team_racing,
        manualHandledNote: 'Director approved comped team racing access.',
        source: PaymentSource.admin_override,
        status: PaymentStatus.handled,
      }),
    });
    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentBypassAt: new Date('2026-08-01T16:00:00.000Z'),
          paymentBypassByUserId: 'admin-1',
          paymentBypassNote: 'Director approved comped team racing access.',
        }),
      })
    );
  });

  it('requires a bypass note to issue paid racing without payment', async () => {
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.racing,
      hasFitnessMembership: null,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
    });

    await expectIssueCardFormError({
      cardNumber: '110',
      formData: formDataWithCardNumberAndPaymentBypassNote('110', 'ok'),
      formError: 'payment_required',
    });

    expect(mocks.txPaymentCreate).not.toHaveBeenCalled();
    expectNoCardIssueWrites();
  });

  it('issuing a paid card with a recorded payment does not create an admin override', async () => {
    mocks.txPaymentFindFirst.mockResolvedValue({ id: 'payment-1' });
    mocks.txSailingCardRequestFindFirst.mockResolvedValue({
      cardType: SailingCardType.racing,
      hasFitnessMembership: null,
      id: 'request-1',
      legalAgreementAcceptance: {
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
    });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await issueSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      formDataWithCardNumber('61')
    );

    expect(mocks.txPaymentCreate).not.toHaveBeenCalled();
    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          paymentBypassAt: expect.anything(),
          paymentBypassByUserId: expect.anything(),
          paymentBypassNote: expect.anything(),
        }),
      })
    );
  });

  it('does not issue when another admin already approved the request', async () => {
    mocks.txSailingCardRequestUpdateMany.mockResolvedValue({ count: 0 });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'not_pending_request',
      status: 'error',
    });

    expect(mocks.txUserUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('does not issue when another admin already updated the user card', async () => {
    mocks.txUserUpdateMany.mockResolvedValue({ count: 0 });
    const { issueSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      issueSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'not_pending_request',
      status: 'error',
    });

    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('expireSailingCardAction requires expire permission and clears yearly fields', async () => {
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 61,
      sailingCardYear: 2027,
    });
    const { expireSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expireSailingCardAction(
      'en',
      'user-1',
      { fieldErrors: {}, status: 'idle' },
      new FormData()
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.CARDS_EXPIRE,
      'en'
    );
    expect(mocks.txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardExpiresOn: null,
          sailingCardIssuedAt: null,
          sailingCardIssuedByUserId: null,
          sailingCardNumber: null,
          sailingCardRequestedAt: null,
          sailingCardSwimAgreementInitialedAt: null,
          sailingCardSwimAgreementInitials: null,
          sailingCardYear: null,
        }),
      })
    );
    expect(mocks.txUserAuditCreate).toHaveBeenCalled();
  });

  it('expireSailingCardAction refuses pending requests without an issued card', async () => {
    const { expireSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      expireSailingCardAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        new FormData()
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'no_current_card',
      status: 'error',
    });

    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('expireSailingCardAction returns not found for a deleted user', async () => {
    mocks.txUserFindUnique.mockResolvedValue(null);
    const { expireSailingCardAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      expireSailingCardAction(
        'en',
        'missing-user',
        { fieldErrors: {}, status: 'idle' },
        new FormData()
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'not_found',
      status: 'error',
    });

    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('updateSailingCardNumberAction changes an issued card number', async () => {
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-old',
      sailingCardNumber: 61,
      sailingCardYear: 2027,
    });
    const { updateSailingCardNumberAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      updateSailingCardNumberAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('62')
      )
    ).resolves.toEqual({ fieldErrors: {}, status: 'success' });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.CARDS_ASSIGN_NUMBER,
      'en'
    );
    expect(mocks.txSailingCardRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        cardYear: 2027,
        status: SailingCardRequestStatus.approved,
        userId: 'user-1',
      },
      data: {
        issuedCardNumber: 62,
      },
    });
    expect(mocks.txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        sailingCardIssuedByUserId: 'admin-old',
        sailingCardNumber: 62,
        sailingCardYear: 2027,
      }),
    });
    expect(mocks.txUserAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: UserAuditAction.update,
          auditedChanges: expect.objectContaining({
            after: expect.objectContaining({ sailingCardNumber: 62 }),
            before: expect.objectContaining({ sailingCardNumber: 61 }),
          }),
        }),
      })
    );
  });

  it('updateSailingCardNumberAction rejects the existing card number without audit', async () => {
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 61,
      sailingCardYear: 2027,
    });
    const { updateSailingCardNumberAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      updateSailingCardNumberAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('61')
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'same_card_number',
      status: 'error',
    });

    expect(mocks.txSailingCardRequestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });

  it('updateSailingCardNumberAction rejects duplicates', async () => {
    mocks.transaction.mockRejectedValue(uniqueCardError());
    const { updateSailingCardNumberAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      updateSailingCardNumberAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('62')
      )
    ).resolves.toEqual({
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    });
  });

  it('updateSailingCardNumberAction maps duplicate domain errors to the card field', async () => {
    mocks.txUserCount.mockResolvedValue(1);
    mocks.txUserFindUnique.mockResolvedValue({
      ...existingUser,
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardIssuedByUserId: 'admin-old',
      sailingCardNumber: 61,
      sailingCardYear: 2027,
    });
    const { updateSailingCardNumberAction } =
      await import('@/libs/admin/cards/adminSailingCardActions');

    await expect(
      updateSailingCardNumberAction(
        'en',
        'user-1',
        { fieldErrors: {}, status: 'idle' },
        formDataWithCardNumber('62')
      )
    ).resolves.toEqual({
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    });

    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
    expect(mocks.txUserAuditCreate).not.toHaveBeenCalled();
  });
});
