import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import {
  legacyRedirectFormSchema,
  rawLegacyRedirectFromFormData,
} from '@/libs/admin/catalog/legacyRedirectSchemas';
import type {
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';

function publicSlugTargetPath(row: { scope: string; slug: string }): string {
  if (row.scope === 'classes') {
    return `/classes/${row.slug}`;
  }
  if (row.scope === 'events') {
    return `/events/${row.slug}`;
  }
  if (row.scope === 'fleet') {
    return `/fleet/${row.slug}`;
  }
  return row.slug.startsWith('/') ? row.slug : `/${row.slug}`;
}

function publicSlugRowFromDb(row: {
  createdAt: Date;
  id: string;
  scope: string;
  slug: string;
  sluggableId: string;
  sluggableType: string;
  source: string;
}): CatalogRow {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    scope: row.scope,
    slug: row.slug,
    sluggableId: row.sluggableId,
    sluggableType: row.sluggableType,
    source: row.source,
    targetPath: publicSlugTargetPath(row),
  };
}

function legacyRedirectRowFromDb(row: {
  createdAt: Date;
  id: string;
  source: string;
  sourcePath: string;
  targetPath: string;
}): CatalogRow {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    source: row.source,
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
  };
}

function mapPrismaMutationError(error: unknown): CatalogMutationErr {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { ok: false, code: 'duplicate_source_path' };
    }
    if (error.code === 'P2025') {
      return { ok: false, code: 'not_found' };
    }
  }
  return { ok: false, code: 'unknown' };
}

export const publicSlugsCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.publicSlug.findMany({
      orderBy: [{ scope: 'asc' }, { slug: 'asc' }],
      select: {
        createdAt: true,
        id: true,
        scope: true,
        slug: true,
        sluggableId: true,
        sluggableType: true,
        source: true,
      },
    });
    return rows.map(publicSlugRowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.publicSlug.findUnique({
      where: { id },
      select: {
        createdAt: true,
        id: true,
        scope: true,
        slug: true,
        sluggableId: true,
        sluggableType: true,
        source: true,
      },
    });
    return row ? publicSlugRowFromDb(row) : null;
  },

  async createFromForm(): Promise<CatalogCreateResult> {
    await Promise.resolve();
    return { ok: false, code: 'unsupported' };
  },

  async updateFromForm(): Promise<CatalogMutationOk | CatalogMutationErr> {
    await Promise.resolve();
    return { ok: false, code: 'unsupported' };
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.publicSlug.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return mapPrismaMutationError(error);
    }
  },
};

export const legacyRedirectsCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.legacyRedirect.findMany({
      orderBy: [{ sourcePath: 'asc' }],
      select: {
        createdAt: true,
        id: true,
        source: true,
        sourcePath: true,
        targetPath: true,
      },
    });
    return rows.map(legacyRedirectRowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.legacyRedirect.findUnique({
      where: { id },
      select: {
        createdAt: true,
        id: true,
        source: true,
        sourcePath: true,
        targetPath: true,
      },
    });
    return row ? legacyRedirectRowFromDb(row) : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = legacyRedirectFormSchema.safeParse(
      rawLegacyRedirectFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.legacyRedirect.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      return mapPrismaMutationError(error);
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = legacyRedirectFormSchema.safeParse(
      rawLegacyRedirectFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.legacyRedirect.update({
        where: { id },
        data: parsed.data,
      });
      return { ok: true };
    } catch (error: unknown) {
      return mapPrismaMutationError(error);
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.legacyRedirect.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return mapPrismaMutationError(error);
    }
  },
};
