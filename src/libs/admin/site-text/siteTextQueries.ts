import 'server-only';
import { prisma } from '@/libs/DB';
import {
  listSiteTextEntries,
  listStaleSiteTextOverrides,
} from '@/libs/site-text/siteTextMessages';
import type {
  SiteTextEntry,
  SiteTextOverrideInput,
} from '@/libs/site-text/siteTextMessages';

export type SiteTextAdminRows = {
  entries: SiteTextEntry[];
  staleOverrides: SiteTextOverrideInput[];
};

/**
 * Loads editable site text rows and stale override diagnostics.
 *
 * @param locale - Locale to inspect
 * @returns Admin table rows and stale override list
 */
export async function getSiteTextAdminRows(
  locale: string
): Promise<SiteTextAdminRows> {
  const overrides = await prisma.siteTextOverride.findMany({
    where: { locale },
    orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
    select: {
      namespace: true,
      key: true,
      value: true,
      updatedAt: true,
      updatedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    entries: listSiteTextEntries(overrides),
    staleOverrides: listStaleSiteTextOverrides(overrides),
  };
}
