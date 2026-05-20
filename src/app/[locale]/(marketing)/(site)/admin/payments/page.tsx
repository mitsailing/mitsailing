import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPaymentsLedgerView } from '@/components/mit-sailing/admin/payments/AdminPaymentsLedgerView';
import {
  adminPaymentStatusFromParam,
  listAdminPaymentLedgerData,
} from '@/libs/admin/payments/adminPaymentQueries';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { Env } from '@/libs/Env';

type AdminPaymentsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; status?: string }>;
};

function stripeDashboardBaseUrl(): string {
  const publishableKey = Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const secretKey = Env.STRIPE_SECRET_KEY ?? '';
  const testMode =
    publishableKey.startsWith('pk_test_') ||
    secretKey.startsWith('sk_test_') ||
    secretKey.startsWith('rk_test_');
  return testMode
    ? 'https://dashboard.stripe.com/test'
    : 'https://dashboard.stripe.com';
}

export async function generateMetadata(
  props: AdminPaymentsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminPayments' });
  return { title: t('meta_title') };
}

export default async function AdminPaymentsPage(props: AdminPaymentsPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  await requirePermission(Permission.PAYMENTS_VIEW, locale);
  const filters = {
    query: searchParams?.q,
    status: adminPaymentStatusFromParam(searchParams?.status),
  };
  const [data, t] = await Promise.all([
    listAdminPaymentLedgerData(filters),
    getTranslations({ locale, namespace: 'AdminPayments' }),
  ]);

  return (
    <AdminPaymentsLedgerView
      dashboardBaseUrl={stripeDashboardBaseUrl()}
      data={data}
      filters={filters}
      locale={locale}
      stripeConfigured={Boolean(Env.STRIPE_SECRET_KEY)}
      t={t}
      webhookConfigured={Boolean(Env.STRIPE_WEBHOOK_SECRET)}
    />
  );
}
