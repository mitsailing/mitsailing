import config from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
import type { Metadata } from 'next';
import { requireCmsStaffSession } from '@/payload/requireCmsStaffSession';
import { importMap } from '../importMap.js';

type CmsAdminPageProps = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata(
  props: CmsAdminPageProps
): Promise<Metadata> {
  const metadata = await generatePageMetadata({
    config,
    params: props.params,
    searchParams: props.searchParams,
  });
  return metadata;
}

/**
 * Payload admin UI at `/cms`. Staff sessions continue; sailors redirect to login.
 *
 * @param props - Payload admin page props
 * @param props.params - Optional `/cms` path segments
 * @param props.searchParams - Admin query string
 * @returns Payload RootPage or a redirect to login
 */
export default async function CmsAdminPage(props: CmsAdminPageProps) {
  await requireCmsStaffSession();
  return RootPage({
    config,
    params: props.params,
    searchParams: props.searchParams,
    importMap,
  });
}
