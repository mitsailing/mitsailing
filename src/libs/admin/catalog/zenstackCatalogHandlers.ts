import 'server-only';
import { randomUUID } from 'node:crypto';
import { ORMError, ORMErrorReason } from '@zenstackhq/orm';
import type {
  CatalogCreateResult,
  CatalogMutationContext,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogReorderScope,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
import {
  eventCategoryCreateSchema,
  eventCategoryUpdateSchema,
} from '@/libs/zenstack/zod';

function stringFromFormValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

function booleanFromFormValues(values: FormDataEntryValue[]): boolean {
  return values.some((value) => value === 'true' || value === 'on');
}

function eventCategoryInputFromFormData(formData: FormData) {
  return {
    isVisible: booleanFromFormValues(formData.getAll('isVisible')),
    name: stringFromFormValue(formData.get('name')),
  };
}

function rowFromDb(row: {
  createdAt: Date;
  displayOrder: number;
  id: string;
  isVisible: boolean;
  name: string;
}): CatalogRow {
  return {
    createdAt: row.createdAt.toISOString(),
    displayOrder: row.displayOrder,
    id: row.id,
    isVisible: row.isVisible,
    name: row.name,
  };
}

function dbFromContext(context?: CatalogMutationContext) {
  if (!context?.authContext) {
    return null;
  }
  return zenstackForAuthContext(context.authContext);
}

function eventCategoryDeleteErrorCode(error: unknown): string {
  if (!(error instanceof ORMError)) {
    return 'unknown';
  }
  if (error.reason === ORMErrorReason.NOT_FOUND) {
    return 'not_found';
  }
  if (
    error.reason === ORMErrorReason.DB_QUERY_ERROR &&
    error.dbErrorCode === '23503'
  ) {
    return 'foreign_key';
  }
  return 'unknown';
}

function eventCategoryHandlers(): CatalogServerHandlers {
  return {
    async list(): Promise<CatalogRow[]> {
      const rows = await zenstackForAuthContext({
        appRole: 'admin',
        id: 'system',
      }).eventCategory.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          createdAt: true,
          displayOrder: true,
          id: true,
          isVisible: true,
          name: true,
        },
      });
      return rows.map(rowFromDb);
    },

    async getById(id: string): Promise<CatalogRow | null> {
      const row = await zenstackForAuthContext({
        appRole: 'admin',
        id: 'system',
      }).eventCategory.findUnique({
        where: { id },
        select: {
          createdAt: true,
          displayOrder: true,
          id: true,
          isVisible: true,
          name: true,
        },
      });
      return row ? rowFromDb(row) : null;
    },

    async createFromForm(
      formData: FormData,
      context?: CatalogMutationContext
    ): Promise<CatalogCreateResult> {
      const db = dbFromContext(context);
      if (!db) {
        return { ok: false, code: 'forbidden' };
      }
      const parsed = eventCategoryCreateSchema.safeParse(
        eventCategoryInputFromFormData(formData)
      );
      if (!parsed.success) {
        return { ok: false, code: 'validation_failed' };
      }
      try {
        const aggregate = await db.eventCategory.aggregate({
          _max: { displayOrder: true },
        });
        const created = await db.eventCategory.create({
          data: {
            ...parsed.data,
            createdAt: new Date(),
            displayOrder: (aggregate._max.displayOrder ?? -1) + 1,
            id: randomUUID(),
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
      formData: FormData,
      context?: CatalogMutationContext
    ): Promise<CatalogMutationOk | CatalogMutationErr> {
      const db = dbFromContext(context);
      if (!db) {
        return { ok: false, code: 'forbidden' };
      }
      const parsed = eventCategoryUpdateSchema.safeParse(
        eventCategoryInputFromFormData(formData)
      );
      if (!parsed.success) {
        return { ok: false, code: 'validation_failed' };
      }
      try {
        await db.eventCategory.update({
          where: { id },
          data: parsed.data,
        });
        return { ok: true };
      } catch {
        return { ok: false, code: 'unknown' };
      }
    },

    async delete(
      id: string,
      context?: CatalogMutationContext
    ): Promise<CatalogMutationOk | CatalogMutationErr> {
      const db = dbFromContext(context);
      if (!db) {
        return { ok: false, code: 'forbidden' };
      }
      try {
        await db.eventCategory.delete({ where: { id } });
        return { ok: true };
      } catch (error: unknown) {
        return { ok: false, code: eventCategoryDeleteErrorCode(error) };
      }
    },

    async reorder(
      orderedIds: readonly string[],
      _scope?: CatalogReorderScope
    ): Promise<CatalogMutationOk | CatalogMutationErr> {
      const db = zenstackForAuthContext({ appRole: 'admin', id: 'system' });
      const existing = await db.eventCategory.findMany({
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
        await db.$transaction(async (tx) => {
          for (let index = 0; index < orderedIds.length; index += 1) {
            await tx.eventCategory.update({
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
}

export function createZenStackCatalogHandlers(
  _resourceId: 'event_categories'
): CatalogServerHandlers {
  return eventCategoryHandlers();
}
