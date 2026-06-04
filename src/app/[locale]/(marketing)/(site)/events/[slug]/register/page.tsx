import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import {
  EventRegistrationForm,
  eventRegistrationFormLabels,
} from '@/components/mit-sailing/events/EventRegistrationForm';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';
import {
  getPublicEventRegistrationState,
  getPublishedEventForPublicBySlug,
} from '@/libs/mit-sailing/eventQueries';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { createPublicEventRegistrationAction } from '@/libs/mit-sailing/eventRegistrationActions';
import {
  eventRegistrationErrorMessage,
  parseEventRegistrationMutationCode,
} from '@/libs/mit-sailing/eventRegistrationErrors';
import { publicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { eventUsesLearnToSailWaitlist } from '@/libs/mit-sailing/learnToSailEvents';
import { getI18nPath } from '@/utils/Helpers';

type RegisterPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ registration?: string }>;
};

function EventScheduleSummary(props: {
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}) {
  if (props.event.dates.length === 0) {
    return (
      <p className="mb-5 text-sm leading-snug text-muted-foreground">
        <span className="sr-only">{props.t('field_schedule')}: </span>
        {props.t('date_to_be_announced')}
      </p>
    );
  }

  return (
    <div className="mb-5 text-sm leading-snug text-muted-foreground">
      <span className="sr-only">{props.t('field_schedule')}: </span>
      <ul className="m-0 list-none space-y-1 p-0">
        {props.event.dates.map((date) => (
          <li key={date.id}>
            {formatEasternEventRange(date.startDateTime, date.endDateTime)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function registrationPageActionLabel(props: {
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}): string {
  return eventUsesLearnToSailWaitlist(props.event)
    ? props.t('registration_request_class_eyebrow')
    : props.t('registration_dialog_eyebrow');
}

export async function generateMetadata(
  props: RegisterPageProps
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const event = await getPublishedEventForPublicBySlug(slug);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingEvents',
  });
  if (!event) {
    return { title: t('meta_title_not_found') };
  }
  const actionLabel = registrationPageActionLabel({ event, t });
  return { title: `${actionLabel} - ${event.name}` };
}

export default async function EventRegisterPage(props: RegisterPageProps) {
  await connection();
  const { locale, slug } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const [event, t, tRoutes] = await Promise.all([
    getPublishedEventForPublicBySlug(slug),
    getTranslations({ locale, namespace: 'MitSailingEvents' }),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
  ]);
  if (!event) {
    notFound();
  }
  const currentUser = await requireCurrentUser(
    locale,
    `/events/${encodeURIComponent(slug)}/register`
  );
  const currentRegistration = await getPublicEventRegistrationState({
    eventId: event.id,
    userId: currentUser.id,
  });
  const profileContact = await prisma.user.findUnique({
    select: { phone: true },
    where: { id: currentUser.id },
  });
  const errorCode = parseEventRegistrationMutationCode(
    searchParams?.registration
  );
  const reservationState = publicEventReservationState({
    currentRegistration,
    event,
    now: new Date(),
  });
  if (reservationState !== 'available' && !errorCode) {
    redirect(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
  }
  const errorMessage = eventRegistrationErrorMessage(errorCode, t);
  const actionLabel = registrationPageActionLabel({ event, t });

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: tRoutes('section_events'), href: '/events/' },
        { label: event.name, href: `/events/${event.slug}` },
        { label: actionLabel },
      ]}
    >
      <SiteSectionMain variant="compactDetail">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-xs font-bold tracking-widest text-mit-red uppercase dark:text-mit-red-ink">
            {actionLabel}
          </p>
          <h1 className="mb-6 font-mit-serif text-[clamp(1.875rem,5vw,2.75rem)] leading-tight font-semibold tracking-tight text-mit-text">
            {event.name}
          </h1>
          <EventScheduleSummary event={event} t={t} />
          {errorMessage ? (
            <p
              className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          <EventRegistrationForm
            createRegistrationAction={createPublicEventRegistrationAction.bind(
              null,
              locale,
              event.slug
            )}
            event={event}
            formPermalink={getI18nPath(
              `/events/${encodeURIComponent(event.slug)}/register`,
              locale
            )}
            initialPhone={profileContact?.phone ?? null}
            labels={eventRegistrationFormLabels(t)}
            locale={locale}
          />
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
