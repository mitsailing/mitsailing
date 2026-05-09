import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CmsPageBlocks } from '@/components/mit-sailing/cms/CmsPageBlocks';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';

type CmsCatchAllPageProps = {
  params: Promise<{ locale: string; cmsPath: string[] }>;
};

function pathFromSegments(segments: string[]): string {
  return `/${segments.map((segment) => decodeURIComponent(segment)).join('/')}/`;
}

export async function generateMetadata(
  props: CmsCatchAllPageProps
): Promise<Metadata> {
  const { cmsPath } = await props.params;
  const page = await loadPublishedCmsPageByPath(pathFromSegments(cmsPath));
  if (!page) {
    return {};
  }
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function CmsCatchAllPage(props: CmsCatchAllPageProps) {
  const { locale, cmsPath } = await props.params;
  setRequestLocale(locale);
  const page = await loadPublishedCmsPageByPath(pathFromSegments(cmsPath));
  if (!page) {
    notFound();
  }
  return <CmsPageBlocks page={page} />;
}
