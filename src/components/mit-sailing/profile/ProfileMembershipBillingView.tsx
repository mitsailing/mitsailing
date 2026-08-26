import type { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import type {
  MembershipCancellationReason,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Link } from '@/libs/I18nNavigation';
import { openMembershipBillingPortalAction } from '@/libs/mit-sailing/membershipBilling/membershipBillingPortalActions';
import { turnOffMembershipAutoRenewFormAction } from '@/libs/mit-sailing/membershipBilling/membershipCancellationActions';
import type { MembershipProfileStateKind } from '@/libs/mit-sailing/membershipBilling/membershipSubscriptions';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { safeStripeHostedPaymentHref } from '@/libs/stripe/stripeHostedPaymentHref';

type ProfileMembershipTranslations = Awaited<
  ReturnType<typeof getTranslations<'UserProfilePage'>>
>;

type ProfileMembershipBillingViewProps = Readonly<{
  accessThroughLabel: string | null;
  amountCents: number | null;
  canOpenBillingPortal: boolean;
  canTurnOffAutoRenew: boolean;
  cardType: SailingCardType | null;
  kind: MembershipProfileStateKind;
  locale: string;
  receiptUrl: string | null;
  subscriptionId: string | null;
  t: ProfileMembershipTranslations;
}>;

const statusKeys = {
  active_paid: 'membership_status_active_paid',
  cancel_at_period_end: 'membership_status_cancel_at_period_end',
  canceled: 'membership_status_canceled',
  free_normal: 'membership_status_free_normal',
  free_normal_active_paid: 'membership_status_free_normal_active_paid',
  no_paid_membership: 'membership_status_no_paid_membership',
  past_due: 'membership_status_past_due',
  pending_checkout: 'membership_status_pending_checkout',
} as const satisfies Record<MembershipProfileStateKind, string>;

const bodyKeys = {
  active_paid: 'membership_body_active_paid',
  cancel_at_period_end: 'membership_body_cancel_at_period_end',
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

const cancellationReasonKeys = {
  cost: 'membership_cancel_reason_cost',
  duplicate_or_mistake: 'membership_cancel_reason_duplicate_or_mistake',
  not_sailing_next_season: 'membership_cancel_reason_not_sailing_next_season',
  other: 'membership_cancel_reason_other',
  using_free_membership: 'membership_cancel_reason_using_free_membership',
} as const satisfies Record<MembershipCancellationReason, string>;

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
  const portalAction = openMembershipBillingPortalAction.bind(
    null,
    props.locale
  );
  const cancelAction = turnOffMembershipAutoRenewFormAction.bind(
    null,
    props.locale
  );
  const receiptHref = safeStripeHostedPaymentHref(props.receiptUrl);
  const canTurnOffAutoRenew =
    props.canTurnOffAutoRenew && props.subscriptionId !== null;

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
          {props.canOpenBillingPortal ? (
            <form action={portalAction}>
              <SubmitButton pendingKind="submitting" variant="mit">
                {props.t('membership_update_payment_method')}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      {canTurnOffAutoRenew ? (
        <form
          action={cancelAction}
          className="flex flex-col gap-4 rounded-lg border border-mit-line bg-card p-5"
        >
          <input
            name="subscriptionId"
            type="hidden"
            value={props.subscriptionId}
          />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {props.t('membership_auto_renew_heading')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-mit-readable-ink">
              {props.t('membership_auto_renew_body')}
            </p>
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="text-sm font-medium text-foreground">
              {props.t('membership_cancel_reason_label')}
            </legend>
            {Object.entries(cancellationReasonKeys).map(([reason, key]) => (
              <label className="flex items-center gap-2 text-sm" key={reason}>
                <input
                  className="size-4 accent-mit-red"
                  name="reason"
                  type="radio"
                  value={reason}
                />
                {props.t(key)}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            {props.t('membership_cancel_note_label')}
            <Textarea className="min-h-24 font-normal" name="note" />
          </label>
          <SubmitButton
            className="w-fit"
            pendingKind="submitting"
            variant="outline"
          >
            {props.t('membership_turn_off_auto_renew')}
          </SubmitButton>
        </form>
      ) : null}

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
