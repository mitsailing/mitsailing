import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => ({
  adminPaymentStatusFromParam: vi.fn(),
  AdminPaymentsLedgerView: vi.fn(() => (
    <div data-testid="admin-payments-ledger" />
  )),
  Env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined as string | undefined,
    STRIPE_SECRET_KEY: undefined as string | undefined,
    STRIPE_WEBHOOK_SECRET: undefined as string | undefined,
  },
  getTranslations: vi.fn(),
  listAdminPaymentLedgerData: vi.fn(),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock(
  '@/components/mit-sailing/admin/payments/AdminPaymentsLedgerView',
  () => ({
    AdminPaymentsLedgerView: mocks.AdminPaymentsLedgerView,
  })
);

vi.mock('@/libs/admin/payments/adminPaymentQueries', () => ({
  adminPaymentStatusFromParam: mocks.adminPaymentStatusFromParam,
  listAdminPaymentLedgerData: mocks.listAdminPaymentLedgerData,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.Env,
}));

function params() {
  return { locale: 'en' };
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = undefined;
    mocks.Env.STRIPE_SECRET_KEY = undefined;
    mocks.Env.STRIPE_WEBHOOK_SECRET = undefined;
    mocks.adminPaymentStatusFromParam.mockReturnValue('paid');
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.listAdminPaymentLedgerData.mockResolvedValue({
      payments: [{ id: 'payment-1' }],
      summary: { totalAmountCents: 2500 },
    });
  });

  it('requires payment permission and passes normalized filters to the ledger', async () => {
    mocks.Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_configured';
    mocks.Env.STRIPE_SECRET_KEY = 'stripe_secret_configured';
    mocks.Env.STRIPE_WEBHOOK_SECRET = 'stripe_webhook_configured';
    const { default: AdminPaymentsPage } = await import('./page');

    render(
      await AdminPaymentsPage({
        params: Promise.resolve(params()),
        searchParams: Promise.resolve({ q: 'sailor', status: 'paid' }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.PAYMENTS_VIEW,
      'en'
    );
    expect(mocks.adminPaymentStatusFromParam).toHaveBeenCalledWith('paid');
    expect(mocks.listAdminPaymentLedgerData).toHaveBeenCalledWith({
      query: 'sailor',
      status: 'paid',
    });
    expect(mocks.AdminPaymentsLedgerView).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardBaseUrl: 'https://dashboard.stripe.com/test',
        filters: { query: 'sailor', status: 'paid' },
        stripeConfigured: true,
        webhookConfigured: true,
      }),
      undefined
    );
  });

  it('uses the live Stripe dashboard when live keys are configured', async () => {
    mocks.Env.STRIPE_SECRET_KEY = 'stripe_live_secret_configured';
    const { default: AdminPaymentsPage } = await import('./page');

    render(await AdminPaymentsPage({ params: Promise.resolve(params()) }));

    expect(mocks.AdminPaymentsLedgerView).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardBaseUrl: 'https://dashboard.stripe.com',
        stripeConfigured: true,
        webhookConfigured: false,
      }),
      undefined
    );
  });

  it('marks Stripe and webhook integration as unconfigured when keys are absent', async () => {
    const { default: AdminPaymentsPage } = await import('./page');

    render(await AdminPaymentsPage({ params: Promise.resolve(params()) }));

    expect(mocks.AdminPaymentsLedgerView).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardBaseUrl: 'https://dashboard.stripe.com',
        stripeConfigured: false,
        webhookConfigured: false,
      }),
      undefined
    );
  });

  it('builds translated admin payment metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve(params()) })
    ).resolves.toEqual({
      title: 'meta_title',
    });
  });
});
