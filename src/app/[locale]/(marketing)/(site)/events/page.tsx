import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EventsListView } from '@/components/mit-sailing/events/EventsListView';
import { listPublishedEventsForPublic } from '@/libs/mit-sailing/eventQueries';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingEvents',
  });
  return { title: t('meta_title_list') };
}

export default async function EventsListPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingEvents',
  });
  const events = await listPublishedEventsForPublic();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        {t('list_heading')}
      </h1>
      <EventsListView events={events} locale={locale} />
    </div>
  );
}
