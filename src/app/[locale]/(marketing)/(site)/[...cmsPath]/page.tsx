import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { CmsPageBlocks } from '@/components/mit-sailing/cms/CmsPageBlocks';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';

type CmsCatchAllPageProps = {
  params: Promise<{ locale: string; cmsPath: string[] }>;
};

function pathFromSegments(segments: string[]): string {
  return `/${segments.join('/')}`;
}

const loadPublishedCmsPageByPathCached = cache(loadPublishedCmsPageByPath);

export async function generateMetadata(
  props: CmsCatchAllPageProps
): Promise<Metadata> {
  const { cmsPath } = await props.params;
  const page = await loadPublishedCmsPageByPathCached(
    pathFromSegments(cmsPath)
  );
  if (!page) {
    return {};
  }
  const description = page.metaDescription || undefined;
  return {
    title: page.metaTitle,
    description,
    openGraph: {
      title: page.metaTitle,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.metaTitle,
      description,
    },
  };
}

export default async function CmsCatchAllPage(props: CmsCatchAllPageProps) {
  const { locale, cmsPath } = await props.params;
  setRequestLocale(locale);
  const page = await loadPublishedCmsPageByPathCached(
    pathFromSegments(cmsPath)
  );
  if (!page) {
    notFound();
  }
  return (
    <>
      <PublicAdminEditLink
        className="mx-auto mb-0 w-full max-w-5xl px-6 pt-4"
        href={adminCatalogResourceEditPath('cms_pages', page.id)}
      />
      <CmsPageBlocks page={page} />
    </>
  );
}
