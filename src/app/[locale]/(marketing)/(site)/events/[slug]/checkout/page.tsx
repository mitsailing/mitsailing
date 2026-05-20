import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { EventPaymentCheckout } from '@/components/mit-sailing/events/EventPaymentCheckout';
import type { EventPaymentCheckoutPayment } from '@/components/mit-sailing/events/EventPaymentCheckout';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { requireCurrentUser } from '@/libs/auth/dal';
import { Env } from '@/libs/Env';
import { createEventPaymentCheckoutClientSecretAction } from '@/libs/mit-sailing/eventPaymentCheckoutActions';
import {
  eventPaymentCheckoutIsPayable,
  getEventPaymentCheckoutPageData,
} from '@/libs/mit-sailing/eventPaymentCheckoutQueries';
import type { EventPaymentCheckoutPagePayment } from '@/libs/mit-sailing/eventPaymentCheckoutQueries';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { getI18nPath } from '@/utils/Helpers';

type EventCheckoutPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function checkoutPaymentViewModel(options: {
  locale: string;
  payment: EventPaymentCheckoutPagePayment | null;
  statusLabel: string;
}): EventPaymentCheckoutPayment {
  if (!options.payment) {
    return null;
  }
  return {
    amount: formatUsdMinorUnitsAsCurrency(
      options.payment.amountCents,
      options.locale
    ),
    receiptUrl: options.payment.receiptUrl,
    status: options.payment.status,
    statusLabel: options.statusLabel,
  };
}

function checkoutPublishableKey(): string | undefined {
  return (
    Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    (Env.IS_E2E === '1' ? 'pk_test_e2e_mock' : undefined)
  );
}

export async function generateMetadata(
  props: EventCheckoutPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingEvents',
  });
  return { title: t('checkout_meta_title') };
}

export default async function EventCheckoutPage(props: EventCheckoutPageProps) {
  await connection();
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(
    locale,
    getI18nPath(`/events/${encodeURIComponent(slug)}/checkout`, locale)
  );
  const [data, t, tRoutes] = await Promise.all([
    getEventPaymentCheckoutPageData(slug, user.id),
    getTranslations({ locale, namespace: 'MitSailingEvents' }),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
  ]);
  if (!data) {
    notFound();
  }

  const paymentStatusLabels = {
    cancelled: t('checkout_payment_status_cancelled'),
    checkout_created: t('checkout_payment_status_checkout_created'),
    disputed: t('checkout_payment_status_disputed'),
    handled: t('checkout_payment_status_handled'),
    paid: t('checkout_payment_status_paid'),
    past_due: t('checkout_payment_status_past_due'),
    pending: t('checkout_payment_status_pending'),
    refunded: t('checkout_payment_status_refunded'),
  } satisfies Record<EventPaymentCheckoutPagePayment['status'], string>;
  const payment = checkoutPaymentViewModel({
    locale,
    payment: data.payment,
    statusLabel: data.payment ? paymentStatusLabels[data.payment.status] : '',
  });
  const clientSecretAction = createEventPaymentCheckoutClientSecretAction.bind(
    null,
    locale,
    data.event.slug,
    data.payment && eventPaymentCheckoutIsPayable(data.payment.status)
      ? data.payment.id
      : ''
  );

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        {
          label: tRoutes('section_events'),
          href: getI18nPath('/events', locale),
        },
        {
          label: data.event.name,
          href: getI18nPath(
            `/events/${encodeURIComponent(data.event.slug)}`,
            locale
          ),
        },
        { label: t('checkout_breadcrumb') },
      ]}
    >
      <SiteSectionMain variant="compactDetail">
        <EventPaymentCheckout
          clientSecretAction={clientSecretAction}
          labels={{
            amountLabel: t('checkout_amount_label'),
            alreadyHandledBody: t('checkout_already_handled_body'),
            alreadyHandledTitle: t('checkout_already_handled_title'),
            checkoutLoadError: t('checkout_load_error'),
            checkoutLoading: t('checkout_loading'),
            checkoutRegionLabel: t('checkout_region_label'),
            noPaymentBody: t('checkout_no_payment_body'),
            noPaymentTitle: t('checkout_no_payment_title'),
            paidReceipt: t('checkout_receipt_link'),
            statusLabel: t('checkout_status_label'),
          }}
          payment={payment}
          publishableKey={checkoutPublishableKey()}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
