import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import {
  newsFormSchema,
  parseNewsDates,
  rawNewsFromFormData,
} from '@/libs/admin/catalog/newsSchemas';
import type {
  CatalogCreateResult,
  CatalogListOptions,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { isoCalendarDateFromPrismaDate } from '@/libs/mit-sailing/isoCalendarDate';
import { plainTextFromNewsHtmlish } from '@/libs/mit-sailing/newsPlainText';
import { newsListOrderBy } from '@/libs/mit-sailing/newsQueries';
import { sanitizeNewsBodyHtml } from '@/libs/mit-sailing/sanitizeNewsHtml';

/**
 * Prisma-backed handlers for news (home banner + `/news`).
 */
export const newsCatalogHandlers: CatalogServerHandlers = {
  async list(_options?: CatalogListOptions): Promise<CatalogRow[]> {
    const rows = await prisma.news.findMany({
      orderBy: [...newsListOrderBy],
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
      bodyPlainText: plainTextFromNewsHtmlish(row.body),
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
    const row = await prisma.news.findUnique({
      where: { id },
      select: {
        id: true,
        body: true,
        isPublished: true,
        startDate: true,
        lastDate: true,
        createdAt: true,
        updatedAt: true,
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
    };
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = newsFormSchema.safeParse(rawNewsFromFormData(formData));
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const dates = parseNewsDates(data);
    if (!dates) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.news.create({
        data: {
          body: sanitizeNewsBodyHtml(data.body),
          isPublished: data.isPublished,
          startDate: dates.startDate,
          lastDate: dates.lastDate,
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
    const parsed = newsFormSchema.safeParse(rawNewsFromFormData(formData));
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const dates = parseNewsDates(data);
    if (!dates) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.news.update({
        where: { id },
        data: {
          body: sanitizeNewsBodyHtml(data.body),
          isPublished: data.isPublished,
          startDate: dates.startDate,
          lastDate: dates.lastDate,
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
      await prisma.news.delete({ where: { id } });
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
