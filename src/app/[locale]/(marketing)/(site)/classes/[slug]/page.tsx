import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ClassDetailView } from '@/components/mit-sailing/classes/ClassDetailView';
import { getSailingClassCatalogBySlug } from '@/libs/mit-sailing/classQueries';
import { getClassRelatedEventOccurrenceBlocks } from '@/libs/mit-sailing/classRelatedOccurrences';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const sailingClass = await getSailingClassCatalogBySlug(slug);
  if (!sailingClass) {
    const t = await getTranslations({
      locale,
      namespace: 'MitSailingClasses',
    });
    return { title: t('meta_not_found_title') };
  }
  return { title: sailingClass.name };
}

export default async function ClassDetailPage(props: PageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const sailingClass = await getSailingClassCatalogBySlug(slug);
  if (!sailingClass) {
    notFound();
  }
  const occurrenceBlocks = await getClassRelatedEventOccurrenceBlocks(
    sailingClass.relatedEventIds
  );
  return (
    <ClassDetailView
      locale={locale}
      occurrenceBlocks={occurrenceBlocks}
      sailingClass={sailingClass}
    />
  );
}
