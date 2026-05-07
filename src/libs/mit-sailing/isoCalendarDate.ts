/**
 * Helpers for Postgres `DATE` values surfaced through Prisma as UTC-midnight `Date`s.
 */

/**
 * Converts a Prisma-read Postgres DATE into civil ISO `YYYY-MM-DD` using UTC fields.
 *
 * @param d - Date from Prisma `@db.Date`
 * @returns Civil ISO date string
 */
export function isoCalendarDateFromPrismaDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses civil ISO `YYYY-MM-DD` into a UTC-midnight `Date` for Prisma `@db.Date`.
 *
 * @param iso - Candidate ISO calendar date
 * @returns `null` when `iso` is not a valid Gregorian calendar date
 */
export function prismaDateFromIsoCalendar(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const [ys, ms, ds] = iso.split('-');
  const y = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const d = new Date(Date.UTC(y, month - 1, day));
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}
