import { nyYmd } from '@/lib/mit-sailing/nyTime';

const WAITLIST_OPEN_MONTH_DAY = '04-01';

function easternYear(now: Date): number {
  const year = Number(nyYmd(now).slice(0, 4));
  if (!Number.isInteger(year)) {
    throw new TypeError('Could not resolve Learn-to-Sail season year.');
  }
  return year;
}

/**
 * Learn-to-Sail waitlist season for an instant in MIT Sailing venue time.
 *
 * @param now - Instant to evaluate.
 * @returns Four-digit waitlist season year.
 */
export function getLearnToSailSeasonYear(now: Date): number {
  return easternYear(now);
}

/**
 * Active-entry uniqueness key for one user in one annual waitlist season.
 *
 * @param props - Season year and user id.
 * @returns Stable active-entry key.
 */
export function activeLearnToSailWaitlistEntryKey(props: {
  seasonYear: number;
  userId: string;
}): string {
  return `${props.seasonYear}:${props.userId}`;
}

/**
 * Whether users can join and receive a waitlist number.
 *
 * @param now - Instant to evaluate.
 * @returns True on or after April 1 midnight Eastern in the season year.
 */
export function isLearnToSailWaitlistOpen(now: Date): boolean {
  const dateKey = nyYmd(now);
  const seasonYear = getLearnToSailSeasonYear(now);
  return dateKey >= `${seasonYear}-${WAITLIST_OPEN_MONTH_DAY}`;
}
