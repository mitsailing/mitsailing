import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import {
  parseSiteAlertDates,
  rawSiteAlertFromFormData,
  siteAlertFormSchema,
} from '@/libs/admin/catalog/siteAlertSchemas';
import type {
  CatalogCreateResult,
  CatalogListOptions,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { isoCalendarDateFromPrismaDate } from '@/libs/mit-sailing/isoCalendarDate';
import { sanitizeSiteAlertBodyHtml } from '@/libs/mit-sailing/sanitizeSiteAlertHtml';
import { siteAlertPlainTextPreview } from '@/libs/mit-sailing/siteAlertPlainTextPreview';

/**
 * Prisma-backed handlers for site alerts (home banner + `/alerts`).
 */
export const siteAlertsCatalogHandlers: CatalogServerHandlers = {
  async list(_options?: CatalogListOptions): Promise<CatalogRow[]> {
    const rows = await prisma.siteAlert.findMany({
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        body: true,
        isPublished: true,
        startDate: true,
        lastDate: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      bodyPreview: siteAlertPlainTextPreview(row.body),
      isPublished: row.isPublished,
      startDateLabel: formatEasternShortDateFromIsoCalendar(
        isoCalendarDateFromPrismaDate(row.startDate)
      ),
      lastDateLabel: formatEasternShortDateFromIsoCalendar(
        isoCalendarDateFromPrismaDate(row.lastDate)
      ),
    }));
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.siteAlert.findUnique({
      where: { id },
      select: {
        id: true,
        body: true,
        isPublished: true,
        startDate: true,
        lastDate: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      body: row.body,
      isPublished: row.isPublished,
      startDate: isoCalendarDateFromPrismaDate(row.startDate),
      lastDate: isoCalendarDateFromPrismaDate(row.lastDate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdByName: row.createdBy.name,
      createdByEmail: row.createdBy.email,
      updatedByName: row.updatedBy.name,
      updatedByEmail: row.updatedBy.email,
    };
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false, code: 'validation_failed' };
    }
    const parsed = siteAlertFormSchema.safeParse(
      rawSiteAlertFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const dates = parseSiteAlertDates(data);
    if (!dates) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.siteAlert.create({
        data: {
          body: sanitizeSiteAlertBodyHtml(data.body),
          isPublished: data.isPublished,
          startDate: dates.startDate,
          lastDate: dates.lastDate,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch {
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false, code: 'validation_failed' };
    }
    const parsed = siteAlertFormSchema.safeParse(
      rawSiteAlertFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const dates = parseSiteAlertDates(data);
    if (!dates) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.siteAlert.update({
        where: { id },
        data: {
          body: sanitizeSiteAlertBodyHtml(data.body),
          isPublished: data.isPublished,
          startDate: dates.startDate,
          lastDate: dates.lastDate,
          updatedByUserId: userId,
        },
      });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { ok: false, code: 'not_found' };
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.siteAlert.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { ok: false, code: 'not_found' };
      }
      return { ok: false, code: 'unknown' };
    }
  },
};
