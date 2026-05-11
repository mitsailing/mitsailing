import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  rawSailingRatingFromFormData,
  rawSailingRatingRuleFromFormData,
  sailingRatingFormSchema,
  sailingRatingRuleFormSchema,
} from '@/libs/admin/catalog/sailingRatingsSchemas';
import type {
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogReorderScope,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';

function mapPrismaErr(error: unknown): CatalogMutationErr | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return { ok: false, code: 'duplicate_slug' };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  ) {
    return { ok: false, code: 'foreign_key' };
  }
  return null;
}

export async function sailingRatingSelectOptions(): Promise<
  readonly { value: string; label: string }[]
> {
  const rows = await prisma.sailingRating.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true },
  });
  return rows.map((row) => ({
    value: row.id,
    label: `${row.name} (${row.slug})`,
  }));
}

export const sailingRatingsCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.sailingRating.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        level: true,
        windCondition: true,
        displayOrder: true,
        isVisible: true,
        isDeprecated: true,
      },
    });
    return rows;
  },
  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.sailingRating.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        description: true,
        category: true,
        level: true,
        windCondition: true,
        guideUrl: true,
        isVisible: true,
        isDeprecated: true,
      },
    });
    return row;
  },
  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = sailingRatingFormSchema.safeParse(
      rawSailingRatingFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sailing_ratings_display_order'))`;
        const agg = await tx.sailingRating.aggregate({
          _max: { displayOrder: true },
        });
        return tx.sailingRating.create({
          data: {
            id: randomUUID(),
            ...parsed.data,
            displayOrder: (agg._max.displayOrder ?? -1) + 1,
          },
          select: { id: true },
        });
      });
      return { ok: true, id: created.id };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = sailingRatingFormSchema.safeParse(
      rawSailingRatingFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.sailingRating.update({ where: { id }, data: parsed.data });
      return { ok: true };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.sailingRating.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
  async reorder(
    orderedIds: readonly string[],
    _scope?: CatalogReorderScope
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < orderedIds.length; index += 1) {
          await tx.sailingRating.update({
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

export const sailingRatingRulesCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.sailingRatingRule.findMany({
      orderBy: [{ targetType: 'asc' }, { targetId: 'asc' }],
      select: {
        id: true,
        targetType: true,
        targetId: true,
        ruleType: true,
        groupKey: true,
        displayOrder: true,
        sailingRating: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      ruleType: row.ruleType,
      groupKey: row.groupKey,
      displayOrder: row.displayOrder,
      sailingRatingName: row.sailingRating.name,
    }));
  },
  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.sailingRatingRule.findUnique({
      where: { id },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        ruleType: true,
        sailingRatingId: true,
        groupKey: true,
      },
    });
    return row;
  },
  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = sailingRatingRuleFormSchema.safeParse(
      rawSailingRatingRuleFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.sailingRatingRule.create({
        data: { id: randomUUID(), ...parsed.data },
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = sailingRatingRuleFormSchema.safeParse(
      rawSailingRatingRuleFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.sailingRatingRule.update({
        where: { id },
        data: parsed.data,
      });
      return { ok: true };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.sailingRatingRule.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      return mapPrismaErr(error) ?? { ok: false, code: 'unknown' };
    }
  },
};
