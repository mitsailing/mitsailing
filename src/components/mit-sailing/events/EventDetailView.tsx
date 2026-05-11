import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';
import { publicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { EventRegistrationCta } from './EventRegistrationCta';

type EventDetailViewProps = {
  currentRegistration: PublicEventRegistrationState | null;
  errorCode: string | null;
  locale: string;
  event: PublicEventDetail;
  isSignedIn: boolean;
};

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

function questionTypeLabel(props: {
  answerType: PublicEventDetail['registrationQuestions'][number]['answerType'];
  text: string;
  select: string;
  checkbox: string;
}): string {
  if (props.answerType === 'checkbox') {
    return props.checkbox;
  }
  if (props.answerType === 'select') {
    return props.select;
  }
  return props.text;
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
  return t('registration_heading_available');
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
  const { event } = props;
  const registrationOpens = formatDateOnly(
    event.registrationStart,
    props.locale
  );
  const registrationCloses = formatDateOnly(
    event.registrationEnd,
    props.locale
  );
  const capacityLabel =
    event.maxParticipants === null
      ? t('capacity_no_limit')
      : t('capacity_limited', {
          approved: event.approvedRegistrationCount,
          capacity: event.maxParticipants,
        });
  const reservationState = publicEventReservationState({
    currentRegistration: props.currentRegistration,
    event,
    now: new Date(),
  });
  const registrationHeadingText = registrationHeading(
    reservationState,
    registrationOpens || t('date_to_be_announced'),
    t
  );

  return (
    <article>
      <PublicAdminEditLink
        href={`/admin/events/${encodeURIComponent(event.slug)}/edit`}
      />
      <Link
        className={cn(
          'mb-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red-ink no-underline hover:underline dark:text-white',
          textFocusRingClassName
        )}
        href="/events/"
      >
        <ArrowLeft aria-hidden size={16} />
        {t('back_to_list')}
      </Link>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <header className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-mit-red-highlight px-2 py-1 text-xs font-bold tracking-wide text-mit-red-ink uppercase dark:text-white">
              {event.category.name}
            </span>
            {event.isSpecial ? (
              <span className="rounded-sm bg-mit-red px-2 py-1 text-xs font-bold tracking-wide text-white uppercase">
                {t('badge_special')}
              </span>
            ) : null}
          </div>
          <h1 className="scroll-m-20 font-mit-serif text-[clamp(1.875rem,5vw,3rem)] leading-tight font-semibold tracking-tight text-balance text-mit-text">
            {event.name}
          </h1>
          {event.shortName && event.shortName !== event.name ? (
            <p className="mt-2 text-xl leading-7 text-muted-foreground">
              {event.shortName}
            </p>
          ) : null}
          <p className="mt-5 max-w-3xl text-base leading-relaxed whitespace-pre-wrap text-mit-text">
            {event.description}
          </p>
        </header>

        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-2 lg:self-start">
          <section className="rounded-lg border-2 border-mit-red bg-card p-5 shadow-sm shadow-mit-red/5 lg:sticky lg:top-24 dark:border-white/35">
            <p className="mb-1 text-xs font-bold tracking-widest text-mit-red-ink uppercase dark:text-white">
              {t('section_registration')}
            </p>
            <h2 className="mb-4 scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
              {registrationHeadingText}
            </h2>
            {event.detailPageKind === 'external' && event.externalDetailUrl ? (
              <a
                className={cn(
                  'mb-5 inline-flex min-h-10 items-center justify-center rounded-md bg-mit-red px-4 py-2 text-sm font-medium text-white no-underline hover:bg-mit-red-hover',
                  textFocusRingClassName
                )}
                href={event.externalDetailUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('external_cta')}
              </a>
            ) : (
              <EventRegistrationCta
                currentRegistration={props.currentRegistration}
                errorCode={props.errorCode}
                event={event}
                isSignedIn={props.isSignedIn}
                locale={props.locale}
                registrationCloses={
                  registrationCloses || t('date_to_be_announced')
                }
                registrationOpens={
                  registrationOpens || t('date_to_be_announced')
                }
                reservationState={reservationState}
                t={t}
              />
            )}
            <dl className="m-0 space-y-3 p-0">
              <MetaRow label={t('registration_opens')}>
                {registrationOpens || t('date_to_be_announced')}
              </MetaRow>
              <MetaRow label={t('registration_closes')}>
                {registrationCloses || t('date_to_be_announced')}
              </MetaRow>
              <MetaRow label={t('capacity_label')}>{capacityLabel}</MetaRow>
              <MetaRow label={t('approval_label')}>
                {event.requiresApproval
                  ? t('approval_required')
                  : t('approval_auto')}
              </MetaRow>
            </dl>
            {event.pendingRegistrationCount > 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t('pending_review', {
                  count: event.pendingRegistrationCount,
                })}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-mit-line bg-card p-5">
            <h2 className="mb-3 scroll-m-20 font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
              {t('section_admins')}
            </h2>
            {event.admins.length === 0 ? (
              <p className="text-sm leading-7 text-muted-foreground">
                {t('admins_empty')}
              </p>
            ) : (
              <ul className="m-0 list-none space-y-3 p-0">
                {event.admins.map((adminRow) => (
                  <li className="flex items-center gap-3" key={adminRow.id}>
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-mit-line bg-mit-surface text-xs font-bold text-mit-text"
                    >
                      {adminInitials(adminRow.admin.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-semibold text-mit-text">
                        {adminRow.admin.name}
                      </p>
                      <a
                        className={cn(
                          'block truncate text-xs text-mit-red-ink no-underline hover:underline dark:text-white',
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
          <section className="mb-10" aria-labelledby="event-schedule-heading">
            <SectionHeading id="event-schedule-heading">
              {t('field_schedule')}
            </SectionHeading>
            <ul className="m-0 list-none divide-y divide-mit-line border-t border-mit-line p-0">
              {event.dates.map((date) => (
                <li className="py-3 text-sm text-mit-text" key={date.id}>
                  {formatEasternEventRange(
                    date.startDateTime,
                    date.endDateTime
                  )}
                </li>
              ))}
            </ul>
          </section>

          {event.registrationQuestions.length > 0 ? (
            <section
              className="mb-10"
              aria-labelledby="event-registration-questions-heading"
            >
              <SectionHeading id="event-registration-questions-heading">
                {t('section_questions')}
              </SectionHeading>
              <p className="mb-3 text-sm leading-7 text-muted-foreground">
                {t('questions_intro')}
              </p>
              <ul className="m-0 list-none divide-y divide-mit-line border-t border-mit-line p-0">
                {event.registrationQuestions.map((question) => (
                  <li className="py-3" key={question.id}>
                    <p className="m-0 text-sm font-semibold text-mit-text">
                      {question.questionText}
                      {question.required ? (
                        <span
                          aria-label={t('question_required')}
                          className="ml-1 text-mit-red-ink"
                        >
                          *
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground capitalize">
                      {questionTypeLabel({
                        answerType: question.answerType,
                        text: t('question_type_text'),
                        select: t('question_type_select'),
                        checkbox: t('question_type_checkbox'),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {event.entryFees.length > 0 ? (
            <section className="mb-10" aria-labelledby="event-fees-heading">
              <SectionHeading id="event-fees-heading">
                {t('section_fees')}
              </SectionHeading>
              <ul className="m-0 list-none divide-y divide-mit-line border-t border-mit-line p-0">
                {event.entryFees.map((fee) => (
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
        </div>
      </div>
    </article>
  );
}
