import { CalendarDays, MapPin, Users } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { EVENTS_TIME_ZONE, nyYmd } from '@/lib/mit-sailing/nyTime';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';

const compactDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const compactDateNoYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  month: 'short',
  day: 'numeric',
});

const compactTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  hour: 'numeric',
  hour12: true,
  minute: '2-digit',
});
const safeRelativeAvatarImageUrlPattern = /^\/(?!\/)/;

function adminInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase() || '?';
}

function formatCompactEventRange(start: Date, end: Date): string {
  const startKey = nyYmd(start);
  const endKey = nyYmd(end);
  const startTime = compactTimeFormatter.format(start);
  const endTime = compactTimeFormatter.format(end);
  if (startKey === endKey) {
    return `${compactDateFormatter.format(start)}, ${startTime} – ${endTime}`;
  }

  const startYear = startKey.slice(0, 4);
  const endDate =
    startYear === endKey.slice(0, 4)
      ? compactDateNoYearFormatter.format(end)
      : compactDateFormatter.format(end);
  return `${compactDateFormatter.format(start)}, ${startTime} – ${endDate}, ${endTime}`;
}

function DetailFactSection(props: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <section
      aria-label={props.label}
      className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3"
    >
      <div className="pt-0.5 text-muted-foreground">{props.icon}</div>
      <div className="min-w-0 text-sm leading-5 text-mit-text">
        {props.children}
      </div>
    </section>
  );
}

function personInitials(name: string): string {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || '?';
}

const safeAvatarImageUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  if (safeRelativeAvatarImageUrlPattern.test(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

function avatarImageStyle(value: string): React.CSSProperties {
  return {
    backgroundImage: `url("${value.replaceAll('"', '%22')}")`,
  };
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function trimmedAddressPart(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function eventAddressLines(event: PublicEventDetail): string[] {
  return [
    trimmedAddressPart(event.addressName),
    trimmedAddressPart(event.addressLine1),
    trimmedAddressPart(event.addressLine2),
    [event.addressCity, event.addressState, event.addressPostalCode]
      .map(trimmedAddressPart)
      .filter(isNonEmptyString)
      .join(' '),
    trimmedAddressPart(event.addressCountry),
  ].filter(isNonEmptyString);
}

function eventAddressMapHref(lines: readonly string[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    lines.join(', ')
  )}`;
}

function eventAddressSummary(lines: readonly string[]): string {
  return lines.filter((line) => line !== 'US').join(', ');
}

function HostList(props: { event: PublicEventDetail }) {
  if (props.event.admins.length === 0) {
    return null;
  }
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {props.event.admins.map((adminRow) => (
        <li className="min-w-0" key={adminRow.id}>
          <a
            className={cn(
              'inline-flex max-w-full items-center gap-2 rounded-full border border-mit-line bg-card px-2.5 py-1 text-sm font-medium text-mit-text no-underline hover:border-mit-red/45 hover:text-mit-red dark:hover:text-mit-red-ink',
              textFocusRingClassName
            )}
            href={`mailto:${adminRow.admin.email}`}
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-bold text-muted-foreground"
            >
              {adminInitials(adminRow.admin.name)}
            </span>
            <span className="truncate">{adminRow.admin.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AttendeeAvatar(props: {
  attendee: PublicEventDetail['attendees']['approved'][number];
  muted?: boolean;
}) {
  const imageUrl = safeAvatarImageUrl(props.attendee.image);
  return (
    <span
      aria-label={props.attendee.name}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-mit-line bg-muted text-xs font-bold text-mit-text',
        props.muted ? 'opacity-65' : undefined
      )}
      role="img"
      title={props.attendee.name}
    >
      {imageUrl ? (
        <span
          aria-hidden
          className="size-full bg-cover bg-center"
          style={avatarImageStyle(imageUrl)}
        />
      ) : (
        personInitials(props.attendee.name)
      )}
    </span>
  );
}

function AttendeeRow(props: {
  attendees: PublicEventDetail['attendees']['approved'];
  label: string;
  muted?: boolean;
}) {
  if (props.attendees.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </p>
      <div className="flex gap-1.5 overflow-x-auto py-0.5">
        {props.attendees.map((attendee) => (
          <AttendeeAvatar
            attendee={attendee}
            key={attendee.id}
            muted={props.muted}
          />
        ))}
      </div>
    </div>
  );
}

function EventAttendees(props: {
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}) {
  if (
    props.event.attendees.approved.length === 0 &&
    props.event.attendees.pending.length === 0
  ) {
    return null;
  }
  return (
    <DetailFactSection
      icon={<Users aria-hidden className="size-4" />}
      label={props.t('attendees_heading')}
    >
      <div className="grid gap-2">
        <AttendeeRow
          attendees={props.event.attendees.approved}
          label={props.t('attendees_going')}
        />
        <AttendeeRow
          attendees={props.event.attendees.pending}
          label={props.t('attendees_pending')}
          muted
        />
      </div>
    </DetailFactSection>
  );
}

export function EventDetailFacts(props: {
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}) {
  const addressLines = eventAddressLines(props.event);
  const addressMapHrefProps = { href: eventAddressMapHref(addressLines) };
  return (
    <div className="mt-5 grid max-w-3xl gap-3 border-y border-mit-line py-3.5">
      <DetailFactSection
        icon={<CalendarDays aria-hidden className="size-4" />}
        label={props.t('field_schedule')}
      >
        {props.event.dates.length > 0 ? (
          <ul className="m-0 list-none space-y-0.5 p-0 font-medium">
            {props.event.dates.map((date) => (
              <li key={date.id}>
                {formatCompactEventRange(date.startDateTime, date.endDateTime)}
              </li>
            ))}
          </ul>
        ) : (
          props.t('date_to_be_announced')
        )}
      </DetailFactSection>
      {props.event.admins.length > 0 ? (
        <DetailFactSection
          icon={<Users aria-hidden className="size-4" />}
          label={props.t('hosted_by')}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-muted-foreground">
              {props.t('hosted_by')}
            </span>
            <HostList event={props.event} />
          </div>
        </DetailFactSection>
      ) : null}
      {addressLines.length > 0 ? (
        <DetailFactSection
          icon={<MapPin aria-hidden className="size-4" />}
          label={props.t('section_location')}
        >
          <a
            className={cn(
              'inline-flex flex-col text-mit-red no-underline hover:underline dark:text-mit-red-ink',
              textFocusRingClassName
            )}
            {...addressMapHrefProps}
            rel="noopener noreferrer"
            target="_blank"
          >
            {eventAddressSummary(addressLines)}
          </a>
        </DetailFactSection>
      ) : null}
      <EventAttendees event={props.event} t={props.t} />
    </div>
  );
}
