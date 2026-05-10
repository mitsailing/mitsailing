import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  rawSailingClassFromFormData,
  sailingClassFormSchema,
} from '@/libs/admin/catalog/sailingClassesSchemas';
import type {
  CatalogCreateResult,
  CatalogListOptions,
  CatalogMutationContext,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogReorderScope,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import {
  loadCatalogRevisionSnapshot,
  recordCatalogRevision,
  recordCatalogRevisionFromSnapshot,
  recordCatalogRevisionIfChanged,
} from '@/libs/mit-sailing/catalogHistory';

function mapPrismaErr(e: unknown): CatalogMutationErr | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { ok: false, code: 'duplicate_slug' };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    return { ok: false, code: 'foreign_key' };
  }
  return null;
}

/**
 * Options for the class category `<select>` on sailing class forms.
 *
 * @returns Rows sorted for stable dropdown display
 */
export async function sailingClassCategorySelectOptions(): Promise<
  readonly { value: string; label: string }[]
> {
  const rows = await prisma.classCategory.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.name} (${r.slug})`,
  }));
}

/**
 * Prisma-backed handlers for the sailing classes catalog admin resource.
 */
export const sailingClassesCatalogHandlers: CatalogServerHandlers = {
  async list(_options?: CatalogListOptions): Promise<CatalogRow[]> {
    const rows = await prisma.sailingClass.findMany({
      orderBy: [
        { classCategory: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        level: true,
        displayOrder: true,
        isVisible: true,
        classCategoryId: true,
        classCategory: {
          select: { name: true, displayOrder: true },
        },
        _count: {
          select: {
            relatedEvents: true,
            prerequisiteEdges: true,
            unlockedBoatLinks: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      level: row.level,
      displayOrder: row.displayOrder,
      classCategoryId: row.classCategoryId,
      classCategoryName: row.classCategory.name,
      classCategoryDisplayOrder: row.classCategory.displayOrder,
      relatedEventsCount: row._count.relatedEvents,
      prerequisitesCount: row._count.prerequisiteEdges,
      unlockedBoatsCount: row._count.unlockedBoatLinks,
      isVisible: row.isVisible,
    }));
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.sailingClass.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        classCategoryId: true,
        level: true,
        description: true,
        imagePaths: true,
        isVisible: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      classCategoryId: row.classCategoryId,
      level: row.level,
      description: row.description,
      imagePaths: row.imagePaths,
      isVisible: row.isVisible,
    };
  },

  async createFromForm(
    formData: FormData,
    context?: CatalogMutationContext
  ): Promise<CatalogCreateResult> {
    const parsed = sailingClassFormSchema.safeParse(
      rawSailingClassFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const newId = randomUUID();
    try {
      const agg = await prisma.sailingClass.aggregate({
        where: { classCategoryId: data.classCategoryId },
        _max: { displayOrder: true },
      });
      const nextDisplayOrder = (agg._max.displayOrder ?? -1) + 1;
      await prisma.sailingClass.create({
        data: {
          id: newId,
          name: data.name,
          slug: data.slug,
          classCategoryId: data.classCategoryId,
          level: data.level,
          description: data.description,
          imagePaths: data.imagePaths,
          displayOrder: nextDisplayOrder,
          isVisible: data.isVisible,
        },
      });
      await recordCatalogRevision({
        action: 'create',
        context,
        itemId: newId,
        resourceId: 'sailing_classes',
      });
      return { ok: true, id: newId };
    } catch (error) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData,
    context?: CatalogMutationContext
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = sailingClassFormSchema.safeParse(
      rawSailingClassFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      const previousSnapshot = await loadCatalogRevisionSnapshot({
        itemId: id,
        resourceId: 'sailing_classes',
      });
      await prisma.sailingClass.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          classCategoryId: data.classCategoryId,
          level: data.level,
          description: data.description,
          imagePaths: data.imagePaths,
          isVisible: data.isVisible,
        },
      });
      await recordCatalogRevisionIfChanged({
        action: 'update',
        context,
        itemId: id,
        previousSnapshot,
        resourceId: 'sailing_classes',
      });
      return { ok: true };
    } catch (error) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async delete(
    id: string,
    context?: CatalogMutationContext
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const boats = await prisma.fleetBoat.count({
      where: { requiredClassId: id },
    });
    if (boats > 0) {
      return { ok: false, code: 'foreign_key' };
    }
    try {
      const snapshot = await loadCatalogRevisionSnapshot({
        itemId: id,
        resourceId: 'sailing_classes',
      });
      await prisma.sailingClass.delete({ where: { id } });
      if (snapshot) {
        await recordCatalogRevisionFromSnapshot({
          action: 'delete',
          context,
          itemId: id,
          resourceId: 'sailing_classes',
          snapshot,
        });
      }
      return { ok: true };
    } catch (error) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async reorder(
    orderedIds: readonly string[],
    scope?: CatalogReorderScope
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const categoryId = scope?.classCategoryId;
    if (!categoryId) {
      return { ok: false, code: 'invalid_payload' };
    }
    const inCategory = await prisma.sailingClass.findMany({
      where: { classCategoryId: categoryId },
      select: { id: true },
    });
    const dbIds = new Set(inCategory.map((r) => r.id));
    if (
      orderedIds.length !== dbIds.size ||
      orderedIds.some((rowId) => !dbIds.has(rowId))
    ) {
      return { ok: false, code: 'invalid_order' };
    }
    try {
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < orderedIds.length; index += 1) {
          await tx.sailingClass.update({
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
