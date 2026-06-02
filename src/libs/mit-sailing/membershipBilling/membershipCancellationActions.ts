'use server';

import { revalidatePath } from 'next/cache';
import type { Stripe } from 'stripe';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import { getI18nPath } from '@/utils/Helpers';

export type TurnOffMembershipAutoRenewResult =
  | { readonly ok: true }
  | {
      readonly error:
        | 'db_update_failed'
        | 'not_found'
        | 'stripe_failed'
        | 'unauthorized';
      readonly ok: false;
    };

type MembershipCancellationClient = {
  readonly sailingCardSubscription: {
    findFirst(args: {
      readonly select: {
        readonly id: true;
        readonly stripeSubscriptionId: true;
      };
      readonly where: {
        readonly autoRenew: true;
        readonly cancelAtPeriodEnd: false;
        readonly id: string;
        readonly userId: string;
      };
    }): Promise<{
      readonly id: string;
      readonly stripeSubscriptionId: string;
    } | null>;
    update(args: {
      readonly data: {
        readonly autoRenew: false;
        readonly cancelAtPeriodEnd: true;
        readonly cancellationNote: string | null;
        readonly cancellationReason:
          | 'cost'
          | 'duplicate_or_mistake'
          | 'not_sailing_next_season'
          | 'other'
          | 'using_free_membership';
        readonly cancellationRequestedAt: Date;
      };
      readonly where: { readonly id: string };
    }): Promise<unknown>;
  };
};

type MembershipCancellationStripe = {
  readonly subscriptions: {
    update(
      id: string,
      params: Stripe.SubscriptionUpdateParams
    ): Promise<Pick<Stripe.Subscription, 'id'>>;
  };
};

const cancellationReasons = [
  'cost',
  'duplicate_or_mistake',
  'not_sailing_next_season',
  'other',
  'using_free_membership',
] as const;

type MembershipCancellationReasonValue = (typeof cancellationReasons)[number];

const cancellationReasonSet: ReadonlySet<string> = new Set(cancellationReasons);

function isMembershipCancellationReason(
  value: string
): value is MembershipCancellationReasonValue {
  return cancellationReasonSet.has(value);
}

function cancellationReason(value: FormDataEntryValue | null) {
  return typeof value === 'string' && isMembershipCancellationReason(value)
    ? value
    : 'other';
}

export async function turnOffMembershipAutoRenew(options: {
  readonly client: MembershipCancellationClient;
  readonly now: Date;
  readonly note: string;
  readonly reason: MembershipCancellationReasonValue;
  readonly stripe: MembershipCancellationStripe;
  readonly subscriptionId: string;
  readonly userId: string;
}): Promise<TurnOffMembershipAutoRenewResult> {
  const subscription = await options.client.sailingCardSubscription.findFirst({
    select: {
      id: true,
      stripeSubscriptionId: true,
    },
    where: {
      autoRenew: true,
      cancelAtPeriodEnd: false,
      id: options.subscriptionId,
      userId: options.userId,
    },
  });
  if (!subscription) {
    return { error: 'not_found', ok: false };
  }

  try {
    await options.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );
  } catch {
    return { error: 'stripe_failed', ok: false };
  }

  try {
    await options.client.sailingCardSubscription.update({
      data: {
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancellationNote: options.note.trim() || null,
        cancellationReason: options.reason,
        cancellationRequestedAt: options.now,
      },
      where: { id: subscription.id },
    });
  } catch (error) {
    let revertError: unknown = null;
    try {
      await options.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        }
      );
    } catch (caughtRevertError) {
      revertError = caughtRevertError;
    }
    logger.error(
      '[membership:auto-renew-cancel] db_update_failed subscription_id={subscriptionId} stripe_subscription_id={stripeSubscriptionId} reason={reason}',
      {
        error,
        reason: options.reason,
        revertError,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        subscriptionId: subscription.id,
      }
    );
    return { error: 'db_update_failed', ok: false };
  }

  return { ok: true };
}

async function turnOffMembershipAutoRenewAction(
  locale: string,
  formData: FormData
): Promise<TurnOffMembershipAutoRenewResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'unauthorized', ok: false };
  }
  const subscriptionId = formData.get('subscriptionId');
  if (typeof subscriptionId !== 'string' || subscriptionId.trim() === '') {
    return { error: 'not_found', ok: false };
  }
  const note = formData.get('note');

  const result = await turnOffMembershipAutoRenew({
    client: prisma,
    note: typeof note === 'string' ? note : '',
    now: new Date(),
    reason: cancellationReason(formData.get('reason')),
    stripe: getStripeClient(),
    subscriptionId,
    userId: session.user.id,
  });
  if (!result.ok) {
    return result;
  }
  revalidatePath(getI18nPath('/profile', locale));
  return result;
}

export async function turnOffMembershipAutoRenewFormAction(
  locale: string,
  formData: FormData
): Promise<void> {
  await turnOffMembershipAutoRenewAction(locale, formData);
}
