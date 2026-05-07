import 'server-only';
import { prisma } from '@/libs/DB';
import {
  formatEasternCalendarDateKey,
  formatEasternShortDateFromIsoCalendar,
} from '@/libs/mit-sailing/easternTimeFormat';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';
import { siteAlertPlainTextPreview } from '@/libs/mit-sailing/siteAlertPlainTextPreview';
import type {
  SiteAlertBannerRow,
  SiteAlertPublicItem,
} from '@/libs/mit-sailing/siteAlertTypes';

function toPublicItem(row: {
  id: string;
  body: string;
  startDate: Date;
  lastDate: Date;
}): SiteAlertPublicItem {
  return {
    id: row.id,
    startDateIso: isoCalendarDateFromPrismaDate(row.startDate),
    lastDateIso: isoCalendarDateFromPrismaDate(row.lastDate),
    body: row.body,
  };
}

/**
 * Lists alerts eligible for the home banner strip at `now`.
 *
 * @param now - Evaluation instant (typically server request time)
 * @returns Ordering by newest {@link startDate} first
 */
export async function listSiteAlertsForBannerAt(
  now: Date
): Promise<SiteAlertPublicItem[]> {
  const todayIso = formatEasternCalendarDateKey(now);
  const todayDate = prismaDateFromIsoCalendar(todayIso);
  if (!todayDate) {
    return [];
  }

  const rows = await prisma.siteAlert.findMany({
    where: {
      isPublished: true,
      startDate: { lte: todayDate },
      lastDate: { gte: todayDate },
    },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      body: true,
      startDate: true,
      lastDate: true,
    },
  });
  return rows.map(toPublicItem);
}

/**
 * Lists every published alert for `/alerts`, including rows past `lastDate`.
 *
 * @returns Same ordering as the banner query subset would use for active rows
 */
export async function listPublishedSiteAlerts(): Promise<
  SiteAlertPublicItem[]
> {
  const rows = await prisma.siteAlert.findMany({
    where: { isPublished: true },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      body: true,
      startDate: true,
      lastDate: true,
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
      preview: siteAlertPlainTextPreview(item.body),
      dateLabel: formatEasternShortDateFromIsoCalendar(dateIso),
      dateIso,
    };
  });
}
