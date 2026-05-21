import { ArrowLeft, CalendarDays, MapPin, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { PublicCatalogDetailTopNav } from '@/components/mit-sailing/admin/PublicCatalogDetailTopNav';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { EVENTS_TIME_ZONE, nyYmd } from '@/lib/mit-sailing/nyTime';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { safeExternalHttpHref } from '@/libs/mit-sailing/cmsHref';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';
import { cancelPublicEventRegistrationAction } from '@/libs/mit-sailing/eventRegistrationActions';
import { publicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { getI18nPath } from '@/utils/Helpers';
import { EventRegistrationCta } from './EventRegistrationCta';

type EventDetailViewProps = {
  currentRegistration: PublicEventRegistrationState | null;
  errorCode: string | null;
  locale: string;
  event: PublicEventDetail;
  isSignedIn: boolean;
};

type PublicContentSection = NonNullable<
  PublicEventDetail['publicContentSections']
>[number];

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

function formatDateOnly(date: Date | null, locale: string): string {
  if (!date) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: EVENTS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function adminInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase() || '?';
}

function SectionHeading(props: { children: React.ReactNode; id: string }) {
  return (
    <h2
      className="mb-3 scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text md:text-2xl"
      id={props.id}
    >
      {props.children}
    </h2>
  );
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

function MetaRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </dt>
      <dd className="m-0 text-right text-sm font-medium text-mit-text">
        {props.children}
      </dd>
    </div>
  );
}

function personInitials(name: string): string {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase() || '?';
}

function safeAvatarImageUrl(value: string | null): string | null {
  if (value?.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  if (!value) {
    return null;
  }
  if (URL.canParse(value)) {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  }
  return null;
}

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

function registrationHeading(
  state: PublicEventReservationState,
  registrationOpens: string,
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>
): string {
  if (state === 'approved' || state === 'pending') {
    return t('registration_heading_your_reservation');
  }
  if (state === 'opening_later') {
    return t('registration_heading_opening', { date: registrationOpens });
  }
  if (state === 'closed') {
    return t('registration_heading_closed');
  }
  if (state === 'full') {
    return t('registration_heading_full');
  }
  if (state === 'external') {
    return t('registration_heading_external');
  }
  if (state === 'unavailable') {
    return t('registration_heading_unavailable');
  }
  return t('registration_heading_available');
}

function dateTense(date: Date | null, now: Date): 'past' | 'present' {
  return date && date <= now ? 'past' : 'present';
}

function registrationMetaLabels(props: {
  event: PublicEventDetail;
  now: Date;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}): { opens: string; closes: string } {
  return {
    opens: props.t('registration_opens_label', {
      tense: dateTense(props.event.registrationStart, props.now),
    }),
    closes: props.t('registration_closes_label', {
      tense: dateTense(props.event.registrationEnd, props.now),
    }),
  };
}

function showRegistrationOpens(event: PublicEventDetail, now: Date): boolean {
  return event.registrationStart !== null && event.registrationStart > now;
}

function showRegistrationCloses(event: PublicEventDetail): boolean {
  return event.registrationEnd !== null;
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

function EventDetailFacts(props: {
  addressLines: string[];
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}) {
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
      {props.addressLines.length > 0 ? (
        <DetailFactSection
          icon={<MapPin aria-hidden className="size-4" />}
          label={props.t('section_location')}
        >
          <a
            className={cn(
              'inline-flex flex-col text-mit-red no-underline hover:underline dark:text-mit-red-ink',
              textFocusRingClassName
            )}
            href={eventAddressMapHref(props.addressLines)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {eventAddressSummary(props.addressLines)}
          </a>
        </DetailFactSection>
      ) : null}
      <EventAttendees event={props.event} t={props.t} />
    </div>
  );
}

function visiblePublicContentSections(
  sections: PublicEventDetail['publicContentSections']
): PublicContentSection[] {
  return (sections ?? []).filter((section) => section.body.trim().length > 0);
}

function eventDetailReservationState(props: {
  currentRegistration: PublicEventRegistrationState | null;
  event: PublicEventDetail;
  externalRegistrationUrl: string | null;
  now: Date;
}): PublicEventReservationState {
  if (
    props.event.registrationMode === 'external' &&
    !props.externalRegistrationUrl
  ) {
    return 'unavailable';
  }
  return publicEventReservationState({
    currentRegistration: props.currentRegistration,
    event: props.event,
    now: props.now,
  });
}

/**
 * @param props - Detail view props
 * @param props.locale - Active locale
 * @param props.event - Published event detail DTO
 * @returns Server-rendered event detail
 */
export async function EventDetailView(props: EventDetailViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingEvents',
  });
  const registrationOpens = formatDateOnly(
    props.event.registrationStart,
    props.locale
  );
  const registrationCloses = formatDateOnly(
    props.event.registrationEnd,
    props.locale
  );
  const capacityLabel =
    props.event.maxParticipants === null
      ? t('capacity_no_limit')
      : t('capacity_limited', {
          approved: props.event.approvedRegistrationCount,
          capacity: props.event.maxParticipants,
        });
  const now = new Date();
  const registrationMeta = registrationMetaLabels({
    event: props.event,
    now,
    t,
  });
  const shouldShowRegistrationOpens = showRegistrationOpens(props.event, now);
  const shouldShowRegistrationCloses = showRegistrationCloses(props.event);
  const externalRegistrationUrl = safeExternalHttpHref(
    props.event.registrationMode === 'external'
      ? props.event.externalRegistrationUrl
      : null
  );
  const externalEntriesUrl = safeExternalHttpHref(
    props.event.externalEntriesUrl
  );
  const reservationState = eventDetailReservationState({
    currentRegistration: props.currentRegistration,
    event: props.event,
    externalRegistrationUrl,
    now,
  });
  const publicContentSections = visiblePublicContentSections(
    props.event.publicContentSections
  );
  const registrationHeadingText = registrationHeading(
    reservationState,
    registrationOpens || t('date_to_be_announced'),
    t
  );
  let registrationActionContent: React.ReactNode;
  if (externalRegistrationUrl) {
    registrationActionContent = (
      <div className="flex flex-col items-start gap-3">
        <a
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-md bg-mit-red px-4 py-2 text-sm font-medium text-white no-underline hover:bg-mit-red-hover dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-white/30',
            textFocusRingClassName
          )}
          href={externalRegistrationUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('external_cta')}
        </a>
        {externalEntriesUrl ? (
          <a
            className={cn(
              'text-sm font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
              textFocusRingClassName
            )}
            href={externalEntriesUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('external_entries_cta')}
          </a>
        ) : null}
      </div>
    );
  } else if (reservationState === 'unavailable') {
    registrationActionContent = (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('registration_unavailable')}
      </p>
    );
  } else {
    registrationActionContent = (
      <EventRegistrationCta
        cancelRegistrationAction={cancelPublicEventRegistrationAction.bind(
          null,
          props.locale,
          props.event.slug
        )}
        errorCode={props.errorCode}
        currentRegistration={props.currentRegistration}
        event={props.event}
        isSignedIn={props.isSignedIn}
        locale={props.locale}
        registrationOpens={registrationOpens || t('date_to_be_announced')}
        reservationState={reservationState}
        t={t}
      />
    );
  }
  const addressLines = eventAddressLines(props.event);

  return (
    <article>
      <PublicCatalogDetailTopNav>
        <Link
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
            textFocusRingClassName
          )}
          href={getI18nPath('/events', props.locale)}
        >
          <ArrowLeft aria-hidden size={16} />
          {t('back_to_list')}
        </Link>
        <PublicAdminEditLink
          className="mb-0 ml-auto shrink-0"
          href={getI18nPath(
            `/admin/events/${encodeURIComponent(props.event.slug)}/edit`,
            props.locale
          )}
        />
      </PublicCatalogDetailTopNav>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <header className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-mit-red-highlight px-2 py-1 text-xs font-bold tracking-wide text-mit-red uppercase dark:text-white">
              {props.event.category.name}
            </span>
            {props.event.isSpecial ? (
              <span className="rounded-sm bg-mit-red px-2 py-1 text-xs font-bold tracking-wide text-white uppercase">
                {t('badge_special')}
              </span>
            ) : null}
          </div>
          <h1 className="scroll-m-20 font-mit-serif text-[clamp(1.875rem,5vw,3rem)] leading-tight font-semibold tracking-tight text-balance text-mit-text">
            {props.event.name}
          </h1>
          <EventDetailFacts
            addressLines={addressLines}
            event={props.event}
            t={t}
          />
          <p className="mt-5 max-w-3xl text-base leading-relaxed whitespace-pre-wrap text-mit-text">
            {props.event.description}
          </p>
        </header>

        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:self-start">
          <section
            aria-labelledby="event-registration-panel-heading"
            className="overflow-hidden rounded-lg border border-mit-line bg-card shadow-sm shadow-foreground/5 lg:sticky lg:top-24"
          >
            <div className="border-b border-mit-line p-5">
              <p className="mb-1 text-xs font-bold tracking-widest text-mit-red uppercase dark:text-white">
                {t('section_registration')}
              </p>
              <h2
                className="scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text"
                id="event-registration-panel-heading"
              >
                {registrationHeadingText}
              </h2>
              <div className="mt-4">{registrationActionContent}</div>
            </div>
            <dl className="m-0 divide-y divide-mit-line px-5 py-1">
              {shouldShowRegistrationOpens ? (
                <MetaRow label={registrationMeta.opens}>
                  {registrationOpens}
                </MetaRow>
              ) : null}
              {shouldShowRegistrationCloses ? (
                <MetaRow label={registrationMeta.closes}>
                  {registrationCloses}
                </MetaRow>
              ) : null}
              <MetaRow label={t('capacity_label')}>{capacityLabel}</MetaRow>
              <MetaRow label={t('approval_label')}>
                {props.event.requiresApproval
                  ? t('approval_required')
                  : t('approval_auto')}
              </MetaRow>
            </dl>
          </section>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {props.event.entryFees.length > 0 ? (
            <section className="mb-10" aria-labelledby="event-fees-heading">
              <SectionHeading id="event-fees-heading">
                {t('section_fees')}
              </SectionHeading>
              <ul className="m-0 list-none divide-y divide-mit-line border-t border-mit-line p-0">
                {props.event.entryFees.map((fee) => (
                  <li
                    className="flex items-baseline justify-between gap-4 py-3"
                    key={fee.id}
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold text-mit-text">
                        {fee.description}
                      </p>
                      {fee.isDeposit ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('fee_deposit')}
                        </p>
                      ) : null}
                    </div>
                    <p className="m-0 text-sm font-semibold text-mit-text">
                      {formatUsdMinorUnitsAsCurrency(
                        fee.amountCents,
                        props.locale
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {publicContentSections.map((section) => (
            <section
              aria-labelledby={`event-public-content-${section.id}-heading`}
              className="mb-10"
              key={section.id}
            >
              <SectionHeading id={`event-public-content-${section.id}-heading`}>
                {t(section.titleKey)}
              </SectionHeading>
              <CmsRichText
                className="text-base leading-relaxed text-mit-text"
                sanitizedHtml={section.body}
              />
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
