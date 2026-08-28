import type { MetadataRoute } from 'next';
import { Env } from '@/libs/Env';
import { getBaseUrl } from '@/utils/Helpers';

export default function robots(): MetadataRoute.Robots {
  const rules = {
    userAgent: '*',
    allow: '/',
  } as const;

  // Preview deploys stay crawlable so Google can see metadata.robots noindex.
  // Do not Disallow: / — that can strand already-indexed URLs.
  if (Env.STAGING_BANNER === 'yes') {
    return { rules };
  }

  return {
    rules,
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
