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

type EventCheckoutPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function checkoutPaymentViewModel(options: {
  locale: string;
  payment: EventPaymentCheckoutPagePayment | null;
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
    `/events/${encodeURIComponent(slug)}/checkout`
  );
  const [data, t, tRoutes] = await Promise.all([
    getEventPaymentCheckoutPageData({ slug, userId: user.id }),
    getTranslations({ locale, namespace: 'MitSailingEvents' }),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
  ]);
  if (!data) {
    notFound();
  }

  const payment = checkoutPaymentViewModel({
    locale,
    payment: data.payment,
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
        { label: tRoutes('section_events'), href: '/events/' },
        { label: data.event.name, href: `/events/${data.event.slug}` },
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
