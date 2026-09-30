import { ExternalLink } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import { AdminActiveFilterChips } from '@/components/mit-sailing/admin/AdminActiveFilterChips';
import {
  AdminMetricStrip,
  AdminResponsiveColumnLabel,
} from '@/components/mit-sailing/admin/AdminDataRows';
import type { AdminMetricStripItem } from '@/components/mit-sailing/admin/AdminDataRows';
import { AdminPagination } from '@/components/mit-sailing/admin/AdminPagination';
import { AdminTableSurface } from '@/components/mit-sailing/admin/AdminTableSurface';
import { AdminUrlFilterToolbar } from '@/components/mit-sailing/admin/AdminUrlFilterToolbar';
import { PaymentAmountDisplay } from '@/components/mit-sailing/payments/PaymentAmountDisplay';
import { PaymentStatus } from '@/generated/prisma/enums';
import type {
  AdminPaymentLedgerData,
  AdminPaymentLedgerFilters,
  AdminPaymentLedgerPage,
  AdminPaymentLedgerRow,
} from '@/libs/admin/payments/adminPaymentQueries';
import {
  adminPaymentsActiveFilterCount,
  adminPaymentsBasePath,
  adminPaymentsClearFiltersHref,
  adminPaymentsDefaultOmit,
  adminPaymentsFilterChips,
  adminPaymentsToolbarParams,
} from '@/libs/admin/payments/adminPaymentsFilterUrl';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';

type AdminPaymentsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminPayments'>>
>;

type AdminPaymentsLedgerViewProps = {
  data: AdminPaymentLedgerData | AdminPaymentLedgerPage;
  dashboardBaseUrl: string;
  filters: AdminPaymentLedgerFilters;
  locale: string;
  stripeConfigured: boolean;
  t: AdminPaymentsTranslations;
  webhookConfigured: boolean;
};

const paymentStatusLabelKeys = {
  [PaymentStatus.cancelled]: 'status_cancelled',
  [PaymentStatus.checkout_created]: 'status_checkout_created',
  [PaymentStatus.disputed]: 'status_disputed',
  [PaymentStatus.handled]: 'status_handled',
  [PaymentStatus.needs_review]: 'status_needs_review',
  [PaymentStatus.paid]: 'status_paid',
  [PaymentStatus.past_due]: 'status_past_due',
  [PaymentStatus.pending]: 'status_pending',
  [PaymentStatus.refunded]: 'status_refunded',
} as const satisfies Record<AdminPaymentLedgerRow['status'], string>;

function paymentStatusLabel(
  status: AdminPaymentLedgerRow['status'],
  t: AdminPaymentsTranslations
): string {
  return t(paymentStatusLabelKeys[status]);
}

function paymentLedgerPaginationSummary(props: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  if (props.total === 0) {
    return { end: 0, start: 0 };
  }
  const start = (props.page - 1) * props.pageSize + 1;
  return {
    end: Math.min(props.total, start + props.pageSize - 1),
    start,
  };
}

function paymentLedgerPageData(
  data: AdminPaymentLedgerData | AdminPaymentLedgerPage
): AdminPaymentLedgerPage {
  if ('page' in data) {
    return data;
  }
  return {
    ...data,
    page: 1,
    pageSize: Math.max(data.rows.length, 1),
    total: data.rows.length,
  };
}

function StripeDashboardLinks(
  props: Readonly<{
    dashboardBaseUrl: string;
    payment: AdminPaymentLedgerRow;
    t: AdminPaymentsTranslations;
  }>
) {
  const paymentIntentHref = props.payment.stripePaymentIntentId
    ? `${props.dashboardBaseUrl}/payments/${props.payment.stripePaymentIntentId}`
    : null;
  const checkoutHref = props.payment.stripeCheckoutSessionId
    ? `${props.dashboardBaseUrl}/checkout/sessions/${props.payment.stripeCheckoutSessionId}`
    : null;

  if (!paymentIntentHref && !checkoutHref) {
    return (
      <span className="text-mit-readable-ink">{props.t('empty_value')}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {paymentIntentHref ? (
        <a
          className="inline-flex items-center gap-1 font-semibold text-foreground no-underline hover:underline"
          href={paymentIntentHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-3.5" />
          {props.t('stripe_payment_link')}
        </a>
      ) : null}
      {checkoutHref ? (
        <a
          className="inline-flex items-center gap-1 font-semibold text-foreground no-underline hover:underline"
          href={checkoutHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-3.5" />
          {props.t('stripe_checkout_link')}
        </a>
      ) : null}
    </div>
  );
}

function PaymentLedgerTitle(
  props: Readonly<{
    payment: AdminPaymentLedgerRow;
    t: AdminPaymentsTranslations;
  }>
) {
  const title =
    props.payment.event?.name ??
    props.payment.legacyDescription ??
    props.t('legacy_payment_title');

  if (props.payment.event) {
    return (
      <Link
        className="font-semibold break-words text-foreground no-underline hover:underline"
        href={`/events/${props.payment.event.slug}`}
      >
        {title}
      </Link>
    );
  }

  return (
    <span className="font-semibold break-words text-foreground">{title}</span>
  );
}

function PaymentLedgerLegacyEvidence(
  props: Readonly<{
    payment: AdminPaymentLedgerRow;
    t: AdminPaymentsTranslations;
  }>
) {
  const source = [props.payment.legacySourceTable, props.payment.legacySourceId]
    .filter(Boolean)
    .join(' ');
  const details = [source, props.payment.legacyCategory]
    .filter(Boolean)
    .join(' · ');

  if (!details) {
    return null;
  }

  return (
    <p className="mt-1 text-xs break-words text-mit-readable-ink">
      {props.t('legacy_evidence', { details })}
    </p>
  );
}

function PaymentLedgerPayer(
  props: Readonly<{
    payment: AdminPaymentLedgerRow;
    t: AdminPaymentsTranslations;
  }>
) {
  const payerName = props.payment.user?.name ?? props.payment.payerName;
  const payerEmail = props.payment.user?.email ?? props.payment.payerEmail;
  const userId = props.payment.user?.id;

  if (userId && (payerName || payerEmail)) {
    return (
      <p className="mt-1 text-sm break-words text-mit-readable-ink">
        <Link
          className="font-semibold text-foreground no-underline hover:underline"
          href={`/admin/users/${userId}`}
        >
          {payerName ?? payerEmail}
        </Link>
        {payerName && payerEmail ? (
          <span className="text-mit-readable-ink">{` · ${payerEmail}`}</span>
        ) : null}
      </p>
    );
  }

  const payer = [payerName, payerEmail].filter(Boolean).join(' · ');

  return (
    <p className="mt-1 text-sm break-words text-mit-readable-ink">
      {payer || props.t('empty_value')}
    </p>
  );
}

function PaymentLedgerAmount(
  props: Readonly<{
    locale: string;
    payment: AdminPaymentLedgerRow;
    t: AdminPaymentsTranslations;
  }>
) {
  return (
    <PaymentAmountDisplay
      labels={{
        amountPaidOfTotal: (values) => props.t('amount_paid_of_total', values),
        discountApplied: props.t('discount_applied'),
        discountSummary: (values) => props.t('discount_summary', values),
        partialRefundSummary: (values) =>
          props.t('amount_partial_refund', values),
      }}
      locale={props.locale}
      payment={props.payment}
    />
  );
}

function HealthSummary(props: {
  data: AdminPaymentLedgerData;
  stripeConfigured: boolean;
  t: AdminPaymentsTranslations;
  webhookConfigured: boolean;
}) {
  const metrics = [
    {
      label: props.t('health_stripe'),
      value: props.stripeConfigured
        ? props.t('health_configured')
        : props.t('health_not_configured'),
    },
    {
      label: props.t('health_webhook'),
      value: props.webhookConfigured
        ? props.t('health_configured')
        : props.t('health_not_configured'),
    },
    {
      label: props.t('health_last_event'),
      value: props.data.latestWebhook
        ? props.t('health_last_event_value', {
            date: formatEasternDateTime(
              props.data.latestWebhook.stripeCreatedAt
            ),
            type: props.data.latestWebhook.eventType,
          })
        : props.t('health_last_event_empty'),
    },
  ] satisfies readonly AdminMetricStripItem[];

  return (
    <section aria-label={props.t('health_aria')} className="grid gap-3">
      <AdminMetricStrip columnsClassName="sm:grid-cols-3" metrics={metrics} />
    </section>
  );
}

export function AdminPaymentsLedgerView(props: AdminPaymentsLedgerViewProps) {
  const data = paymentLedgerPageData(props.data);
  const paginationRange = paymentLedgerPaginationSummary(data);
  const hasActiveFilters = adminPaymentsActiveFilterCount(props.filters) > 0;
  const statusLabels: Record<AdminPaymentLedgerRow['status'], string> = {
    [PaymentStatus.pending]: paymentStatusLabel(PaymentStatus.pending, props.t),
    [PaymentStatus.checkout_created]: paymentStatusLabel(
      PaymentStatus.checkout_created,
      props.t
    ),
    [PaymentStatus.paid]: paymentStatusLabel(PaymentStatus.paid, props.t),
    [PaymentStatus.past_due]: paymentStatusLabel(
      PaymentStatus.past_due,
      props.t
    ),
    [PaymentStatus.handled]: paymentStatusLabel(PaymentStatus.handled, props.t),
    [PaymentStatus.cancelled]: paymentStatusLabel(
      PaymentStatus.cancelled,
      props.t
    ),
    [PaymentStatus.refunded]: paymentStatusLabel(
      PaymentStatus.refunded,
      props.t
    ),
    [PaymentStatus.disputed]: paymentStatusLabel(
      PaymentStatus.disputed,
      props.t
    ),
    [PaymentStatus.needs_review]: paymentStatusLabel(
      PaymentStatus.needs_review,
      props.t
    ),
  };
  const filterChips = adminPaymentsFilterChips(props.filters, {
    chipRemoveAria: (label) => props.t('filter_chip_remove_aria', { label }),
    searchLabel: props.t('filter_search'),
    statusLabel: props.t('filter_status'),
    statusLabels,
  });

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {props.t('title')}
        </h1>
        <p className="max-w-3xl text-sm text-mit-readable-ink">
          {props.t('intro')}
        </p>
      </header>

      <HealthSummary
        data={data}
        stripeConfigured={props.stripeConfigured}
        t={props.t}
        webhookConfigured={props.webhookConfigured}
      />

      <AdminUrlFilterToolbar
        basePath={adminPaymentsBasePath}
        omitWhenDefault={adminPaymentsDefaultOmit}
        params={adminPaymentsToolbarParams(props.filters)}
        search={{
          label: props.t('filter_search'),
          param: 'q',
          placeholder: props.t('filter_search_placeholder'),
          value: props.filters.query ?? '',
        }}
        selects={[
          {
            defaultValue: 'all',
            label: props.t('filter_status'),
            options: [
              { label: props.t('filter_status_all'), value: 'all' },
              ...Object.values(PaymentStatus).map((status) => ({
                label: paymentStatusLabel(status, props.t),
                value: status,
              })),
            ],
            param: 'status',
            value: props.filters.status ?? 'all',
          },
        ]}
      />
      <AdminActiveFilterChips
        chips={filterChips}
        clearHref={
          hasActiveFilters ? adminPaymentsClearFiltersHref() : undefined
        }
        clearLabel={hasActiveFilters ? props.t('filter_clear') : undefined}
      />

      <AdminTableSurface
        footer={
          <AdminPagination
            basePath={adminPaymentsBasePath}
            labels={{
              next: props.t('pagination_next'),
              previous: props.t('pagination_previous'),
              summary: props.t('pagination_summary', {
                end: paginationRange.end,
                start: paginationRange.start,
                total: data.total,
              }),
            }}
            page={data.page}
            pageSize={data.pageSize}
            params={{
              q: props.filters.query,
              status:
                props.filters.status === 'all'
                  ? undefined
                  : props.filters.status,
            }}
            total={data.total}
          />
        }
      >
        {data.rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-mit-readable-ink">
            {props.t('empty_state')}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px_150px] gap-3 border-b border-mit-line px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>{props.t('column_payment')}</span>
              <span>{props.t('column_status')}</span>
              <span>{props.t('column_amount')}</span>
              <span>{props.t('column_stripe')}</span>
            </div>
            <ol className="m-0 list-none divide-y divide-mit-line p-0">
              {data.rows.map((payment) => (
                <li
                  className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px_150px] md:items-start md:gap-3 md:py-4"
                  key={payment.id}
                >
                  <div className="min-w-0">
                    <PaymentLedgerTitle payment={payment} t={props.t} />
                    <PaymentLedgerLegacyEvidence
                      payment={payment}
                      t={props.t}
                    />
                    <PaymentLedgerPayer payment={payment} t={props.t} />
                  </div>
                  <div className="text-sm text-mit-readable-ink">
                    <AdminResponsiveColumnLabel
                      label={props.t('column_status')}
                    />
                    <span className="font-semibold text-foreground">
                      {paymentStatusLabel(payment.status, props.t)}
                    </span>
                    <span className="block">
                      {formatEasternDateTime(payment.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    <AdminResponsiveColumnLabel
                      label={props.t('column_amount')}
                    />
                    <PaymentLedgerAmount
                      locale={props.locale}
                      payment={payment}
                      t={props.t}
                    />
                  </div>
                  <div>
                    <AdminResponsiveColumnLabel
                      label={props.t('column_stripe')}
                    />
                    <StripeDashboardLinks
                      dashboardBaseUrl={props.dashboardBaseUrl}
                      payment={payment}
                      t={props.t}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </AdminTableSurface>
    </div>
  );
}
