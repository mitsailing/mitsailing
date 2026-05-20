import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { EventDetailView } from '@/components/mit-sailing/events/EventDetailView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getCurrentUser } from '@/libs/auth/dal';
import {
  getPublicEventRegistrationState,
  getPublishedEventForPublicBySlug,
} from '@/libs/mit-sailing/eventQueries';
import { redirectPublicSlugAliasOrNotFound } from '@/libs/mit-sailing/publicSlugRedirects';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ registration?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const event = await getPublishedEventForPublicBySlug(slug);
  if (!event) {
    const t = await getTranslations({
      locale,
      namespace: 'MitSailingEvents',
    });
    return { title: t('meta_title_not_found') };
  }
  return { title: event.name };
}

export default async function EventDetailPage(props: PageProps) {
  await connection();
  const { locale, slug } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const [event, t] = await Promise.all([
    getPublishedEventForPublicBySlug(slug),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
  ]);
  if (!event) {
    return redirectPublicSlugAliasOrNotFound({
      locale,
      scope: 'events',
      slug,
    });
  }
  const currentUser = await getCurrentUser();
  const currentRegistration = currentUser
    ? await getPublicEventRegistrationState({
        eventId: event.id,
        userId: currentUser.id,
      })
    : null;
  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: t('section_events'), href: '/events/' },
        { label: event.name },
      ]}
    >
      <SiteSectionMain variant="compactDetail">
        <EventDetailView
          currentRegistration={currentRegistration}
          errorCode={searchParams?.registration ?? null}
          event={event}
          isSignedIn={Boolean(currentUser)}
          locale={locale}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
