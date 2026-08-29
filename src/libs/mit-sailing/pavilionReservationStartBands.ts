import type { PavilionReservationTimeOption } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';

export type PavilionStartTimeBand = 'afternoon' | 'evening' | 'morning';

const MORNING_END_EXCLUSIVE = 12 * 60;
const AFTERNOON_END_EXCLUSIVE = 17 * 60;

/**
 * Classifies a start minute into morning, afternoon, or evening.
 *
 * @param minutes - Start minutes on the pavilion day axis
 * @returns Time-of-day band for the start minute
 */
export function pavilionStartTimeBand(minutes: number): PavilionStartTimeBand {
  if (minutes < MORNING_END_EXCLUSIVE) {
    return 'morning';
  }
  if (minutes < AFTERNOON_END_EXCLUSIVE) {
    return 'afternoon';
  }
  return 'evening';
}

/**
 * Filters start options to a single time-of-day band.
 *
 * @param props - Band and start choices
 * @returns Start options in the selected band
 */
export function pavilionStartOptionsForBand(props: {
  band: PavilionStartTimeBand;
  options: readonly PavilionReservationTimeOption[];
}) {
  return props.options.filter(
    (option) => pavilionStartTimeBand(option.minutes) === props.band
  );
}

/**
 * Returns which start bands still have at least one available option.
 *
 * @param options - Available start choices
 * @returns Bands that still have available starts
 */
export function pavilionAvailableStartBands(
  options: readonly PavilionReservationTimeOption[]
): PavilionStartTimeBand[] {
  const bands: PavilionStartTimeBand[] = [];
  for (const band of ['morning', 'afternoon', 'evening'] as const) {
    if (pavilionStartOptionsForBand({ band, options }).length > 0) {
      bands.push(band);
    }
  }
  return bands;
}
