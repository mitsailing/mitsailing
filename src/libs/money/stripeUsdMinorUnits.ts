/**
 * USD-only money helpers aligned with Stripe’s API and Postgres storage.
 *
 * **Persist integer minor units (cents)** in the database — e.g. store **1999**
 * for $19.99 in an `INTEGER` column — not dollar decimals (`numeric`/`float`).
 * That matches Stripe’s **`amount`** (smallest currency unit), avoids floating-point
 * rounding (PostgreSQL recommends not using float for money), and matches
 * `PaymentIntent` / refund payloads from Stripe’s API.
 *
 * Stripe still requires a **`currency`** on objects like PaymentIntents, but
 * for a single-currency US site you pass the **same literal** every time
 * (`"usd"`) together with **`amount`** as a positive integer in the smallest
 * unit (cents for USD). Do not expose currency as a user-selectable field or
 * accept arbitrary currency codes from clients.
 *
 * Example: **$19.99** is `amount: 1999` and `currency: "usd"` —
 * never pass dollars as a decimal in `amount`.
 *
 * @see https://docs.stripe.com/api/payment_intents/create — `amount`, `currency`
 */

const STRIPE_USD_MAX_MINOR_UNITS = 99_999_999;
const STRIPE_USD_MAX_MAJOR_UNITS = STRIPE_USD_MAX_MINOR_UNITS / 100;

function assertValidUsdMinorUnits(options: {
  functionName: string;
  minorUnits: number;
}): void {
  if (
    !Number.isInteger(options.minorUnits) ||
    options.minorUnits < 0 ||
    options.minorUnits > STRIPE_USD_MAX_MINOR_UNITS
  ) {
    throw new TypeError(
      `${options.functionName} expects finite non-negative integer USD minor units within Stripe's USD limit.`
    );
  }
}

/**
 * Parses a user-entered decimal dollar string into integer USD minor units.
 *
 * @param input - Raw string (commas allowed); major units, not cents
 * @returns Minor units, or `null` when empty or invalid
 */
export function parseUsdDecimalStringToMinorUnits(
  input: string
): number | null {
  const normalized = input.trim().replaceAll(',', '');
  if (!normalized) {
    return null;
  }
  const match = /^(\d+)(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/.exec(normalized);
  if (!match) {
    return null;
  }
  const majorUnits = Number(match[1] ?? '0');
  const fractionalMinorUnits = Number(
    (match[2] ?? match[3] ?? '').padEnd(2, '0')
  );
  if (
    !Number.isSafeInteger(majorUnits) ||
    majorUnits > STRIPE_USD_MAX_MAJOR_UNITS ||
    majorUnits > Number.MAX_SAFE_INTEGER / 100
  ) {
    return null;
  }
  const minorUnits = majorUnits * 100 + fractionalMinorUnits;
  return minorUnits <= STRIPE_USD_MAX_MINOR_UNITS ? minorUnits : null;
}

/**
 * Formats integer USD minor units as a fixed two-decimal string for HTML inputs.
 *
 * @param minorUnits - Cents (Stripe-compatible integer)
 * @returns String like `150.00` for 15_000 minor units
 */
export function usdMinorUnitsToDecimalInputString(minorUnits: number): string {
  assertValidUsdMinorUnits({
    functionName: 'usdMinorUnitsToDecimalInputString',
    minorUnits,
  });
  return (minorUnits / 100).toFixed(2);
}

/**
 * Locale-aware USD currency display from integer minor units.
 *
 * @param minorUnits - Cents (Stripe-compatible integer)
 * @param locale - BCP 47 locale for `Intl.NumberFormat`
 * @returns Localized currency string (always USD)
 */
export function formatUsdMinorUnitsAsCurrency(
  minorUnits: number,
  locale: string
): string {
  assertValidUsdMinorUnits({
    functionName: 'formatUsdMinorUnitsAsCurrency',
    minorUnits,
  });
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }).format(minorUnits / 100);
}
