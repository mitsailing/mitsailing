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

/**
 * Parses a user-entered decimal dollar string into integer USD minor units.
 *
 * @param input - Raw string (commas allowed); major units, not cents
 * @returns Rounded minor units, or `null` when empty or invalid
 */
export function parseUsdDecimalStringToMinorUnits(
  input: string
): number | null {
  const normalized = input.trim().replaceAll(',', '');
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

/**
 * Formats integer USD minor units as a fixed two-decimal string for HTML inputs.
 *
 * @param minorUnits - Cents (Stripe-compatible integer)
 * @returns String like `150.00` for 15_000 minor units
 */
export function usdMinorUnitsToDecimalInputString(minorUnits: number): string {
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
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }).format(minorUnits / 100);
}
