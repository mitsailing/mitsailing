import type { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import type { SailingCardType } from '@/generated/prisma/enums';
import { Link } from '@/libs/I18nNavigation';
import type { MembershipProfileStateKind } from '@/libs/mit-sailing/membershipBilling/membershipProfileState';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { safeStripeHostedPaymentHref } from '@/libs/stripe/stripeHostedPaymentHref';

type ProfileMembershipTranslations = Awaited<
  ReturnType<typeof getTranslations<'UserProfilePage'>>
>;

type ProfileMembershipBillingViewProps = Readonly<{
  accessThroughLabel: string | null;
  amountCents: number | null;
  cardType: SailingCardType | null;
  kind: MembershipProfileStateKind;
  locale: string;
  receiptUrl: string | null;
  t: ProfileMembershipTranslations;
}>;

const statusKeys = {
  active_paid: 'membership_status_active_paid',
  canceled: 'membership_status_canceled',
  free_normal: 'membership_status_free_normal',
  free_normal_active_paid: 'membership_status_free_normal_active_paid',
  no_paid_membership: 'membership_status_no_paid_membership',
  past_due: 'membership_status_past_due',
  pending_checkout: 'membership_status_pending_checkout',
} as const satisfies Record<MembershipProfileStateKind, string>;

const bodyKeys = {
  active_paid: 'membership_body_active_paid',
  canceled: 'membership_body_canceled',
  free_normal: 'membership_body_free_normal',
  free_normal_active_paid: 'membership_body_free_normal_active_paid',
  no_paid_membership: 'membership_body_no_paid_membership',
  past_due: 'membership_body_past_due',
  pending_checkout: 'membership_body_pending_checkout',
} as const satisfies Record<MembershipProfileStateKind, string>;

const cardTypeKeys = {
  normal: 'payments_card_type_normal',
  racing: 'payments_card_type_racing',
  team_racing: 'payments_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

function SummaryRow(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">
        {props.value}
      </dd>
    </div>
  );
}

export function ProfileMembershipBillingView(
  props: ProfileMembershipBillingViewProps
) {
  const receiptHref = safeStripeHostedPaymentHref(props.receiptUrl);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-mit-text">
          {props.t('membership_page_heading')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-mit-readable-ink">
          {props.t(bodyKeys[props.kind])}
        </p>
      </div>

      <section className="rounded-lg border border-mit-line bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {props.t(statusKeys[props.kind])}
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <SummaryRow
                label={props.t('membership_card_type')}
                value={
                  props.cardType
                    ? props.t(cardTypeKeys[props.cardType])
                    : props.t('profile_not_set')
                }
              />
              <SummaryRow
                label={props.t('membership_access_through')}
                value={props.accessThroughLabel ?? props.t('profile_not_set')}
              />
              <SummaryRow
                label={props.t('membership_latest_amount')}
                value={
                  props.amountCents === null
                    ? props.t('profile_not_set')
                    : formatUsdMinorUnitsAsCurrency(
                        props.amountCents,
                        props.locale
                      )
                }
              />
            </dl>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/profile/payments">
            {props.t('membership_view_payments')}
          </Link>
        </Button>
        {receiptHref ? (
          <Button asChild variant="outline">
            {/* nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeStripeHostedPaymentHref restricts receipt links to Stripe-hosted HTTPS payment URLs. */}
            <a href={receiptHref} rel="noopener noreferrer" target="_blank">
              {props.t('payments_receipt_link')}
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
