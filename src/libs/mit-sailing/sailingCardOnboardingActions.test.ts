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
import type { SailingCardOnboardingFormValues } from '@/libs/mit-sailing/sailingCardOnboardingActions';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getLocale: vi.fn(),
  lookupMitDataWarehouseIdentity: vi.fn(),
  createMembershipCheckoutUrlForOnboarding: vi.fn(),
  prismaUserFindUnique: vi.fn(),
  prismaUserUpdate: vi.fn(),
  prismaLegalAgreementAcceptanceCreate: vi.fn(),
  prismaPaymentFindFirst: vi.fn(),
  prismaSailingCardRequestCreate: vi.fn(),
  prismaSailingCardRequestFindUnique: vi.fn(),
  prismaSailingCardRequestUpdateMany: vi.fn(),
  prismaTransaction: vi.fn(),
  loggerError: vi.fn(),
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
  readonly payment: {
    readonly findFirst: typeof mocks.prismaPaymentFindFirst;
  };
  readonly sailingCardRequest: {
    readonly create: typeof mocks.prismaSailingCardRequestCreate;
    readonly findUnique: typeof mocks.prismaSailingCardRequestFindUnique;
    readonly updateMany: typeof mocks.prismaSailingCardRequestUpdateMany;
  };
  readonly user: {
    readonly update: typeof mocks.prismaUserUpdate;
  };
};

type MockOnboardingTransaction = (
  transactionClient: MockOnboardingTransactionClient
) => unknown;

type CurrentUserFixture = {
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly gymMembershipVerifiedAt: Date | null;
  readonly legalAgreementAcceptances: readonly unknown[];
  readonly phone: string | null;
  readonly sailingCardIssuedByUserId: string | null;
  readonly sailingCardNumber: number | null;
  readonly sailingCardYear: number | null;
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardRequestedAt: Date | null;
  readonly sailingCardRequests: readonly unknown[];
  readonly sailingCardSwimAgreementInitials: string | null;
  readonly sailingCardSwimAgreementInitialedAt: Date | null;
};

const baseCurrentUserFixture: CurrentUserFixture = {
  emergencyContactName: null,
  emergencyContactPhone: null,
  gymMembershipVerifiedAt: null,
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
};

const currentUserFixture = (
  overrides: Partial<CurrentUserFixture> = {}
): CurrentUserFixture => ({
  ...baseCurrentUserFixture,
  ...overrides,
});

const onboardingAcceptanceFixture = () => ({
  acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
  agreementHash: sailingCardAgreementHash(),
  agreementVersion: sailingCardAgreement.version,
});

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
    payment: {
      findFirst: mocks.prismaPaymentFindFirst,
    },
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

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
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

vi.mock(
  '@/libs/mit-sailing/membershipBilling/membershipCheckoutActions',
  () => ({
    createMembershipCheckoutUrlForOnboarding:
      mocks.createMembershipCheckoutUrlForOnboarding,
  })
);

function onboardingFormData() {
  const formData = new FormData();
  formData.set('affiliation', SailingAffiliation.MIT_STUDENT);
  formData.set('emergencyContactName', 'Grace Hopper');
  formData.set('emergencyContactPhone', '+44 20 7946 0958');
  formData.set('mitId', '123456789');
  formData.set('firstName', '');
  formData.set('hasFitnessMembership', '');
  formData.set('lastName', '');
  formData.set('phone', '(617) 555-0100');
  formData.set('cardType', SailingCardType.normal);
  formData.set('dateOfBirth', '2000-01-02');
  formData.set('swimAgreementAccepted', 'on');
  return formData;
}

const expectedOnboardingValues: SailingCardOnboardingFormValues = {
  affiliation: SailingAffiliation.MIT_STUDENT,
  cardType: SailingCardType.normal,
  dateOfBirth: '2000-01-02',
  emergencyContactName: 'Grace Hopper',
  emergencyContactPhone: '+44 20 7946 0958',
  firstName: '',
  hasFitnessMembership: '',
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

const loadSubmitSailingCardOnboardingAction = async () => {
  const actions =
    await import('@/libs/mit-sailing/sailingCardOnboardingActions');
  return actions.submitSailingCardOnboardingAction;
};

const alumOnboardingFormData = (props: {
  readonly cardType?: SailingCardType;
  readonly hasFitnessMembership: string;
}) => {
  const formData = onboardingFormData();
  formData.set('affiliation', SailingAffiliation.MIT_ALUM);
  formData.set('firstName', 'Grace');
  formData.set('hasFitnessMembership', props.hasFitnessMembership);
  formData.set('lastName', 'Hopper');
  formData.set('mitId', '');
  if (props.cardType !== undefined) {
    formData.set('cardType', props.cardType);
  }
  return formData;
};

const paidRacingOnboardingFormData = () => {
  const formData = onboardingFormData();
  formData.set('affiliation', SailingAffiliation.OTHER_NON_STUDENT);
  formData.set('cardType', SailingCardType.racing);
  formData.set('dateOfBirth', '1990-01-02');
  formData.set('firstName', 'Grace');
  formData.set('hasFitnessMembership', 'no');
  formData.set('lastName', 'Hopper');
  formData.set('mitId', '');
  return formData;
};

const expectedAlumOnboardingValues = (
  overrides: Partial<typeof expectedOnboardingValues> = {}
) => ({
  ...expectedOnboardingValues,
  affiliation: SailingAffiliation.MIT_ALUM,
  firstName: 'Grace',
  lastName: 'Hopper',
  mitId: '',
  ...overrides,
});

const expectedPaidRacingOnboardingValues = {
  ...expectedOnboardingValues,
  affiliation: SailingAffiliation.OTHER_NON_STUDENT,
  cardType: SailingCardType.racing,
  dateOfBirth: '1990-01-02',
  firstName: 'Grace',
  hasFitnessMembership: 'no',
  lastName: 'Hopper',
  mitId: '',
};

const expectAlumPaidRacingRejected = async (hasFitnessMembership: string) => {
  const submitSailingCardOnboardingAction =
    await loadSubmitSailingCardOnboardingAction();
  await expect(
    submitSailingCardOnboardingAction(
      idleState,
      alumOnboardingFormData({
        cardType: SailingCardType.racing,
        hasFitnessMembership,
      })
    )
  ).resolves.toEqual({
    fieldErrors: { cardType: 'invalid' },
    status: 'error',
    values: expectedAlumOnboardingValues({
      cardType: SailingCardType.racing,
      hasFitnessMembership,
    }),
  });

  expect(mocks.prismaTransaction).not.toHaveBeenCalled();
};

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
    mocks.prismaUserFindUnique.mockResolvedValue(currentUserFixture());
    mocks.prismaUserUpdate.mockResolvedValue({});
    mocks.prismaLegalAgreementAcceptanceCreate.mockResolvedValue({
      id: 'acceptance-1',
    });
    mocks.prismaPaymentFindFirst.mockResolvedValue(null);
    mocks.prismaSailingCardRequestCreate.mockResolvedValue({});
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue(null);
    mocks.prismaSailingCardRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.createMembershipCheckoutUrlForOnboarding.mockResolvedValue({
      status: 'created',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    mocks.prismaTransaction.mockImplementation(
      (runTransaction: MockOnboardingTransaction) =>
        runTransaction({
          user: {
            update: mocks.prismaUserUpdate,
          },
          legalAgreementAcceptance: {
            create: mocks.prismaLegalAgreementAcceptanceCreate,
          },
          payment: {
            findFirst: mocks.prismaPaymentFindFirst,
          },
          sailingCardRequest: {
            create: mocks.prismaSailingCardRequestCreate,
            findUnique: mocks.prismaSailingCardRequestFindUnique,
            updateMany: mocks.prismaSailingCardRequestUpdateMany,
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
    ).rejects.toThrow('NEXT_REDIRECT:/login?callbackUrl=%2Fonboarding');

    expect(mocks.prismaUserUpdate).not.toHaveBeenCalled();
  });

  it('verifies mit identity before the rest of onboarding is completed', async () => {
    mocks.lookupMitDataWarehouseIdentity.mockResolvedValue({
      mitId: '123456789',
      firstName: 'ADA',
      lastName: 'LOVELACE',
      kerberos: 'ada',
      classYear: '2027',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });
    const { verifySailingCardOnboardingMitIdentityAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      verifySailingCardOnboardingMitIdentityAction({
        affiliation: SailingAffiliation.MIT_STUDENT,
        mitId: '123456789',
      })
    ).resolves.toEqual({
      identity: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: '2027',
        mitId: '123456789',
      },
      ok: true,
    });
    expect(mocks.lookupMitDataWarehouseIdentity).toHaveBeenCalledWith({
      mitId: '123456789',
      verifiedKerberos: 'ada',
    });
  });

  it('redirects users with an existing current-year request to success', async () => {
    const formData = onboardingFormData();
    formData.set('callbackUrl', '/events/regatta/register');
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        sailingCardRequests: [
          {
            cardYear: 2026,
            cardType: SailingCardType.normal,
            hasFitnessMembership: true,
            legalAgreementAcceptance: {
              acceptedUserId: 'user-1',
              agreementHash: sailingCardAgreementHash(),
              agreementVersion: sailingCardAgreement.version,
              source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            },
            sailingAffiliation: SailingAffiliation.MIT_ALUM,
            status: SailingCardRequestStatus.pending,
            userId: 'user-1',
            user: {
              emergencyContactName: 'Grace Hopper',
              emergencyContactPhone: '+442079460958',
              phone: '+16175550100',
            },
          },
        ],
      })
    );
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/onboarding/success?callbackUrl=%2Fevents%2Fregatta%2Fregister'
    );

    expect(mocks.lookupMitDataWarehouseIdentity).not.toHaveBeenCalled();
    expect(mocks.prismaTransaction).not.toHaveBeenCalled();
  });

  it('starts hosted checkout for existing pending paid racing requests', async () => {
    const pendingRacingRequest = {
      cardYear: 2026,
      cardType: SailingCardType.racing,
      hasFitnessMembership: false,
      legalAgreementAcceptance: {
        acceptedUserId: 'user-1',
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
      },
      sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
      status: SailingCardRequestStatus.pending,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        gymMembershipVerifiedAt: null,
        phone: '+16175550100',
      },
    };
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        sailingCardRequests: [pendingRacingRequest],
      })
    );
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue(
      pendingRacingRequest
    );
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://checkout.stripe.com/c/pay/cs_test'
    );

    expect(mocks.createMembershipCheckoutUrlForOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        cardType: SailingCardType.racing,
        dateOfBirth: '1990-01-02',
        sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
        userId: 'user-1',
      })
    );
    expect(mocks.redirect).not.toHaveBeenCalledWith('/onboarding/success');
  });

  it('redirects already-paid pending racing requests without a second checkout', async () => {
    const pendingRacingRequest = {
      cardYear: 2026,
      cardType: SailingCardType.racing,
      hasFitnessMembership: false,
      legalAgreementAcceptance: {
        acceptedUserId: 'user-1',
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
      },
      sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
      status: SailingCardRequestStatus.pending,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        gymMembershipVerifiedAt: null,
        phone: '+16175550100',
      },
    };
    mocks.prismaPaymentFindFirst.mockResolvedValue({ id: 'payment-1' });
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        sailingCardRequests: [pendingRacingRequest],
      })
    );
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(
      mocks.createMembershipCheckoutUrlForOnboarding
    ).not.toHaveBeenCalled();
    expect(mocks.prismaTransaction).not.toHaveBeenCalled();
  });

  it('finishes onboarding from transaction-side payment recheck when pre-transaction read missed request', async () => {
    const completedRacingRequest = {
      cardYear: 2026,
      cardType: SailingCardType.racing,
      hasFitnessMembership: false,
      legalAgreementAcceptance: {
        acceptedUserId: 'user-1',
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
      },
      sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
      status: SailingCardRequestStatus.pending,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        gymMembershipVerifiedAt: null,
        phone: '+16175550100',
      },
    };
    mocks.prismaPaymentFindFirst.mockResolvedValue({ id: 'payment-1' });
    mocks.prismaUserFindUnique.mockResolvedValue(currentUserFixture());
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue(
      completedRacingRequest
    );
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(
      mocks.createMembershipCheckoutUrlForOnboarding
    ).not.toHaveBeenCalled();
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

  it('redirects to the preserved callback after successful onboarding', async () => {
    const formData = onboardingFormData();
    formData.set('callbackUrl', '/events/regatta/register');
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow('NEXT_REDIRECT:/events/regatta/register');
  });

  it('redirects unauthenticated preserved callbacks through onboarding', async () => {
    mocks.getSession.mockResolvedValue(null);
    const formData = onboardingFormData();
    formData.set('callbackUrl', '/events/regatta/register');
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Fonboarding%3FcallbackUrl%3D%252Fevents%252Fregatta%252Fregister'
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
        acceptedUserEmail: 'ada@mit.edu',
        acceptedUserId: 'user-1',
        acceptedUserName: 'Ada Lovelace',
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

  it('does not reopen a completed request that appears during submission', async () => {
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue({
      cardYear: 2026,
      legalAgreementAcceptance: {
        acceptedUserId: 'user-1',
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
      },
      status: SailingCardRequestStatus.approved,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      },
    });
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaLegalAgreementAcceptanceCreate).not.toHaveBeenCalled();
    expect(mocks.prismaUserUpdate).not.toHaveBeenCalled();
    expect(mocks.prismaSailingCardRequestCreate).not.toHaveBeenCalled();
    expect(mocks.prismaSailingCardRequestUpdateMany).not.toHaveBeenCalled();
  });

  it('does not reopen a request approved after the transaction read', async () => {
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue({
      cardYear: 2026,
      legalAgreementAcceptance: null,
      status: SailingCardRequestStatus.pending,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      },
    });
    mocks.prismaSailingCardRequestUpdateMany.mockResolvedValue({ count: 0 });
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaSailingCardRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SailingCardRequestStatus.pending,
        }),
      })
    );
    expect(mocks.prismaSailingCardRequestCreate).not.toHaveBeenCalled();
  });

  it('uses real ip when forwarded header is blank', async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        'user-agent': 'Vitest browser',
        'x-forwarded-for': '   ',
        'x-real-ip': '198.51.100.7',
      })
    );
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: '198.51.100.7',
      }),
    });
  });

  it('stores null ip without forwarding headers', async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        'user-agent': 'Vitest browser',
      })
    );
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: null,
      }),
    });
  });

  it('creates current-year onboarding request linked to exact legal acceptance', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaLegalAgreementAcceptanceCreate).toHaveBeenCalledBefore(
      mocks.prismaSailingCardRequestCreate
    );
    expect(mocks.prismaSailingCardRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardType: SailingCardType.normal,
        cardYear: 2026,
        dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
        hasFitnessMembership: null,
        legalAgreementAcceptanceId: 'acceptance-1',
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      }),
    });
  });

  it('stores no mit recreation answer for requests that need verification', async () => {
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        alumOnboardingFormData({ hasFitnessMembership: 'no' })
      )
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaSailingCardRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hasFitnessMembership: false,
        sailingAffiliation: SailingAffiliation.MIT_ALUM,
      }),
    });
  });

  it('rejects crafted paid racing when mit recreation is self-reported', async () => {
    await expectAlumPaidRacingRejected('yes');
  });

  it('rejects paid racing for verified MIT Recreation members', async () => {
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      })
    );
    await expectAlumPaidRacingRejected('no');
  });

  it('submits normal request for verified MIT Recreation members without hidden answer', async () => {
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      })
    );
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        alumOnboardingFormData({ hasFitnessMembership: '' })
      )
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaSailingCardRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardType: SailingCardType.normal,
        hasFitnessMembership: null,
        sailingAffiliation: SailingAffiliation.MIT_ALUM,
      }),
    });
  });

  it('updates pending normal request when mit recreation becomes verified', async () => {
    const pendingNormalRequest = {
      cardYear: 2026,
      cardType: SailingCardType.normal,
      hasFitnessMembership: false,
      legalAgreementAcceptance: {
        acceptedUserId: 'user-1',
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
      },
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
      status: SailingCardRequestStatus.pending,
      userId: 'user-1',
      user: {
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      },
    };
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        sailingCardRequests: [pendingNormalRequest],
      })
    );
    mocks.prismaSailingCardRequestFindUnique.mockResolvedValue(
      pendingNormalRequest
    );
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');
    const formData = onboardingFormData();
    formData.set('affiliation', SailingAffiliation.MIT_ALUM);
    formData.set('firstName', 'Grace');
    formData.set('hasFitnessMembership', 'yes');
    formData.set('lastName', 'Hopper');
    formData.set('mitId', '');

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.prismaSailingCardRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardType: SailingCardType.normal,
          hasFitnessMembership: true,
          sailingAffiliation: SailingAffiliation.MIT_ALUM,
        }),
        where: expect.objectContaining({
          cardYear: 2026,
          status: SailingCardRequestStatus.pending,
          userId: 'user-1',
        }),
      })
    );
    expect(mocks.prismaSailingCardRequestCreate).not.toHaveBeenCalled();
  });

  it('redirects successful submit to success page', async () => {
    const { submitSailingCardOnboardingAction } =
      await import('@/libs/mit-sailing/sailingCardOnboardingActions');

    await expect(
      submitSailingCardOnboardingAction(idleState, onboardingFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');
  });

  it('redirects paid racing onboarding to hosted Stripe Checkout when creation succeeds', async () => {
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://checkout.stripe.com/c/pay/cs_test'
    );

    expect(mocks.createMembershipCheckoutUrlForOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        cardType: SailingCardType.racing,
        dateOfBirth: '1990-01-02',
        email: 'ada@mit.edu',
        sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
        userId: 'user-1',
      })
    );
    expect(mocks.redirect).not.toHaveBeenCalledWith('/onboarding/success');
  });

  it('redirects without checkout when membership payment is not required', async () => {
    mocks.createMembershipCheckoutUrlForOnboarding.mockResolvedValue({
      status: 'not_eligible',
    });
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(
      mocks.createMembershipCheckoutUrlForOnboarding
    ).toHaveBeenCalledTimes(1);
  });

  it('redirects without checkout when recreation membership waives paid racing', async () => {
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00Z'),
      })
    );
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).resolves.toEqual({
      fieldErrors: { cardType: 'invalid' },
      status: 'error',
      values: expectedPaidRacingOnboardingValues,
    });

    expect(
      mocks.createMembershipCheckoutUrlForOnboarding
    ).not.toHaveBeenCalled();
  });

  it('preserves callback through paid racing checkout success', async () => {
    const formData = paidRacingOnboardingFormData();
    formData.set('callbackUrl', '/events/regatta/register');
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(idleState, formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://checkout.stripe.com/c/pay/cs_test'
    );

    const [checkoutOptions] =
      mocks.createMembershipCheckoutUrlForOnboarding.mock.calls[0] ?? [];
    if (checkoutOptions === undefined) {
      throw new Error('expected checkout creation options');
    }
    const successUrlValue: unknown = checkoutOptions.successUrl;
    if (typeof successUrlValue !== 'string') {
      throw new TypeError('expected checkout success URL');
    }
    const successUrl = new URL(successUrlValue);
    expect(successUrl.pathname).toBe('/onboarding/success');
    expect(successUrl.searchParams.get('callbackUrl')).toBe(
      '/events/regatta/register'
    );
    expect(successUrl.searchParams.get('session_id')).toBe(
      '{CHECKOUT_SESSION_ID}'
    );
  });

  it.each([
    ['unavailable', undefined],
    ['rollover blocked', { status: 'rollover_blocked' }],
  ])(
    'returns a recoverable error when paid checkout creation is %s',
    async (_name, checkoutResult) => {
      mocks.createMembershipCheckoutUrlForOnboarding.mockResolvedValue(
        checkoutResult
      );
      const submitSailingCardOnboardingAction =
        await loadSubmitSailingCardOnboardingAction();

      await expect(
        submitSailingCardOnboardingAction(
          idleState,
          paidRacingOnboardingFormData()
        )
      ).resolves.toEqual({
        fieldErrors: {},
        formError: 'membership_checkout_unavailable',
        status: 'error',
        values: expectedPaidRacingOnboardingValues,
      });

      expect(mocks.redirect).not.toHaveBeenCalledWith('/onboarding/success');
    }
  );

  it('returns a recoverable error when paid checkout creation throws', async () => {
    const error = new Error('Stripe unavailable');
    mocks.createMembershipCheckoutUrlForOnboarding.mockRejectedValue(error);
    const submitSailingCardOnboardingAction =
      await loadSubmitSailingCardOnboardingAction();

    await expect(
      submitSailingCardOnboardingAction(
        idleState,
        paidRacingOnboardingFormData()
      )
    ).resolves.toEqual({
      fieldErrors: {},
      formError: 'membership_checkout_unavailable',
      status: 'error',
      values: expectedPaidRacingOnboardingValues,
    });

    expect(mocks.redirect).not.toHaveBeenCalledWith('/onboarding/success');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[sailing-card-onboarding:membership-checkout] user_id={userId} card_type={cardType} error_name={errorName} error_code={errorCode}',
      {
        cardType: SailingCardType.racing,
        error,
        errorCode: 'unknown',
        errorName: 'Error',
        userId: 'user-1',
      }
    );
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
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        legalAgreementAcceptances: [onboardingAcceptanceFixture()],
        phone: '+16175550100',
        sailingCardIssuedByUserId: 'admin-1',
        sailingCardNumber: 61,
        sailingCardYear: 2026,
        sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
        sailingCardIssuedAt: new Date('2025-08-01T16:00:00.000Z'),
        sailingCardRequestedAt: null,
        sailingCardSwimAgreementInitials: 'AK',
        sailingCardSwimAgreementInitialedAt: new Date(
          '2025-08-01T16:00:00.000Z'
        ),
        sailingCardRequests: [],
      })
    );
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
    mocks.prismaUserFindUnique.mockResolvedValue(
      currentUserFixture({
        emergencyContactName: null,
        emergencyContactPhone: null,
        legalAgreementAcceptances: [onboardingAcceptanceFixture()],
        phone: null,
        sailingCardIssuedByUserId: 'admin-1',
        sailingCardNumber: 61,
        sailingCardYear: 2026,
        sailingCardExpiresOn: expiresOn,
        sailingCardIssuedAt: issuedAt,
        sailingCardRequestedAt: null,
        sailingCardRequests: [],
        sailingCardSwimAgreementInitials: 'AK',
        sailingCardSwimAgreementInitialedAt: new Date(
          '2025-08-01T16:00:00.000Z'
        ),
      })
    );
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
    expect(mocks.prismaSailingCardRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
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
