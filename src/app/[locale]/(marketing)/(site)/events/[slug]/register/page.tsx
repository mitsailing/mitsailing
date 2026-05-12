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
import { getI18nPath } from '@/utils/Helpers';

type RegisterPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ registration?: string }>;
};

function EventScheduleSummary(props: {
  event: PublicEventDetail;
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingEvents'>>>;
}) {
  const dateSummary =
    props.event.dates.length > 0
      ? props.event.dates
          .map((date) =>
            formatEasternEventRange(date.startDateTime, date.endDateTime)
          )
          .join(', ')
      : props.t('date_to_be_announced');

  return (
    <p
      aria-label={props.t('field_schedule')}
      className="mb-5 text-sm leading-snug text-muted-foreground"
    >
      {dateSummary}
    </p>
  );
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
  return { title: `${t('registration_dialog_eyebrow')} - ${event.name}` };
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

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: tRoutes('section_events'), href: '/events/' },
        { label: event.name, href: `/events/${event.slug}` },
        { label: t('registration_dialog_eyebrow') },
      ]}
    >
      <SiteSectionMain variant="compactDetail">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-xs font-bold tracking-widest text-mit-red uppercase dark:text-white">
            {t('registration_dialog_eyebrow')}
          </p>
          <h1 className="mb-6 font-mit-serif text-[clamp(1.875rem,5vw,2.75rem)] leading-tight font-semibold tracking-tight text-mit-text">
            {event.name}
          </h1>
          <EventScheduleSummary event={event} t={t} />
          {errorMessage ? (
            <p
              className="mb-5 rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
            labels={eventRegistrationFormLabels(t)}
            locale={locale}
          />
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
