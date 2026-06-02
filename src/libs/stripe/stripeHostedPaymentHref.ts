const stripeHostedPaymentHosts = new Set([
  'checkout.stripe.com',
  'pay.stripe.com',
]);

export function safeStripeHostedPaymentHref(value: string | null | undefined) {
  const href = value?.trim();
  if (!href) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    !stripeHostedPaymentHosts.has(url.hostname)
  ) {
    return null;
  }

  return href;
}
