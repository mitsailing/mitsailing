/**
 * Shared helpers for summarizing caught `unknown` values in server logs without throwing.
 * Lives under `src/libs/` so `app/` stays route-oriented (Next.js App Router project structure).
 */

/**
 * Type guard for a non-null object with a string `code` (e.g. Prisma known request errors).
 * Narrows `unknown` in the order TypeScript recommends: `typeof` object check, null
 * exclusion, then the `in` operator — avoid `"code" in x` on a bare `unknown`.
 *
 * @param value - Any caught or propagated value
 * @returns True when `value` is a non-null object with a string `code`
 */
function isObjectWithStringCode(value: unknown): value is { code: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('code' in value)) {
    return false;
  }
  return typeof value.code === 'string';
}

/**
 * Returns `Error.prototype.name` when `error` is an `Error`; otherwise `typeof error`
 * for log fields without throwing.
 *
 * @param error - Caught rejection or throw value
 * @returns Safe short label for logs
 */
export function safeErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return typeof error;
}

/**
 * Returns a string `code` on a plain object-shaped value (e.g. Prisma client errors)
 * when present; otherwise `undefined`.
 *
 * @param error - Caught rejection or throw value
 * @returns String code or `undefined`
 */
export function safeErrorCode(error: unknown): string | undefined {
  if (isObjectWithStringCode(error)) {
    return error.code;
  }
  return undefined;
}
