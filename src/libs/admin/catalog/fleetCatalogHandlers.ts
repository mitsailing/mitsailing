import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  fleetBoatFormSchema,
  rawFleetBoatFromFormData,
} from '@/libs/admin/catalog/fleetSchemas';
import type {
  CatalogCreateResult,
  CatalogListOptions,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import { routing } from '@/libs/I18nRouting';
import { getI18nPath } from '@/utils/Helpers';

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
 * Options for the required-class `<select>` on fleet create/edit forms.
 *
 * @returns Sailing classes sorted by name
 */
export async function fleetRequiredClassSelectOptions(): Promise<
  readonly { value: string; label: string }[]
> {
  const rows = await prisma.sailingClass.findMany({
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, slug: true },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.name} (${r.slug})`,
  }));
}

/**
 * Prisma-backed handlers for the fleet boats catalog admin resource.
 */
export const fleetCatalogHandlers: CatalogServerHandlers = {
  async list(options?: CatalogListOptions): Promise<CatalogRow[]> {
    const locale = options?.locale ?? routing.defaultLocale;
    const rows = await prisma.fleetBoat.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        displayOrder: true,
        requiredClass: {
          select: { name: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      capacity: row.capacity,
      displayOrder: row.displayOrder,
      requiredClassName: row.requiredClass.name,
      publicBoatUrl: getI18nPath(`/fleet/${row.slug}/`, locale),
    }));
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.fleetBoat.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        displayOrder: true,
        requiredClassId: true,
        description: true,
        imagePaths: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      capacity: row.capacity,
      displayOrder: row.displayOrder,
      requiredClassId: row.requiredClassId,
      description: row.description,
      imagePaths: row.imagePaths.join('\n'),
    };
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = fleetBoatFormSchema.safeParse(
      rawFleetBoatFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      const agg = await prisma.fleetBoat.aggregate({
        _max: { displayOrder: true },
      });
      const nextOrder = (agg._max.displayOrder ?? -1) + 1;
      const created = await prisma.fleetBoat.create({
        data: {
          id: randomUUID(),
          name: data.name,
          slug: data.slug,
          type: data.type,
          capacity: data.capacity,
          requiredClassId: data.requiredClassId,
          description: data.description,
          imagePaths: data.imagePaths,
          displayOrder: nextOrder,
        },
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = fleetBoatFormSchema.safeParse(
      rawFleetBoatFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    try {
      await prisma.fleetBoat.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          type: data.type,
          capacity: data.capacity,
          requiredClassId: data.requiredClassId,
          description: data.description,
          imagePaths: data.imagePaths,
        },
      });
      return { ok: true };
    } catch (error: unknown) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
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
      await prisma.fleetBoat.delete({ where: { id } });
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
    const existing = await prisma.fleetBoat.findMany({
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
          await tx.fleetBoat.update({
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
