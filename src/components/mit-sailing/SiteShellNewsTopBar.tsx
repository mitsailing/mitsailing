import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { NEWS_BANNER_COLLAPSE_COOKIE } from '@/libs/mit-sailing/newsBannerCollapse';
import {
  listNewsForBannerAt,
  mapNewsToBannerRows,
} from '@/libs/mit-sailing/newsQueries';
import type { NewsBannerRow } from '@/libs/mit-sailing/newsTypes';
import { NewsBanner } from './site/NewsBanner';

/**
 * Short signature of the current banner rows.
 * A saved collapse matches only this value, so edited or new news opens the strip.
 *
 * @param rows Banner rows currently on the page
 * @returns Cookie-safe prefix of a SHA-256 digest
 */
function newsBannerCollapseSignature(rows: readonly NewsBannerRow[]) {
  const payload = JSON.stringify(
    rows
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((row) => [row.id, row.dateIso, row.bodyPlainText])
  );
  return createHash('sha256').update(payload).digest('base64url').slice(0, 16);
}

/**
 * Resolves cached active news for the global shell top bar.
 *
 * @returns Top-bar news banner or nothing when no news is active
 */
export async function SiteShellNewsTopBar() {
  const rows = mapNewsToBannerRows(await listNewsForBannerAt(new Date()));
  if (rows.length === 0) {
    return null;
  }
  const signature = newsBannerCollapseSignature(rows);
  const cookieStore = await cookies();
  return (
    <NewsBanner
      collapsed={
        cookieStore.get(NEWS_BANNER_COLLAPSE_COOKIE)?.value === signature
      }
      rows={rows}
      signature={signature}
    />
  );
}
