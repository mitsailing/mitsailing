'use server';

import { getTranslations } from 'next-intl/server';
import type { EventPaymentCheckoutActionResult } from '@/components/mit-sailing/events/EventPaymentCheckout';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  buildEventPaymentCheckoutReturnUrl,
  createEventPaymentCheckoutClientSecret,
} from '@/libs/mit-sailing/eventPaymentCheckout';
import { getI18nPath } from '@/utils/Helpers';

export async function createEventPaymentCheckoutClientSecretAction(
  locale: string,
  slug: string,
  paymentId: string
): Promise<EventPaymentCheckoutActionResult> {
  const user = await requireCurrentUser(
    locale,
    getI18nPath(`/events/${encodeURIComponent(slug)}/checkout`, locale)
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
    const t = await getTranslations({
      locale,
      namespace: 'MitSailingEvents',
    });
    return {
      message: t('checkout_unavailable_message'),
      status: 'unavailable',
    };
  }

  return { clientSecret, status: 'ok' };
}
