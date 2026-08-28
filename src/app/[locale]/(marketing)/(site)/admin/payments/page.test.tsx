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
  listAdminPaymentLedgerPage: vi.fn(),
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
  ADMIN_PAYMENT_LEDGER_PAGE_SIZE: 50,
  adminPaymentStatusFromParam: mocks.adminPaymentStatusFromParam,
  listAdminPaymentLedgerPage: mocks.listAdminPaymentLedgerPage,
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
    mocks.listAdminPaymentLedgerPage.mockResolvedValue({
      latestWebhook: null,
      page: 1,
      pageSize: 50,
      rows: [{ id: 'payment-1' }],
      total: 1,
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
    expect(mocks.listAdminPaymentLedgerPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
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
