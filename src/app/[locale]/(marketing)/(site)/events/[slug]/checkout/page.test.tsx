import { render } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  createEventPaymentCheckoutClientSecretAction: vi.fn(async () => {}),
  Env: {
    IS_E2E: undefined as string | undefined,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined as string | undefined,
  },
  EventPaymentCheckout: vi.fn((props: EventPaymentCheckoutProps) => (
    <div data-testid="event-checkout">{props.title}</div>
  )),
  eventPaymentCheckoutIsPayable: vi.fn(),
  getEventPaymentCheckoutPageData: vi.fn(),
  getI18nPath: vi.fn((path: string) => path),
  getTranslations: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/server', () => ({ connection: mocks.connection }));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/events/EventPaymentCheckout', () => ({
  EventPaymentCheckout: mocks.EventPaymentCheckout,
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }) => (
    <main>{props.children}</main>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }) => (
    <div data-testid="site-shell">{props.children}</div>
  ),
}));

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.Env,
}));

vi.mock('@/libs/mit-sailing/eventPaymentCheckoutActions', () => ({
  createEventPaymentCheckoutClientSecretAction:
    mocks.createEventPaymentCheckoutClientSecretAction,
}));

vi.mock('@/libs/mit-sailing/eventPaymentCheckoutQueries', () => ({
  eventPaymentCheckoutIsPayable: mocks.eventPaymentCheckoutIsPayable,
  getEventPaymentCheckoutPageData: mocks.getEventPaymentCheckoutPageData,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: mocks.getI18nPath,
}));

const checkoutData = {
  event: {
    name: 'Firefly Clinic',
    slug: 'firefly-clinic',
  },
  payment: {
    amountCents: 2500,
    id: 'payment-1',
    receiptUrl: 'https://pay.stripe.test/receipt',
    status: 'pending',
  },
};

type EventPaymentCheckoutProps = {
  clientSecretAction: () => Promise<void>;
  payment: {
    amount: string;
    receiptUrl: string | null;
    status: string;
    statusLabel: string;
  } | null;
  publishableKey?: string;
  title: string;
};

function params(slug = 'firefly-clinic') {
  return { locale: 'en', slug };
}

function t(key: string, values?: { event?: string }) {
  if (key === 'checkout_title' && values?.event) {
    return `Checkout for ${values.event}`;
  }
  return `MitSailingEvents.${key}`;
}

function lastCheckoutProps() {
  const lastCall = mocks.EventPaymentCheckout.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error('Expected the checkout component to render.');
  }
  const [checkoutProps] = lastCall;
  return checkoutProps;
}

describe('EventCheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.Env.IS_E2E = undefined;
    mocks.Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = undefined;
    mocks.eventPaymentCheckoutIsPayable.mockReturnValue(true);
    mocks.getEventPaymentCheckoutPageData.mockResolvedValue(checkoutData);
    mocks.getTranslations.mockResolvedValue(t);
    mocks.requireCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('passes payable payment state and E2E Stripe fallback to checkout', async () => {
    mocks.Env.IS_E2E = '1';
    const { default: EventCheckoutPage } = await import('./page');

    render(await EventCheckoutPage({ params: Promise.resolve(params()) }));

    expect(mocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/events/firefly-clinic/checkout'
    );
    expect(mocks.getEventPaymentCheckoutPageData).toHaveBeenCalledWith(
      'firefly-clinic',
      'user-1'
    );
    const checkoutProps = lastCheckoutProps();
    expect(checkoutProps).toMatchObject({
      payment: {
        amount: '$25.00',
        receiptUrl: 'https://pay.stripe.test/receipt',
        status: 'pending',
        statusLabel: 'MitSailingEvents.checkout_payment_status_pending',
      },
      publishableKey: 'pk_test_e2e_mock',
      title: 'Checkout for Firefly Clinic',
    });
    await checkoutProps.clientSecretAction();
    expect(
      mocks.createEventPaymentCheckoutClientSecretAction
    ).toHaveBeenCalledWith('en', 'firefly-clinic', 'payment-1');
  });

  it('does not bind a payment id when the payment is not payable', async () => {
    mocks.Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_configured';
    mocks.eventPaymentCheckoutIsPayable.mockReturnValue(false);
    const { default: EventCheckoutPage } = await import('./page');

    render(await EventCheckoutPage({ params: Promise.resolve(params()) }));

    const checkoutProps = lastCheckoutProps();
    expect(checkoutProps.publishableKey).toBe('pk_test_configured');
    await checkoutProps.clientSecretAction();
    expect(
      mocks.createEventPaymentCheckoutClientSecretAction
    ).toHaveBeenCalledWith('en', 'firefly-clinic', '');
  });

  it('renders no-payment checkout state without creating a payable session', async () => {
    mocks.getEventPaymentCheckoutPageData.mockResolvedValue({
      event: checkoutData.event,
      payment: null,
    });
    const { default: EventCheckoutPage } = await import('./page');

    render(await EventCheckoutPage({ params: Promise.resolve(params()) }));

    const checkoutProps = lastCheckoutProps();
    expect(checkoutProps.payment).toBeNull();
    expect(checkoutProps.publishableKey).toBeUndefined();
    await checkoutProps.clientSecretAction();
    expect(
      mocks.createEventPaymentCheckoutClientSecretAction
    ).toHaveBeenCalledWith('en', 'firefly-clinic', '');
  });

  it('returns not found when no checkout data exists for the user', async () => {
    mocks.getEventPaymentCheckoutPageData.mockResolvedValue(null);
    const { default: EventCheckoutPage } = await import('./page');

    await expect(
      EventCheckoutPage({ params: Promise.resolve(params('missing-event')) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('builds translated checkout metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve(params()) })
    ).resolves.toEqual({
      title: 'MitSailingEvents.checkout_meta_title',
    });
  });
});
