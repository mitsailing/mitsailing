'use server';

import type { EventPaymentCheckoutActionResult } from '@/components/mit-sailing/events/EventPaymentCheckout';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  buildEventPaymentCheckoutReturnUrl,
  createEventPaymentCheckoutClientSecret,
} from '@/libs/mit-sailing/eventPaymentCheckout';

export async function createEventPaymentCheckoutClientSecretAction(
  locale: string,
  slug: string,
  paymentId: string
): Promise<EventPaymentCheckoutActionResult> {
  const user = await requireCurrentUser(
    locale,
    `/events/${encodeURIComponent(slug)}/checkout`
  );
  const clientSecret = await createEventPaymentCheckoutClientSecret({
    db: prisma,
    paymentId,
    returnUrl: buildEventPaymentCheckoutReturnUrl({
      appUrl: Env.NEXT_PUBLIC_APP_URL,
      slug,
    }),
    userId: user.id,
  });

  if (!clientSecret) {
    return {
      message: 'Payment is no longer available for checkout.',
      status: 'unavailable',
    };
  }

  return { clientSecret, status: 'ok' };
}
