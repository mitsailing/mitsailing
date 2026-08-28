import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getI18nPath: vi.fn((path: string) => path),
  getTranslations: vi.fn(),
  listUserPayments: vi.fn(),
  membershipAccessForSailingCardUser: vi.fn(),
  membershipProfileState: vi.fn(),
  paymentFindFirst: vi.fn(),
  ProfileMembershipBillingView: vi.fn(() => (
    <div data-testid="profile-membership-view" />
  )),
  ProfilePaymentsView: vi.fn(() => <div data-testid="profile-payments-view" />),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/auth/profile/ProfilePaymentsView', () => ({
  ProfilePaymentsView: mocks.ProfilePaymentsView,
}));

vi.mock(
  '@/components/mit-sailing/profile/ProfileMembershipBillingView',
  () => ({
    ProfileMembershipBillingView: mocks.ProfileMembershipBillingView,
  })
);

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

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

vi.mock('@/libs/mit-sailing/userPaymentQueries', () => ({
  listUserPayments: mocks.listUserPayments,
}));

vi.mock('@/libs/mit-sailing/membershipBilling/membershipProfileState', () => ({
  membershipProfileState: mocks.membershipProfileState,
}));

vi.mock('@/libs/mit-sailing/sailingCardMembershipEligibility', () => ({
  membershipAccessForSailingCardUser: mocks.membershipAccessForSailingCardUser,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: mocks.getI18nPath,
}));

const latestPayment = {
  amountCents: 12_000,
  amountPaidCents: null,
  cardType: 'racing',
  cardYear: 2026,
  id: 'payment-1',
  issueKind: null,
  source: 'stripe',
  status: 'paid',
  stripeReceiptUrl: 'https://pay.stripe.test/receipt',
};

function params() {
  return { locale: 'en' };
}

describe('ProfilePaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.listUserPayments.mockResolvedValue([{ id: 'payment-1' }]);
    mocks.requireCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('loads the signed-in user payments for the profile view', async () => {
    const { default: ProfilePaymentsPage } = await import('./payments/page');

    render(await ProfilePaymentsPage({ params: Promise.resolve(params()) }));

    expect(mocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile/payments'
    );
    expect(mocks.listUserPayments).toHaveBeenCalledWith('user-1');
    expect(mocks.ProfilePaymentsView).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        payments: [{ id: 'payment-1' }],
      }),
      undefined
    );
  });

  it('builds payments metadata from profile translations', async () => {
    const { generateMetadata } = await import('./payments/page');

    await expect(
      generateMetadata({ params: Promise.resolve(params()) })
    ).resolves.toEqual({
      description: 'payments_meta_description',
      title: 'payments_meta_title',
    });
  });
});

describe('ProfileMembershipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.membershipAccessForSailingCardUser.mockReturnValue({
      kind: 'free_normal',
    });
    mocks.membershipProfileState.mockReturnValue({
      accessThrough: new Date('2026-05-20T16:00:00.000Z'),
      amountCents: 12_000,
      cardType: 'racing',
      kind: 'active_paid',
      receiptUrl: 'https://pay.stripe.test/receipt',
    });
    mocks.paymentFindFirst.mockResolvedValue(latestPayment);
    mocks.requireCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.userFindUnique.mockResolvedValue({
      gymMembershipVerifiedAt: null,
      sailingAffiliation: 'student',
    });
  });

  it('derives membership billing props from the latest payment', async () => {
    const { default: ProfileMembershipPage } =
      await import('./membership/page');

    render(await ProfileMembershipPage({ params: Promise.resolve(params()) }));

    expect(mocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile/membership'
    );
    expect(mocks.paymentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      })
    );
    expect(mocks.membershipProfileState).toHaveBeenCalledWith({
      access: 'free_normal',
      cardYear: expect.any(Number),
      latestPayment,
    });
    expect(mocks.ProfileMembershipBillingView).toHaveBeenCalledWith(
      expect.objectContaining({
        accessThroughLabel: 'May 20, 2026',
        amountCents: 12_000,
        kind: 'active_paid',
      }),
      undefined
    );
  });

  it('renders a null access date when membership access has no end date', async () => {
    mocks.membershipProfileState.mockReturnValue({
      accessThrough: null,
      amountCents: null,
      cardType: null,
      kind: 'no_paid_membership',
      receiptUrl: null,
    });
    const { default: ProfileMembershipPage } =
      await import('./membership/page');

    render(await ProfileMembershipPage({ params: Promise.resolve(params()) }));

    expect(mocks.ProfileMembershipBillingView).toHaveBeenCalledWith(
      expect.objectContaining({
        accessThroughLabel: null,
        kind: 'no_paid_membership',
      }),
      undefined
    );
  });

  it('uses paid racing access when the user is not covered by free normal membership', async () => {
    mocks.membershipAccessForSailingCardUser.mockReturnValue({
      kind: 'paid_racing_available',
    });
    const { default: ProfileMembershipPage } =
      await import('./membership/page');

    render(await ProfileMembershipPage({ params: Promise.resolve(params()) }));

    expect(mocks.membershipProfileState).toHaveBeenCalledWith({
      access: 'paid_racing_available',
      cardYear: expect.any(Number),
      latestPayment,
    });
  });

  it('passes null payment state when no membership payment exists', async () => {
    mocks.paymentFindFirst.mockResolvedValue(null);
    const { default: ProfileMembershipPage } =
      await import('./membership/page');

    render(await ProfileMembershipPage({ params: Promise.resolve(params()) }));

    expect(mocks.membershipProfileState).toHaveBeenCalledWith({
      access: 'free_normal',
      cardYear: expect.any(Number),
      latestPayment: null,
    });
  });

  it('throws when auth succeeds but the database user is missing', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const { default: ProfileMembershipPage } =
      await import('./membership/page');

    await expect(
      ProfileMembershipPage({ params: Promise.resolve(params()) })
    ).rejects.toThrow('Missing db user after auth');
  });

  it('builds membership metadata from profile translations', async () => {
    const { generateMetadata } = await import('./membership/page');

    await expect(
      generateMetadata({ params: Promise.resolve(params()) })
    ).resolves.toEqual({
      description: 'membership_meta_description',
      title: 'membership_meta_title',
    });
  });
});
