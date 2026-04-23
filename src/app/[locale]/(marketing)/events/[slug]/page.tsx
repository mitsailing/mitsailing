import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventDetailView } from '@/components/mit-sailing/events/EventDetailView';
import { getPublishedEventForPublicBySlug } from '@/libs/mit-sailing/eventQueries';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const event = await getPublishedEventForPublicBySlug(
    decodeURIComponent(slug)
  );
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
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  setRequestLocale(locale);
  const event = await getPublishedEventForPublicBySlug(slug);
  if (!event) {
    notFound();
  }
  return <EventDetailView event={event} locale={locale} />;
}
