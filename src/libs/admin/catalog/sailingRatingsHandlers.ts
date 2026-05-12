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
import { prismaUniqueTargetIncludes } from '@/libs/admin/prismaUniqueTargetIncludes';
import { prisma } from '@/libs/DB';

function sailingRatingRuleTargetFields(props: {
  targetType: 'boat' | 'class' | 'rating';
  targetId: string;
}) {
  return {
    boatId: props.targetType === 'boat' ? props.targetId : null,
    classId: props.targetType === 'class' ? props.targetId : null,
    ratingId: props.targetType === 'rating' ? props.targetId : null,
  };
}

function sailingRatingRuleTarget(row: {
  boatId: string | null;
  classId: string | null;
  ratingId: string | null;
}) {
  if (row.boatId) {
    return { targetType: 'boat', targetId: row.boatId };
  }
  if (row.classId) {
    return { targetType: 'class', targetId: row.classId };
  }
  return { targetType: 'rating', targetId: row.ratingId ?? '' };
}

async function nextSailingRatingRuleDisplayOrder(props: {
  target: ReturnType<typeof sailingRatingRuleTargetFields>;
  ruleType: 'requires' | 'grants';
  groupKey: string;
}): Promise<number> {
  const agg = await prisma.sailingRatingRule.aggregate({
    _max: { displayOrder: true },
    where: {
      ...props.target,
      ruleType: props.ruleType,
      groupKey: props.groupKey,
    },
  });
  return (agg._max.displayOrder ?? -1) + 1;
}

function mapPrismaErr(error: unknown): CatalogMutationErr | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return prismaUniqueTargetIncludes(error, 'slug')
        ? { ok: false, code: 'duplicate_slug' }
        : { ok: false, code: 'unknown' };
    }
    if (error.code === 'P2003') {
      return { ok: false, code: 'foreign_key' };
    }
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
      orderBy: [
        { boatId: 'asc' },
        { classId: 'asc' },
        { ratingId: 'asc' },
        { ruleType: 'asc' },
        { groupKey: 'asc' },
        { displayOrder: 'asc' },
      ],
      select: {
        id: true,
        boatId: true,
        classId: true,
        ratingId: true,
        ruleType: true,
        groupKey: true,
        displayOrder: true,
        sailingRating: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      ...sailingRatingRuleTarget(row),
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
        boatId: true,
        classId: true,
        ratingId: true,
        ruleType: true,
        sailingRatingId: true,
        groupKey: true,
        displayOrder: true,
      },
    });
    return row ? { ...row, ...sailingRatingRuleTarget(row) } : null;
  },
  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = sailingRatingRuleFormSchema.safeParse(
      rawSailingRatingRuleFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const target = sailingRatingRuleTargetFields(parsed.data);
      const created = await prisma.sailingRatingRule.create({
        data: {
          id: randomUUID(),
          ...target,
          ruleType: parsed.data.ruleType,
          sailingRatingId: parsed.data.sailingRatingId,
          groupKey: parsed.data.groupKey,
          displayOrder:
            parsed.data.displayOrder ??
            (await nextSailingRatingRuleDisplayOrder({
              target,
              ruleType: parsed.data.ruleType,
              groupKey: parsed.data.groupKey,
            })),
        },
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
      const target = sailingRatingRuleTargetFields(parsed.data);
      await prisma.sailingRatingRule.update({
        where: { id },
        data: {
          ...target,
          ruleType: parsed.data.ruleType,
          sailingRatingId: parsed.data.sailingRatingId,
          groupKey: parsed.data.groupKey,
          ...(parsed.data.displayOrder === undefined
            ? {}
            : { displayOrder: parsed.data.displayOrder }),
        },
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
