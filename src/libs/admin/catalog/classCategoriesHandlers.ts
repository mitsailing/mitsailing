import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  classCategoryFormSchema,
  rawClassCategoryFromFormData,
} from '@/libs/admin/catalog/classCategoriesSchemas';
import type {
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';

function rowFromDb(row: {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
  isVisible: boolean;
  createdAt: Date;
}): CatalogRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPrismaErr(e: unknown): CatalogMutationErr | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { ok: false, code: 'duplicate_slug' };
  }
  return null;
}

/**
 * Prisma-backed handlers for the class categories catalog admin resource.
 */
export const classCategoriesCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.classCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { slug: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        displayOrder: true,
        isVisible: true,
        createdAt: true,
      },
    });
    return rows.map(rowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.classCategory.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        displayOrder: true,
        isVisible: true,
        createdAt: true,
      },
    });
    return row ? rowFromDb(row) : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = classCategoryFormSchema.safeParse(
      rawClassCategoryFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      const agg = await prisma.classCategory.aggregate({
        _max: { displayOrder: true },
      });
      const nextOrder = (agg._max.displayOrder ?? -1) + 1;
      const created = await prisma.classCategory.create({
        data: {
          id: randomUUID(),
          slug: data.slug,
          name: data.name,
          isVisible: data.isVisible,
          displayOrder: nextOrder,
          createdAt: new Date(),
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
    const parsed = classCategoryFormSchema.safeParse(
      rawClassCategoryFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      await prisma.classCategory.update({
        where: { id },
        data: {
          slug: data.slug,
          name: data.name,
          isVisible: data.isVisible,
        },
      });
      return { ok: true };
    } catch (error: unknown) {
      const dup = mapPrismaErr(error);
      if (dup) {
        return dup;
      }
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
      await prisma.classCategory.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return { ok: false, code: 'not_found' };
        }
        if (error.code === 'P2003') {
          return { ok: false, code: 'foreign_key' };
        }
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async reorder(
    orderedIds: readonly string[]
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const existing = await prisma.classCategory.findMany({
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
          await tx.classCategory.update({
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
