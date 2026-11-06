import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@/generated/prisma/client';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';
import { plainTextFromNewsHtmlish } from '@/libs/mit-sailing/newsPlainText';
import type {
  NewsBannerRow,
  NewsPublicItem,
} from '@/libs/mit-sailing/newsTypes';
import { sanitizeNewsBodyHtmlForBanner } from '@/libs/mit-sailing/sanitizeNewsHtml';

export { buildNewsBannerCollapseAlerts } from '@/libs/mit-sailing/newsBannerCollapse';

export const NEWS_CACHE_TAG = 'news';

const NEWS_BANNER_REVALIDATE_SECONDS = 60 * 60;

/**
 * Prisma `where` for banner eligibility on one Eastern calendar day.
 *
 * Uses the same UTC-midnight `Date` values as {@link prismaDateFromIsoCalendar}
 * for Postgres `DATE` bounds.
 *
 * @param todayIso - Eastern “today” key `YYYY-MM-DD` (same basis as {@link nyYmd})
 * @returns Clause or `null` when `todayIso` is not a valid calendar date
 */
export function prismaWhereNewsBannerForCalendarDay(
  todayIso: string
): Prisma.NewsWhereInput | null {
  const todayDate = prismaDateFromIsoCalendar(todayIso);
  if (!todayDate) {
    return null;
  }
  return {
    isPublished: true,
    startDate: { lte: todayDate },
    lastDate: { gte: todayDate },
  };
}

function toPublicItem(row: {
  id: string;
  body: string;
  startDate: Date;
}): NewsPublicItem {
  return {
    id: row.id,
    startDateIso: isoCalendarDateFromPrismaDate(row.startDate),
    body: row.body,
  };
}

const listNewsForBannerByDay = unstable_cache(
  async (todayIso: string): Promise<NewsPublicItem[]> => {
    const where = prismaWhereNewsBannerForCalendarDay(todayIso);
    if (!where) {
      return [];
    }

    const rows = await prisma.news.findMany({
      where,
      orderBy: { startDate: 'desc' },
      select: {
        body: true,
        id: true,
        startDate: true,
      },
    });
    return rows.map(toPublicItem);
  },
  ['news-banner-by-day'],
  {
    revalidate: NEWS_BANNER_REVALIDATE_SECONDS,
    tags: [NEWS_CACHE_TAG],
  }
);

/**
 * Lists news eligible for the home banner strip at `now`.
 *
 * @param now - Evaluation instant (typically server request time)
 * @returns Ordering by newest {@link startDate} first
 */
export async function listNewsForBannerAt(
  now: Date
): Promise<NewsPublicItem[]> {
  const todayIso = nyYmd(now);
  const rows = await listNewsForBannerByDay(todayIso);
  return rows;
}

/**
 * Lists published news for `/news` whose start date is today or earlier,
 * including rows past `lastDate`.
 *
 * @param now - Evaluation instant (typically server request time)
 * @returns Same ordering as the banner query subset would use for active rows
 */
export async function listPublishedNews(
  now: Date = new Date()
): Promise<NewsPublicItem[]> {
  const todayIso = nyYmd(now);
  const todayDate = prismaDateFromIsoCalendar(todayIso);
  if (!todayDate) {
    return [];
  }

  const rows = await prisma.news.findMany({
    where: {
      isPublished: true,
      startDate: { lte: todayDate },
    },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      body: true,
      startDate: true,
    },
  });
  return rows.map(toPublicItem);
}

/**
 * Maps public items to banner-ready rows with date labels and display HTML.
 *
 * @param items - Banner-eligible news from {@link listNewsForBannerAt}
 * @returns Data for {@link NewsBanner}
 */
export function mapNewsToBannerRows(items: NewsPublicItem[]): NewsBannerRow[] {
  return items.map((item) => {
    const dateIso = item.startDateIso;
    return {
      id: item.id,
      bodyHtml: sanitizeNewsBodyHtmlForBanner(item.body),
      bodyPlainText: plainTextFromNewsHtmlish(item.body),
      dateLabel: formatEasternShortDateFromIsoCalendar(dateIso),
      dateIso,
    };
  });
}
