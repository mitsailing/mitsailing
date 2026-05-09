import 'server-only';
import * as z from 'zod';
import { Prisma } from '@/generated/prisma/client';
import type {
  CatalogCreateResult,
  CatalogListOptions,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import {
  cmsBlockInputSchema,
  cmsMenuItemInputSchema,
  cmsPageInputSchema,
  validateCmsMenuTree,
} from '@/libs/mit-sailing/cmsValidation';

const cmsMenuInputSchema = z.object({
  location: z.enum(['header', 'mobile_utility', 'footer', 'legal', 'social']),
  title: z.string().trim().min(1),
});

type CmsMenuLocationValue =
  | 'header'
  | 'mobile_utility'
  | 'footer'
  | 'legal'
  | 'social';

const CMS_MENU_LOCATION_ORDER: readonly CmsMenuLocationValue[] = [
  'header',
  'mobile_utility',
  'footer',
  'legal',
  'social',
];

function cmsMenuLocationRank(location: CmsMenuLocationValue): number {
  const index = CMS_MENU_LOCATION_ORDER.indexOf(location);
  return index === -1 ? CMS_MENU_LOCATION_ORDER.length : index;
}

function booleanFromForm(formData: FormData, field: string): boolean {
  const flags = formData.getAll(field);
  return flags.includes('true') || flags.includes('on');
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberFromForm(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string') {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function duplicateCode(error: unknown): CatalogMutationErr | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { ok: false, code: 'duplicate_slug' };
    }
    if (error.code === 'P2003') {
      return { ok: false, code: 'foreign_key' };
    }
    if (error.code === 'P2025') {
      return { ok: false, code: 'not_found' };
    }
  }
  return null;
}

function rawCmsPageFromFormData(formData: FormData): Record<string, unknown> {
  return {
    slug: formData.get('slug'),
    path: formData.get('path'),
    title: formData.get('title'),
    metaTitle: formData.get('metaTitle'),
    metaDescription: formData.get('metaDescription'),
    isPublished: booleanFromForm(formData, 'isPublished'),
  };
}

function rawCmsBlockFromFormData(formData: FormData): Record<string, unknown> {
  return {
    pageId: formData.get('pageId'),
    kind: formData.get('kind'),
    title: formData.get('title'),
    subtitle: optionalString(formData.get('subtitle')),
    body: optionalString(formData.get('body')),
    ctaLabel: optionalString(formData.get('ctaLabel')),
    ctaUrl: optionalString(formData.get('ctaUrl')),
    imageSrc: optionalString(formData.get('imageSrc')),
    imageAlt: optionalString(formData.get('imageAlt')),
    displayOrder: numberFromForm(formData.get('displayOrder')),
    isVisible: booleanFromForm(formData, 'isVisible'),
  };
}

function rawCmsMenuFromFormData(formData: FormData): Record<string, unknown> {
  return {
    location: formData.get('location'),
    title: formData.get('title'),
  };
}

function rawCmsMenuItemFromFormData(
  formData: FormData
): Record<string, unknown> {
  return {
    menuId: formData.get('menuId'),
    parentId: optionalString(formData.get('parentId')),
    linkedPageId: optionalString(formData.get('linkedPageId')),
    label: formData.get('label'),
    url: optionalString(formData.get('url')),
    isExternal: booleanFromForm(formData, 'isExternal'),
    isVisible: booleanFromForm(formData, 'isVisible'),
    displayOrder: numberFromForm(formData.get('displayOrder')),
    systemKey: optionalString(formData.get('systemKey')),
  };
}

export const cmsPagesCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.cmsPage.findMany({
      orderBy: [{ path: 'asc' }],
      select: {
        id: true,
        slug: true,
        path: true,
        title: true,
        isPublished: true,
        updatedAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      path: row.path,
      title: row.title,
      isPublished: row.isPublished,
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.cmsPage.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        path: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        isPublished: true,
      },
    });
    return row;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = cmsPageInputSchema.safeParse(
      rawCmsPageFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.cmsPage.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = cmsPageInputSchema.safeParse(
      rawCmsPageFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.cmsPage.update({ where: { id }, data: parsed.data });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.cmsPage.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },
};

export const cmsPageBlocksCatalogHandlers: CatalogServerHandlers = {
  async list(options?: CatalogListOptions): Promise<CatalogRow[]> {
    if (!options?.pageId) {
      return [];
    }

    const rows = await prisma.cmsPageBlock.findMany({
      where: { pageId: options.pageId },
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        kind: true,
        title: true,
        displayOrder: true,
        isVisible: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      displayOrder: row.displayOrder,
      isVisible: row.isVisible,
    }));
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.cmsPageBlock.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      pageId: row.pageId,
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle,
      body: row.body,
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      imageSrc: row.imageSrc,
      imageAlt: row.imageAlt,
      displayOrder: row.displayOrder,
      isVisible: row.isVisible,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = cmsBlockInputSchema.safeParse(
      rawCmsBlockFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.cmsPageBlock.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = cmsBlockInputSchema.safeParse(
      rawCmsBlockFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.cmsPageBlock.update({ where: { id }, data: parsed.data });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.cmsPageBlock.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },
};

export const cmsMenusCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.cmsMenu.findMany({
      orderBy: [{ location: 'asc' }],
      select: { id: true, location: true, title: true },
    });
    return rows;
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.cmsMenu.findUnique({ where: { id } });
    return row
      ? {
          id: row.id,
          location: row.location,
          title: row.title,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }
      : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = cmsMenuInputSchema.safeParse(
      rawCmsMenuFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.cmsMenu.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = cmsMenuInputSchema.safeParse(
      rawCmsMenuFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.cmsMenu.update({ where: { id }, data: parsed.data });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.cmsMenu.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },
};

async function menuTreeIsValid(props: {
  id?: string;
  menuId: string;
  parentId?: string;
}): Promise<boolean> {
  if (props.id && props.parentId === props.id) {
    return false;
  }
  const rows = await prisma.cmsMenuItem.findMany({
    where: { menuId: props.menuId },
    select: { id: true, parentId: true },
  });
  const nodes = rows.map((row) =>
    row.id === props.id ? { id: row.id, parentId: props.parentId ?? null } : row
  );
  return validateCmsMenuTree(nodes).ok;
}

type CmsMenuItemListRow = {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  url: string | null;
  isVisible: boolean;
  displayOrder: number;
  systemKey: string | null;
  menu: { location: CmsMenuLocationValue; title: string };
  parent: { label: string } | null;
  linkedPage: { path: string } | null;
};

function compareCmsMenuItems(
  a: CmsMenuItemListRow,
  b: CmsMenuItemListRow
): number {
  return a.displayOrder - b.displayOrder || a.label.localeCompare(b.label);
}

function appendCmsMenuItemBranch(props: {
  byParent: Map<string, CmsMenuItemListRow[]>;
  orderedRows: CmsMenuItemListRow[];
  parentId: string;
}): void {
  const children = (props.byParent.get(props.parentId) ?? []).toSorted(
    compareCmsMenuItems
  );
  for (const child of children) {
    props.orderedRows.push(child);
    appendCmsMenuItemBranch({
      byParent: props.byParent,
      orderedRows: props.orderedRows,
      parentId: child.id,
    });
  }
}

function orderedCmsMenuItemRows(
  rows: readonly CmsMenuItemListRow[]
): CmsMenuItemListRow[] {
  const rowsByMenu = new Map<string, CmsMenuItemListRow[]>();
  for (const row of rows) {
    rowsByMenu.set(row.menuId, [...(rowsByMenu.get(row.menuId) ?? []), row]);
  }

  const orderedMenus = [...rowsByMenu.entries()].toSorted(
    ([, aRows], [, bRows]) => {
      const [a] = aRows;
      const [b] = bRows;
      if (!a || !b) {
        return 0;
      }
      return (
        cmsMenuLocationRank(a.menu.location) -
          cmsMenuLocationRank(b.menu.location) ||
        a.menu.title.localeCompare(b.menu.title)
      );
    }
  );

  const orderedRows: CmsMenuItemListRow[] = [];
  for (const [, menuRows] of orderedMenus) {
    const byParent = new Map<string, CmsMenuItemListRow[]>();
    const byId = new Map(menuRows.map((row) => [row.id, row] as const));
    for (const row of menuRows) {
      const parentId =
        row.parentId && byId.has(row.parentId) ? row.parentId : '__root__';
      byParent.set(parentId, [...(byParent.get(parentId) ?? []), row]);
    }

    appendCmsMenuItemBranch({
      byParent,
      orderedRows,
      parentId: '__root__',
    });
  }
  return orderedRows;
}

function cmsMenuItemCatalogRow(row: CmsMenuItemListRow): CatalogRow {
  return {
    id: row.id,
    parentLabel: row.parent?.label ?? '',
    label: row.label,
    url: row.linkedPage?.path ?? row.url ?? '',
    isVisible: row.isVisible,
    displayOrder: row.displayOrder,
    systemKey: row.systemKey ?? '',
  };
}

export const cmsMenuItemsCatalogHandlers: CatalogServerHandlers = {
  async list(options?: CatalogListOptions): Promise<CatalogRow[]> {
    if (!options?.menuId) {
      return [];
    }

    const rows = await prisma.cmsMenuItem.findMany({
      where: { menuId: options.menuId },
      orderBy: [{ menu: { location: 'asc' } }, { displayOrder: 'asc' }],
      select: {
        id: true,
        menuId: true,
        parentId: true,
        label: true,
        url: true,
        isVisible: true,
        displayOrder: true,
        systemKey: true,
        menu: { select: { location: true, title: true } },
        parent: { select: { label: true } },
        linkedPage: { select: { path: true } },
      },
    });
    return orderedCmsMenuItemRows(rows).map(cmsMenuItemCatalogRow);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.cmsMenuItem.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      menuId: row.menuId,
      parentId: row.parentId,
      linkedPageId: row.linkedPageId,
      label: row.label,
      url: row.url,
      isExternal: row.isExternal,
      isVisible: row.isVisible,
      displayOrder: row.displayOrder,
      systemKey: row.systemKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = cmsMenuItemInputSchema.safeParse(
      rawCmsMenuItemFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    if (
      !(await menuTreeIsValid({
        menuId: parsed.data.menuId,
        parentId: parsed.data.parentId,
      }))
    ) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      const created = await prisma.cmsMenuItem.create({
        data: parsed.data,
        select: { id: true },
      });
      return { ok: true, id: created.id };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = cmsMenuItemInputSchema.safeParse(
      rawCmsMenuItemFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    if (
      !(await menuTreeIsValid({
        id,
        menuId: parsed.data.menuId,
        parentId: parsed.data.parentId,
      }))
    ) {
      return { ok: false, code: 'validation_failed' };
    }
    try {
      await prisma.cmsMenuItem.update({ where: { id }, data: parsed.data });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.cmsMenuItem.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      return duplicateCode(error) ?? { ok: false, code: 'unknown' };
    }
  },
};

export async function cmsPageSelectOptions() {
  const rows = await prisma.cmsPage.findMany({
    orderBy: [{ path: 'asc' }],
    select: { id: true, path: true, title: true },
  });
  return [
    { value: '', label: 'No linked page' },
    ...rows.map((row) => ({
      value: row.id,
      label: `${row.path} ${row.title}`,
    })),
  ];
}

export async function cmsPageRequiredSelectOptions() {
  const rows = await prisma.cmsPage.findMany({
    orderBy: [{ path: 'asc' }],
    select: { id: true, path: true, title: true },
  });
  return rows.map((row) => ({
    value: row.id,
    label: `${row.path} ${row.title}`,
  }));
}

export async function cmsMenuSelectOptions() {
  const rows = await prisma.cmsMenu.findMany({
    orderBy: [{ location: 'asc' }],
    select: { id: true, title: true, location: true },
  });
  return rows
    .toSorted(
      (a, b) =>
        cmsMenuLocationRank(a.location) - cmsMenuLocationRank(b.location) ||
        a.title.localeCompare(b.title)
    )
    .map((row) => ({
      value: row.id,
      label: `${row.title} (${row.location})`,
    }));
}

export async function cmsMenuParentSelectOptions(options: {
  excludeId?: string;
  menuId: string;
}) {
  if (!options.menuId) {
    return [{ value: '', label: 'No parent' }];
  }

  const rows = await prisma.cmsMenuItem.findMany({
    where: {
      menuId: options.menuId,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    orderBy: [{ menu: { location: 'asc' } }, { displayOrder: 'asc' }],
    select: {
      id: true,
      menuId: true,
      parentId: true,
      label: true,
      url: true,
      isVisible: true,
      displayOrder: true,
      systemKey: true,
      menu: { select: { location: true, title: true } },
      parent: { select: { label: true } },
      linkedPage: { select: { path: true } },
    },
  });
  return [
    { value: '', label: 'No parent' },
    ...orderedCmsMenuItemRows(rows).map((row) => ({
      value: row.id,
      label: row.label,
    })),
  ];
}
