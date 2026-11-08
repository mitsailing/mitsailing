import config from '@payload-config';
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views';
import type { Metadata } from 'next';
import { requireCmsStaffSession } from '@/payload/requireCmsStaffSession';
import { importMap } from '../importMap.js';

type CmsAdminNotFoundPageProps = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata(
  props: CmsAdminNotFoundPageProps
): Promise<Metadata> {
  const metadata = await generatePageMetadata({
    config,
    params: props.params,
    searchParams: props.searchParams,
  });
  return metadata;
}

/**
 * Payload admin not-found view under `/cms`.
 *
 * @param props - Payload admin not-found props
 * @param props.params - Optional `/cms` path segments
 * @param props.searchParams - Admin query string
 * @returns Payload NotFoundPage or a redirect to login
 */
export default async function CmsAdminNotFoundPage(
  props: CmsAdminNotFoundPageProps
) {
  await requireCmsStaffSession();
  return NotFoundPage({
    config,
    params: props.params,
    searchParams: props.searchParams,
    importMap,
  });
}
