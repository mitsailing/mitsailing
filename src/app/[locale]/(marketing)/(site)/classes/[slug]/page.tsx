import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ClassDetailView } from '@/components/mit-sailing/classes/ClassDetailView';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { adminEditLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { getSession } from '@/libs/auth/dal';
import { getSailingClassCatalogBySlug } from '@/libs/mit-sailing/classQueries';
import { getClassRelatedEventOccurrenceBlocks } from '@/libs/mit-sailing/classRelatedOccurrences';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
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
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  setRequestLocale(locale);
  const sailingClass = await getSailingClassCatalogBySlug(slug);
  if (!sailingClass) {
    notFound();
  }
  const occurrenceBlocks = await getClassRelatedEventOccurrenceBlocks(
    sailingClass.relatedEventIds
  );
  const session = await getSession();
  const adminEditHref = adminEditLinkVisibleFromSession({
    userId: session?.user?.id,
    userRole: session?.user?.role,
    impersonatedBy: session?.session?.impersonatedBy,
  })
    ? adminCatalogResourceEditPath('sailing_classes', sailingClass.id)
    : undefined;
  return (
    <ClassDetailView
      adminEditHref={adminEditHref}
      locale={locale}
      occurrenceBlocks={occurrenceBlocks}
      sailingClass={sailingClass}
    />
  );
}
