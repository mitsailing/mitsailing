import { ArrowLeft, MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { PublicCatalogDetailTopNav } from '@/components/mit-sailing/admin/PublicCatalogDetailTopNav';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { safeExternalHttpHref } from '@/libs/mit-sailing/cmsHref';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';
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

function MetaRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </dt>
      <dd className="m-0 text-right text-sm text-foreground">
        {props.children}
      </dd>
    </div>
  );
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
        <header className="lg:col-span-2">
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
          {props.event.shortName &&
          props.event.shortName !== props.event.name ? (
            <p className="mt-2 text-xl leading-7 text-muted-foreground">
              {props.event.shortName}
            </p>
          ) : null}
          <p className="mt-5 max-w-3xl text-base leading-relaxed whitespace-pre-wrap text-mit-text">
            {props.event.description}
          </p>
        </header>

        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-2 lg:self-start">
          <section className="rounded-lg border-2 border-mit-red bg-card p-5 shadow-sm shadow-mit-red/5 lg:sticky lg:top-24 dark:border-white/35">
            <p className="mb-1 text-xs font-bold tracking-widest text-mit-red uppercase dark:text-white">
              {t('section_registration')}
            </p>
            <h2 className="mb-4 scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
              {registrationHeadingText}
            </h2>
            {registrationActionContent}
            <dl className="m-0 mt-5 flex flex-col gap-3 p-0">
              <MetaRow label={registrationMeta.opens}>
                {registrationOpens || t('date_to_be_announced')}
              </MetaRow>
              <MetaRow label={registrationMeta.closes}>
                {registrationCloses || t('date_to_be_announced')}
              </MetaRow>
              <MetaRow label={t('capacity_label')}>{capacityLabel}</MetaRow>
              <MetaRow label={t('approval_label')}>
                {props.event.requiresApproval
                  ? t('approval_required')
                  : t('approval_auto')}
              </MetaRow>
            </dl>
            {props.event.pendingRegistrationCount > 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t('pending_review', {
                  count: props.event.pendingRegistrationCount,
                })}
              </p>
            ) : null}
          </section>

          {addressLines.length > 0 ? (
            <section className="rounded-lg border border-mit-line bg-card p-5">
              <h2 className="mb-3 flex scroll-m-20 items-center gap-2 font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
                <MapPin aria-hidden className="size-5" />
                {t('section_location')}
              </h2>
              <address className="not-italic">
                <a
                  className={cn(
                    'block text-sm leading-6 text-mit-red no-underline hover:underline dark:text-mit-red-ink',
                    textFocusRingClassName
                  )}
                  href={eventAddressMapHref(addressLines)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {addressLines.map((line) => (
                    <span className="block" key={line}>
                      {line}
                    </span>
                  ))}
                  <span className="mt-2 inline-block text-xs font-semibold">
                    {t('location_map_link')}
                  </span>
                </a>
              </address>
            </section>
          ) : null}

          <section className="rounded-lg border border-mit-line bg-card p-5">
            <h2 className="mb-3 scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
              {t('section_admins')}
            </h2>
            {props.event.admins.length === 0 ? (
              <p className="text-sm leading-7 text-muted-foreground">
                {t('admins_empty')}
              </p>
            ) : (
              <ul className="m-0 list-none space-y-3 p-0">
                {props.event.admins.map((adminRow) => (
                  <li className="flex items-center gap-3" key={adminRow.id}>
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-mit-line bg-mit-surface text-xs font-bold text-mit-text"
                    >
                      {adminInitials(adminRow.admin.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold break-words text-mit-text">
                        {adminRow.admin.name}
                      </p>
                      <a
                        className={cn(
                          'block break-words text-xs text-mit-red no-underline hover:underline dark:text-white',
                          textFocusRingClassName
                        )}
                        href={`mailto:${adminRow.admin.email}`}
                      >
                        {adminRow.admin.email}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {props.event.dates.length > 0 ? (
            <section className="mb-10" aria-labelledby="event-schedule-heading">
              <SectionHeading id="event-schedule-heading">
                {t('field_schedule')}
              </SectionHeading>
              <ul className="m-0 list-none divide-y divide-mit-line border-t border-mit-line p-0">
                {props.event.dates.map((date) => (
                  <li className="py-3 text-sm text-mit-text" key={date.id}>
                    {formatEasternEventRange(
                      date.startDateTime,
                      date.endDateTime
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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
