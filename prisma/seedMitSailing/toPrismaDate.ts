/**
 * @param s - ISO string or `null` from seed rows
 * @returns Parsed `Date`, or `null` when the seed value is `null`
 */
export function toDate(s: string | null): Date | null {
  if (s === null) {
    return null;
  }
  return new Date(s);
}
