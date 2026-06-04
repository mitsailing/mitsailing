import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentStatus,
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  findUser: vi.fn(),
  findPayment: vi.fn(),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
  stripeCheckoutSessionRetrieve: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock(
  '@/components/mit-sailing/onboarding/SailingCardOnboardingForm',
  () => ({
    SailingCardOnboardingForm: (props: {
      callbackUrl?: string;
      initialMembershipCheckoutUrl?: string | null;
      initialValues?: unknown;
      lockedIdentity?: unknown;
    }) => (
      <section
        data-callback-url={props.callbackUrl}
        data-initial-membership-checkout-url={
          props.initialMembershipCheckoutUrl ?? ''
        }
        data-initial-values={JSON.stringify(props.initialValues)}
        data-locked-identity={JSON.stringify(props.lockedIdentity ?? null)}
        data-testid="onboarding-form"
      />
    ),
  })
);

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }) => (
    <main>{props.children}</main>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: {
    children: React.ReactNode;
    locale: string;
    segments: readonly unknown[];
  }) => (
    <div
      data-locale={props.locale}
      data-segment-count={props.segments.length}
      data-testid="site-section-shell"
    >
      {props.children}
    </div>
  ),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      findFirst: mocks.findPayment,
    },
    user: {
      findUnique: mocks.findUser,
    },
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/stripe/stripeClient', () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: mocks.stripeCheckoutSessionRetrieve,
      },
    },
  }),
}));

function completedRequest(
  userId = 'user-1',
  cardType: SailingCardType = SailingCardType.normal
) {
  return {
    cardYear: 2027,
    cardType,
    hasFitnessMembership: null,
    legalAgreementAcceptance: {
      agreementHash: sailingCardAgreementHash(),
      agreementVersion: sailingCardAgreement.version,
      source: 'SAILING_CARD_ONBOARDING',
      userId,
    },
    sailingAffiliation: SailingAffiliation.MIT_ALUM,
    status: 'pending',
    user: {
      emergencyContactName: 'Grace Hopper',
      emergencyContactPhone: '617-555-0100',
      gymMembershipVerifiedAt: null,
      phone: '617-555-0199',
    },
    userId,
  };
}

function onboardingUser() {
  return {
    emergencyContactName: 'Grace Hopper',
    emergencyContactPhone: '617-555-0100',
    firstName: 'Ada',
    lastName: 'Lovelace',
    mitClassYear: '2027',
    mitDataWarehouseVerifiedAt: new Date('2026-05-21T16:00:00.000Z'),
    mitId: '123456789',
    phone: '617-555-0199',
    sailingAffiliation: SailingAffiliation.MIT_STUDENT,
    sailingCardRequests: [],
  };
}

function mockPaidCompletedRequest() {
  mocks.findUser.mockResolvedValue({
    sailingCardRequests: [
      completedRequest('user-1', SailingCardType.team_racing),
    ],
  });
  mocks.findPayment.mockResolvedValue({
    status: PaymentStatus.checkout_created,
    stripeCheckoutSessionExpiresAt: new Date('2026-08-01T18:00:00.000Z'),
    stripeCheckoutSessionId: 'cs_paid',
    stripeCheckoutSessionUrl: 'https://checkout.stripe.com/c/pay/cs_paid',
  });
  mocks.stripeCheckoutSessionRetrieve.mockResolvedValue({
    payment_status: 'paid',
    status: 'complete',
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.setSystemTime(new Date('2026-08-01T12:00:00-04:00'));
  mocks.connection.mockReset();
  mocks.findPayment.mockReset();
  mocks.findUser.mockReset();
  mocks.getTranslations.mockClear();
  mocks.redirect.mockClear();
  mocks.requireCurrentUser.mockReset();
  mocks.setRequestLocale.mockClear();
  mocks.stripeCheckoutSessionRetrieve.mockReset();

  mocks.connection.mockReturnValue(Promise.resolve());
  mocks.findPayment.mockResolvedValue(null);
  mocks.findUser.mockResolvedValue(onboardingUser());
  mocks.requireCurrentUser.mockResolvedValue({
    id: 'user-1',
    role: Role.USER,
  });
  mocks.stripeCheckoutSessionRetrieve.mockResolvedValue({
    payment_status: 'unpaid',
    status: 'open',
  });
});

describe('onboarding pages', () => {
  it('renders onboarding form with safe callback and prefilled locked identity', async () => {
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          callbackUrl: '/events/frostbite/register',
        }),
      })
    );

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireCurrentUser).toHaveBeenCalledWith('en', '/onboarding');
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-callback-url',
      '/events/frostbite/register'
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      expect.stringContaining('"firstName":"Ada"')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      expect.stringContaining('"affiliation":"MIT_STUDENT"')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      expect.stringContaining('"dateOfBirth":""')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-locked-identity',
      expect.stringContaining('"mitClassYear":"2027"')
    );
  });

  it('drops unsafe onboarding callback urls before rendering the form', async () => {
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          callbackUrl: 'https://evil.example/phish',
        }),
      })
    );

    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-callback-url',
      ''
    );
  });

  it('does not lock identity when warehouse identity is incomplete', async () => {
    mocks.findUser.mockResolvedValue({
      ...onboardingUser(),
      firstName: '',
      mitDataWarehouseVerifiedAt: null,
    });
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-locked-identity',
      'null'
    );
  });

  it('renders blank onboarding defaults when the profile row is missing', async () => {
    mocks.findUser.mockResolvedValue(null);
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-values',
      JSON.stringify({
        affiliation: '',
        cardType: 'normal',
        dateOfBirth: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        firstName: '',
        hasFitnessMembership: '',
        lastName: '',
        mitId: '',
        phone: '',
        swimAgreementAccepted: false,
      })
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-locked-identity',
      'null'
    );
  });

  it('redirects completed current-year onboarding away from the form', async () => {
    mocks.findUser.mockResolvedValue({
      ...onboardingUser(),
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingPage } = await import('./page');

    await expect(
      OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/success');

    expect(mocks.redirect).toHaveBeenCalledWith('/onboarding/success');
  });

  it('renders onboarding with a payment action instead of redirecting pending paid users to Stripe', async () => {
    mocks.findPayment.mockResolvedValue({
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionExpiresAt: new Date('2026-08-01T18:00:00.000Z'),
      stripeCheckoutSessionUrl: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    mocks.findUser.mockResolvedValue({
      ...onboardingUser(),
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mocks.redirect).not.toHaveBeenCalledWith(
      expect.stringContaining('checkout.stripe.com')
    );
    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-membership-checkout-url',
      'https://checkout.stripe.com/c/pay/cs_test'
    );
  });

  it('renders the Stripe checkout resume link after checkout cancellation', async () => {
    mocks.findPayment.mockResolvedValue({
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionExpiresAt: new Date('2026-08-01T18:00:00.000Z'),
      stripeCheckoutSessionUrl: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    mocks.findUser.mockResolvedValue({
      ...onboardingUser(),
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingPage } = await import('./page');

    render(
      await OnboardingPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ checkout: 'cancelled' }),
      })
    );

    expect(screen.getByTestId('onboarding-form')).toHaveAttribute(
      'data-initial-membership-checkout-url',
      'https://checkout.stripe.com/c/pay/cs_test'
    );
  });

  it('redirects success page back to onboarding without a completed request', async () => {
    mocks.findUser.mockResolvedValue({ sailingCardRequests: [] });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    await expect(
      OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding');

    expect(mocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/onboarding/success'
    );
  });

  it('renders success actions for normal users without the admin link', async () => {
    mocks.findUser.mockResolvedValue({
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByRole('link', { name: 'events_link' })).toHaveAttribute(
      'href',
      '/events'
    );
    expect(
      screen.queryByRole('link', { name: 'admin_link' })
    ).not.toBeInTheDocument();
  });

  it('shows a finish-payment action for pending paid onboarding', async () => {
    mocks.findUser.mockResolvedValue({
      sailingCardRequests: [completedRequest('user-1', SailingCardType.racing)],
    });
    mocks.findPayment.mockResolvedValue({
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionExpiresAt: new Date('2026-08-01T18:00:00.000Z'),
      stripeCheckoutSessionId: 'cs_test',
      stripeCheckoutSessionUrl: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'payment_required_title' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'finish_payment_link' })
    ).toHaveAttribute('href', 'https://checkout.stripe.com/c/pay/cs_test');
    expect(
      screen.queryByRole('link', { name: 'events_link' })
    ).not.toBeInTheDocument();
  });

  it('does not show payment required for completed normal card requests', async () => {
    mocks.findUser.mockResolvedValue({
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.queryByRole('heading', { name: 'payment_required_title' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'paid_title' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    expect(mocks.findPayment).not.toHaveBeenCalled();
  });

  it('does not ask covered users to pay for stale paid card requests', async () => {
    mocks.findUser.mockResolvedValue({
      sailingCardRequests: [
        {
          ...completedRequest('user-1', SailingCardType.racing),
          sailingAffiliation: SailingAffiliation.MIT_STUDENT,
        },
      ],
    });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.queryByRole('heading', { name: 'payment_required_title' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'paid_title' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    expect(mocks.findPayment).not.toHaveBeenCalled();
  });

  it('renders paid success only when the returned Checkout session is paid', async () => {
    mockPaidCompletedRequest();
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          callbackUrl: '/events/regatta/register',
          session_id: 'cs_paid',
        }),
      })
    );

    expect(mocks.stripeCheckoutSessionRetrieve).toHaveBeenCalledWith('cs_paid');
    expect(
      screen.getByRole('heading', { name: 'paid_title' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'events_link' })).toHaveAttribute(
      'href',
      '/events/regatta/register'
    );
  });

  it('falls back from unsafe paid success callbacks', async () => {
    mockPaidCompletedRequest();
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          callbackUrl: 'https://evil.example/phish',
          session_id: 'cs_paid',
        }),
      })
    );

    expect(mocks.stripeCheckoutSessionRetrieve).toHaveBeenCalledWith('cs_paid');
    expect(screen.getByRole('link', { name: 'events_link' })).toHaveAttribute(
      'href',
      '/events'
    );
  });

  it('renders the admin success link only for admin users', async () => {
    mocks.requireCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: Role.ADMIN,
    });
    mocks.findUser.mockResolvedValue({
      sailingCardRequests: [completedRequest()],
    });
    const { default: OnboardingSuccessPage } = await import('./success/page');

    render(
      await OnboardingSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByRole('link', { name: 'admin_link' })).toHaveAttribute(
      'href',
      '/admin'
    );
  });

  it('uses translated metadata for onboarding pages', async () => {
    const onboardingPage = await import('./page');
    const successPage = await import('./success/page');

    await expect(
      onboardingPage.generateMetadata({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    ).resolves.toEqual({
      description: 'meta_description',
      title: 'meta_title',
    });
    await expect(
      successPage.generateMetadata({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).resolves.toEqual({ title: 'meta_title' });
  });
});
