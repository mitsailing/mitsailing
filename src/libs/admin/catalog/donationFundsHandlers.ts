import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import {
  donationFundFormSchema,
  rawDonationFundFromFormData,
} from '@/libs/admin/catalog/donationFundsSchemas';
import type {
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogReorderScope,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';

function rowFromDb(row: {
  id: string;
  fundId: string;
  name: string;
  description: string;
  url: string;
  displayOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CatalogRow {
  return {
    id: row.id,
    fundId: row.fundId,
    name: row.name,
    description: row.description,
    url: row.url,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapPrismaErr(e: unknown): CatalogMutationErr | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { ok: false, code: 'duplicate_designation' };
  }
  return null;
}

/**
 * Prisma-backed handlers for the donation funds catalog admin resource.
 */
export const donationFundsCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.donationFund.findMany({
      orderBy: [{ displayOrder: 'asc' }, { fundId: 'asc' }],
      select: {
        id: true,
        fundId: true,
        name: true,
        description: true,
        url: true,
        displayOrder: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(rowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.donationFund.findUnique({
      where: { id },
      select: {
        id: true,
        fundId: true,
        name: true,
        description: true,
        url: true,
        displayOrder: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? rowFromDb(row) : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = donationFundFormSchema.safeParse(
      rawDonationFundFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      const agg = await prisma.donationFund.aggregate({
        _max: { displayOrder: true },
      });
      const nextOrder = (agg._max.displayOrder ?? -1) + 1;
      const created = await prisma.donationFund.create({
        data: {
          fundId: data.fundId,
          name: data.name,
          description: data.description,
          url: data.url,
          isVisible: data.isVisible,
          displayOrder: nextOrder,
        },
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      const dup = mapPrismaErr(error);
      if (dup) {
        return dup;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = donationFundFormSchema.safeParse(
      rawDonationFundFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      await prisma.donationFund.update({
        where: { id },
        data: {
          fundId: data.fundId,
          name: data.name,
          description: data.description,
          url: data.url,
          isVisible: data.isVisible,
        },
      });
      return { ok: true };
    } catch (error: unknown) {
      const dup = mapPrismaErr(error);
      if (dup) {
        return dup;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.donationFund.delete({ where: { id } });
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

  async reorder(
    orderedIds: readonly string[],
    _scope?: CatalogReorderScope
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const existing = await prisma.donationFund.findMany({
      select: { id: true },
    });
    const set = new Set(existing.map((r) => r.id));
    if (
      orderedIds.length !== set.size ||
      orderedIds.some((rowId) => !set.has(rowId))
    ) {
      return { ok: false, code: 'invalid_order' };
    }
    try {
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < orderedIds.length; index += 1) {
          await tx.donationFund.update({
            where: { id: orderedIds[index] },
            data: { displayOrder: index },
          });
        }
      });
      return { ok: true };
    } catch {
      return { ok: false, code: 'unknown' };
    }
  },
};
