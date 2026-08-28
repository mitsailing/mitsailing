import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PavilionSpaceDetailView } from '@/components/mit-sailing/pavilion-reservations/PavilionSpaceDetailView';
import { getVisiblePavilionSpaceBySlug } from '@/libs/mit-sailing/pavilionReservationQueries';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const space = await getVisiblePavilionSpaceBySlug(slug);
  if (!space) {
    const t = await getTranslations({
      locale,
      namespace: 'PavilionSpacePage',
    });
    return { title: t('meta_not_found_title') };
  }
  return {
    title: space.name,
    description: space.description,
  };
}

/**
 * Public pavilion space detail for share/direct links from /reserve.
 *
 * @param props - App Router page props
 * @returns Space detail or not-found
 */
export default async function PavilionSpacePage(props: PageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const space = await getVisiblePavilionSpaceBySlug(slug);
  if (!space) {
    notFound();
  }
  return <PavilionSpaceDetailView locale={locale} space={space} />;
}
