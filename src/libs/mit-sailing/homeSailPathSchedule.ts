import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import {
  formatEasternTimeOnly,
  formatEasternWeekdayShortDate,
} from '@/libs/mit-sailing/easternTimeFormat';

const EXPERIENCED_INTRO_EVENT_NAME = 'Introduction for Experienced Sailors';

const weekdayLongFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'long',
});

export type HomeSailPathExperiencedSession = {
  readonly dateLabel: string;
  readonly href: string;
  readonly id: string;
};

export type HomeSailPathScheduleSummary = {
  readonly durationMinutes: number | null;
  readonly time: string;
  readonly weekdayPlural: string;
};

export type HomeSailPathWaitlistState =
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'join' }
  | { readonly kind: 'position'; readonly position: number };

/**
 * Exact public event name used for homepage experienced-sailor sessions.
 *
 * @returns Canonical event name filter
 */
export function homeSailPathExperiencedEventName(): string {
  return EXPERIENCED_INTRO_EVENT_NAME;
}

/**
 * Builds the homepage signup URL that returns beginners to the home waitlist path.
 *
 * @returns App-relative signup path with home callback
 */
export function homeSailPathSignupHref(): '/signup?callbackUrl=%2F' {
  return '/signup?callbackUrl=%2F';
}

/**
 * Formats one upcoming orientation for the experienced-sailor date list.
 *
 * @param props - Occurrence id, start, and event slug
 * @returns Serializable session row for HomeSailPath
 */
export function formatHomeSailPathExperiencedSession(props: {
  readonly eventSlug: string;
  readonly id: string;
  readonly startDateTime: Date;
}): HomeSailPathExperiencedSession {
  return {
    dateLabel: formatEasternWeekdayShortDate(props.startDateTime),
    href: `/events/${encodeURIComponent(props.eventSlug)}`,
    id: props.id,
  };
}

/**
 * Derives the recurring when/duration line when all upcoming sessions agree.
 *
 * @param sessions - Upcoming start/end pairs in venue time
 * @returns Shared schedule summary, or null when weekday/time are mixed or empty
 */
export function deriveHomeSailPathExperiencedSchedule(
  sessions: readonly {
    readonly endDateTime: Date;
    readonly startDateTime: Date;
  }[]
): HomeSailPathScheduleSummary | null {
  if (sessions.length === 0) {
    return null;
  }

  const weekdays = sessions.map((session) =>
    weekdayLongFormatter.format(session.startDateTime)
  );
  const times = sessions.map((session) =>
    formatEasternTimeOnly(session.startDateTime)
  );
  const durations = sessions.map((session) =>
    Math.round(
      (session.endDateTime.getTime() - session.startDateTime.getTime()) / 60_000
    )
  );

  const [weekday] = weekdays;
  const [time] = times;
  if (
    weekday === undefined ||
    time === undefined ||
    weekdays.some((value) => value !== weekday) ||
    times.some((value) => value !== time)
  ) {
    return null;
  }

  const [durationMinutes] = durations;
  const sharedDuration =
    durationMinutes !== undefined &&
    durationMinutes > 0 &&
    durations.every((value) => value === durationMinutes)
      ? durationMinutes
      : null;

  return {
    durationMinutes: sharedDuration,
    time,
    weekdayPlural: `${weekday}s`,
  };
}
