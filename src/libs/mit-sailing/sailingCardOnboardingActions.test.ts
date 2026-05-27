import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LegalAgreementAcceptanceSource,
  MitDataWarehousePersonType,
  SailingAffiliation,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import type * as MitDataWarehouseModule from '@/libs/mit-sailing/mitDataWarehouse';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getLocale: vi.fn(),
  lookupMitDataWarehouseIdentity: vi.fn(),
  prismaUserFindUnique: vi.fn(),
  prismaUserUpdate: vi.fn(),
  prismaLegalAgreementAcceptanceCreate: vi.fn(),
  prismaSailingCardRequestUpsert: vi.fn(),
  prismaTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  headers: vi.fn(),
}));

type MockOnboardingTransactionClient = {
  readonly legalAgreementAcceptance: {
    readonly create: typeof mocks.prismaLegalAgreementAcceptanceCreate;
  };
  readonly sailingCardRequest: {
    readonly upsert: typeof mocks.prismaSailingCardRequestUpsert;
  };
  readonly user: {
    readonly update: typeof mocks.prismaUserUpdate;
  };
};

type MockOnboardingTransaction = (
  transactionClient: MockOnboardingTransactionClient
) => unknown;

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next-intl/server', () => ({
  getLocale: mocks.getLocale,
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique: mocks.prismaUserFindUnique,
      update: mocks.prismaUserUpdate,
    },
    legalAgreementAcceptance: {
      create: mocks.prismaLegalAgreementAcceptanceCreate,
    },
    $transaction: mocks.prismaTransaction,
  },
}));

vi.mock('@/libs/mit-sailing/mitDataWarehouse', async () => {
  const actual = await vi.importActual<typeof MitDataWarehouseModule>(
    '@/libs/mit-sailing/mitDataWarehouse'
  );

  return {
    ...actual,
    lookupMitDataWarehouseIdentity: mocks.lookupMitDataWarehouseIdentity,
  };
});

function onboardingFormData() {
  const formData = new FormData();
  formData.set('affiliation', SailingAffiliation.MIT_STUDENT);
  formData.set('emergencyContactName', 'Grace Hopper');
  formData.set('emergencyContactPhone', '+44 20 7946 0958');
  formData.set('mitId', '123456789');
  formData.set('firstName', '');
  formData.set('lastName', '');
  formData.set('phone', '(617) 555-0100');
  formData.set('cardType', SailingCardType.normal);
  formData.set('dateOfBirth', '2000-01-02');
  formData.set('swimAgreementAccepted', 'on');
  return formData;
}

const expectedOnboardingValues = {
  affiliation: SailingAffiliation.MIT_STUDENT,
  cardType: SailingCardType.normal,
  dateOfBirth: '2000-01-02',
  emergencyContactEmail: '',
  emergencyContactName: 'Grace Hopper',
  emergencyContactPhone: '+44 20 7946 0958',
  firstName: '',
  lastName: '',
  mitId: '123456789',
  phone: '(617) 555-0100',
  swimAgreementAccepted: true,
};

const idleState = {
  fieldErrors: {},
  status: 'idle',
  values: expectedOnboardingValues,
} as const;

describe('submitSailingCardOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocale.mockResolvedValue('en');
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'ada@mit.edu',
        emailVerified: true,
      },
    });
    mocks.lookupMitDataWarehouseIdentity.mockResolvedValue({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: '2027',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });
    mocks.prismaUserFindUnique.mockResolvedValue({
      emergencyContactName: null,
      emergencyContactPhone: null,
      legalAgreementAcceptances: [],
      phone: null,
      sailingCardIssuedByUserId: null,
      sailingCardNumber: null,
      sailingCardYear: null,
      sailingCardExpiresOn: null,
      sailingCardIssuedAt: null,
      sailingCardRequestedAt: null,
      sailingCardRequests: [],
      sailingCardSwimAgreementInitials: null,
      sailingCardSwimAgreementInitialedAt: null,
    });
    mocks.prismaUserUpdate.mockResolvedValue({});
    mocks.prismaLegalAgreementAcceptanceCreate.mockResolvedValue({
      id: 'acceptance-1',
    });
    mocks.prismaSailingCardRequestUpsert.mockResolvedValue({});
    mocks.prismaTransaction.mockImplementation(
      (runTransaction: MockOnboardingTransaction) =>
        runTransaction({
          user: {
            update: mocks.prismaUserUpdate,
          },
          legalAgreementAcceptance: {
            create: mocks.prismaLegalAgreementAcceptanceCreate,
          },
          sailingCardRequest: {
            upsert: mocks.prismaSailingCardRequestUpsert,
          },
        })
    );
    mocks.headers.mockResolvedValue(
      new Headers({
        'user-agent': 'Vitest browser',
        'x-forwarded-for': '203.0.113.10, 198.51.100.5',
      })
    );
  });

  it('redirects unauthenticated users to login', async () => {
    mocks.getSession.mockResolvedValue(null);
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/login?callbackUrl=/onboarding');

    expect(mocks.prismaUserUpdate).not.toHaveBeenCalled();
  });

  it('updates only the current user', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emergencyContactName: 'Grace Hopper',
          emergencyContactPhone: '+442079460958',
          phone: '+16175550100',
        }),
        where: { id: 'user-1' },
      })
    );
    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          sailingCardExpiresOn: null,
          sailingCardIssuedAt: null,
          sailingCardIssuedByUserId: null,
          sailingCardNumber: null,
          sailingCardYear: null,
        }),
      })
    );
  });

  it('creates onboarding legal acceptance evidence in the same transaction', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acceptedAt: expect.any(Date),
        agreementHash: sailingCardAgreementHash(),
        agreementLabel: sailingCardAgreement.label,
        agreementVersion: sailingCardAgreement.version,
        ipAddress: '203.0.113.10',
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        sourceRecordId: null,
        userAgent: 'Vitest browser',
        userId: 'user-1',
      }),
    });
  });

  it('upserts current-year onboarding request linked to exact legal acceptance', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledBefore(
      mocks.prismaSailingCardRequestUpsert
    );
    expect(mocks.prismaSailingCardRequestUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        cardType: SailingCardType.normal,
        cardYear: 2026,
        dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
        legalAgreementAcceptanceId: 'acceptance-1',
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      }),
      update: expect.objectContaining({
        cardType: SailingCardType.normal,
        dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
        legalAgreementAcceptanceId: 'acceptance-1',
      }),
      where: {
        userId_cardYear: {
          cardYear: 2026,
          userId: 'user-1',
        },
      },
    });
  });

  it('redirects successful submit to success page', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');
  });

  it('returns validation errors without crashing the page', async () => {
    mocks.lookupMitDataWarehouseIdentity.mockResolvedValue(null);
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).resolves.toEqual({
      fieldErrors: { mitId: 'required_dw_identity' },
      status: 'error',
      values: expectedOnboardingValues,
    });

    expect(mocks.prismaUserUpdate).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalledWith('/onboarding/success');
  });

  it('returns affiliation required for blank and invalid affiliations', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    const blankFormData = onboardingFormData();
    blankFormData.set('affiliation', '');
    await expect(
      submitSailingCardOnboardingAction(idleState, blankFormData)
    ).resolves.toEqual({
      fieldErrors: { affiliation: 'required' },
      status: 'error',
      values: {
        ...expectedOnboardingValues,
        affiliation: '',
      },
    });

    const invalidFormData = onboardingFormData();
    invalidFormData.set('affiliation', 'NOT_A_SCHOOL');
    await expect(
      submitSailingCardOnboardingAction(idleState, invalidFormData)
    ).resolves.toEqual({
      fieldErrors: { affiliation: 'required' },
      status: 'error',
      values: {
        ...expectedOnboardingValues,
        affiliation: 'NOT_A_SCHOOL',
      },
    });
  });

  it('rejects hidden non-mit affiliation posts', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');
    const formData = onboardingFormData();
    formData.set('affiliation', SailingAffiliation.NON_MIT);

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).resolves.toEqual({
      fieldErrors: { affiliation: 'required' },
      status: 'error',
      values: {
        ...expectedOnboardingValues,
        affiliation: SailingAffiliation.NON_MIT,
      },
    });
  });

  it('requires the agreement checkbox', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');
    const formData = onboardingFormData();
    formData.delete('swimAgreementAccepted');

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).resolves.toEqual({
      fieldErrors: { swimAgreementAccepted: 'required' },
      status: 'error',
      values: {
        ...expectedOnboardingValues,
        swimAgreementAccepted: false,
      },
    });
  });

  it('does not clear an existing current card from direct action post', async () => {
    mocks.prismaUserFindUnique.mockResolvedValue({
      emergencyContactName: 'Grace Hopper',
      emergencyContactPhone: '+442079460958',
      legalAgreementAcceptances: [
        {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
        },
      ],
      phone: '+16175550100',
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 61,
      sailingCardYear: 2026,
      sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2025-08-01T16:00:00.000Z'),
      sailingCardRequestedAt: null,
      sailingCardSwimAgreementInitials: 'AK',
      sailingCardSwimAgreementInitialedAt: new Date('2025-08-01T16:00:00.000Z'),
      sailingCardRequests: [],
    });
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          sailingCardExpiresOn: null,
          sailingCardIssuedAt: null,
          sailingCardIssuedByUserId: null,
          sailingCardNumber: null,
          sailingCardYear: null,
        }),
      })
    );
  });

  it('preserves current card while saving missing contact fields', async () => {
    const issuedAt = new Date('2025-08-01T16:00:00.000Z');
    const expiresOn = new Date('2026-07-15T04:00:00.000Z');
    mocks.prismaUserFindUnique.mockResolvedValue({
      emergencyContactName: null,
      emergencyContactPhone: null,
      legalAgreementAcceptances: [
        {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
        },
      ],
      phone: null,
      sailingCardIssuedByUserId: 'admin-1',
      sailingCardNumber: 61,
      sailingCardYear: 2026,
      sailingCardExpiresOn: expiresOn,
      sailingCardIssuedAt: issuedAt,
      sailingCardRequestedAt: null,
      sailingCardRequests: [],
      sailingCardSwimAgreementInitials: 'AK',
      sailingCardSwimAgreementInitialedAt: new Date('2025-08-01T16:00:00.000Z'),
    });
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emergencyContactName: 'Grace Hopper',
          emergencyContactPhone: '+442079460958',
          phone: '+16175550100',
        }),
      })
    );
    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          sailingCardExpiresOn: expect.anything(),
          sailingCardIssuedAt: expect.anything(),
          sailingCardIssuedByUserId: expect.anything(),
          sailingCardNumber: expect.anything(),
          sailingCardYear: expect.anything(),
        }),
      })
    );
    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        userId: 'user-1',
      }),
    });
    expect(mocks.prismaSailingCardRequestUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          approvedAt: null,
          approvedByUserId: null,
          issuedCardNumber: null,
        }),
      })
    );
  });

  it('does not inspect admin permissions while submitting onboarding', async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'ada@mit.edu',
        emailVerified: true,
        appRole: 'admin',
      },
    });
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
      })
    );
  });
});
