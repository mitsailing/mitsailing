import 'server-only';
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@/generated/prisma/client';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';
import { plainTextFromSiteAlertHtmlish } from '@/libs/mit-sailing/siteAlertPlainText';
import type {
  SiteAlertBannerRow,
  SiteAlertPublicItem,
} from '@/libs/mit-sailing/siteAlertTypes';

export const SITE_ALERTS_CACHE_TAG = 'site-alerts';

const SITE_ALERTS_BANNER_REVALIDATE_SECONDS = 60 * 60;

/**
 * Prisma `where` for banner eligibility on one Eastern calendar day.
 *
 * Uses the same UTC-midnight `Date` values as {@link prismaDateFromIsoCalendar}
 * for Postgres `DATE` bounds.
 *
 * @param todayIso - Eastern “today” key `YYYY-MM-DD` (same basis as {@link nyYmd})
 * @returns Clause or `null` when `todayIso` is not a valid calendar date
 */
export function prismaWhereSiteAlertBannerForCalendarDay(
  todayIso: string
): Prisma.SiteAlertWhereInput | null {
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
}): SiteAlertPublicItem {
  return {
    id: row.id,
    startDateIso: isoCalendarDateFromPrismaDate(row.startDate),
    body: row.body,
  };
}

const listSiteAlertsForBannerByDay = unstable_cache(
  async (todayIso: string): Promise<SiteAlertPublicItem[]> => {
    const where = prismaWhereSiteAlertBannerForCalendarDay(todayIso);
    if (!where) {
      return [];
    }

    const rows = await prisma.siteAlert.findMany({
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
  ['site-alerts-banner-by-day'],
  {
    revalidate: SITE_ALERTS_BANNER_REVALIDATE_SECONDS,
    tags: [SITE_ALERTS_CACHE_TAG],
  }
);

/**
 * Lists alerts eligible for the home banner strip at `now`.
 *
 * @param now - Evaluation instant (typically server request time)
 * @returns Ordering by newest {@link startDate} first
 */
export async function listSiteAlertsForBannerAt(
  now: Date
): Promise<SiteAlertPublicItem[]> {
  const todayIso = nyYmd(now);
  const rows = await listSiteAlertsForBannerByDay(todayIso);
  return rows;
}

/**
 * Lists published alerts for `/alerts` whose start date is today or earlier,
 * including rows past `lastDate`.
 *
 * @param now - Evaluation instant (typically server request time)
 * @returns Same ordering as the banner query subset would use for active rows
 */
export async function listPublishedSiteAlerts(
  now: Date = new Date()
): Promise<SiteAlertPublicItem[]> {
  const todayIso = nyYmd(now);
  const todayDate = prismaDateFromIsoCalendar(todayIso);
  if (!todayDate) {
    return [];
  }

  const rows = await prisma.siteAlert.findMany({
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
 * Maps public items to banner-ready rows with date labels.
 *
 * @param items - Banner-eligible alerts from {@link listSiteAlertsForBannerAt}
 * @returns Data for {@link SiteAlertsBanner}
 */
export function mapSiteAlertsToBannerRows(
  items: SiteAlertPublicItem[]
): SiteAlertBannerRow[] {
  return items.map((item) => {
    const dateIso = item.startDateIso;
    return {
      id: item.id,
      bodyPlainText: plainTextFromSiteAlertHtmlish(item.body),
      dateLabel: formatEasternShortDateFromIsoCalendar(dateIso),
      dateIso,
    };
  });
}

/**
 * Builds a content version for alert collapse persistence.
 *
 * @param rows - Banner rows in display order
 * @returns Stable hash for the current active alert set
 */
export function buildSiteAlertsFingerprint(rows: SiteAlertBannerRow[]): string {
  const payload = rows.map((row) => ({
    bodyPlainText: row.bodyPlainText,
    dateIso: row.dateIso,
    id: row.id,
  }));
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('base64url');
}
