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

export const NEWS_CACHE_TAG = 'news';

const NEWS_BANNER_REVALIDATE_SECONDS = 60 * 60;

/** Latest start date first; same-day ties put the most recently created row first. */
export const newsListOrderBy = [
  { startDate: 'desc' },
  { createdAt: 'desc' },
] as const satisfies Prisma.NewsOrderByWithRelationInput[];

const NEWS_PUBLIC_SELECT = {
  id: true,
  body: true,
  startDate: true,
} as const satisfies Prisma.NewsSelect;

/**
 * Prisma `where` for banner eligibility on one Eastern calendar day.
 *
 * Uses the same UTC-midnight `Date` values as {@link prismaDateFromIsoCalendar}
 * for Postgres `DATE` bounds.
 *
 * @param todayIso - Eastern “today” key `YYYY-MM-DD` (same basis as {@link nyYmd})
 * @returns Clause or `null` when `todayIso` is not a valid calendar date
 */
function prismaWhereNewsBannerForCalendarDay(
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

async function findPublicNewsItems(
  where: Prisma.NewsWhereInput
): Promise<NewsPublicItem[]> {
  const rows = await prisma.news.findMany({
    where,
    orderBy: [...newsListOrderBy],
    select: NEWS_PUBLIC_SELECT,
  });
  return rows.map(toPublicItem);
}

const listNewsForBannerByDay = unstable_cache(
  async (todayIso: string): Promise<NewsPublicItem[]> => {
    const where = prismaWhereNewsBannerForCalendarDay(todayIso);
    if (!where) {
      return [];
    }
    const items = await findPublicNewsItems(where);
    return items;
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
 * @returns Latest {@link startDate} first; same-day ties put newest `createdAt` first
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
 * @returns Latest {@link startDate} first; same-day ties put newest `createdAt` first
 */
export async function listPublishedNews(
  now: Date = new Date()
): Promise<NewsPublicItem[]> {
  const todayIso = nyYmd(now);
  const todayDate = prismaDateFromIsoCalendar(todayIso);
  if (!todayDate) {
    return [];
  }

  const items = await findPublicNewsItems({
    isPublished: true,
    startDate: { lte: todayDate },
  });
  return items;
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
