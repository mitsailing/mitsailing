import {
  buildNewsBannerCollapseAlerts,
  listNewsForBannerAt,
  mapNewsToBannerRows,
} from '@/libs/mit-sailing/newsQueries';
import { NewsBanner } from './site/NewsBanner';

/**
 * Resolves cached active news for the global shell top bar.
 *
 * @returns Top-bar news banner or nothing when no news is active
 */
export async function SiteShellNewsTopBar() {
  const items = await listNewsForBannerAt(new Date());
  const rows = mapNewsToBannerRows(items);
  if (rows.length === 0) {
    return null;
  }
  return (
    <NewsBanner
      collapseAlerts={buildNewsBannerCollapseAlerts(rows)}
      rows={rows}
    />
  );
}
