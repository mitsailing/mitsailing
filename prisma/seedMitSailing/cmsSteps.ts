import {
  CMS_MENU_SEED_ROWS,
  CMS_PAGE_SEED_ROWS,
  orderedCmsSeedMenuItems,
} from '../../src/data/mit-sailing/cmsSeed';
import type {
  CmsSeedMenu,
  CmsSeedMenuItem,
  CmsSeedPage,
} from '../../src/data/mit-sailing/cmsSeed';
import type { PrismaClient } from '../../src/generated/prisma/client';

function seedTextOrNull(value: string | undefined): string | null {
  return value ?? null;
}

function hasSeedText(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function seedFlagOrDefault(
  value: boolean | undefined,
  fallback: boolean
): boolean {
  return value ?? fallback;
}

function unhandledCmsMenuItemKind(_item: never): never {
  throw new TypeError('Unhandled CMS menu item kind.');
}

function cmsSeedBlockDisplayFlags(block: CmsSeedPage['blocks'][number]) {
  return {
    showCta: seedFlagOrDefault(
      block.showCta,
      hasSeedText(block.ctaLabel) && hasSeedText(block.ctaUrl)
    ),
    showImage: seedFlagOrDefault(
      block.showImage,
      hasSeedText(block.imageSrc) && hasSeedText(block.imageAlt)
    ),
  };
}

function cmsSeedBlockData(props: {
  readonly block: CmsSeedPage['blocks'][number];
  readonly pageId: string;
}) {
  const { showCta, showImage } = cmsSeedBlockDisplayFlags(props.block);
  return {
    pageId: props.pageId,
    kind: props.block.kind,
    title: props.block.title,
    subtitle: seedTextOrNull(props.block.subtitle),
    body: seedTextOrNull(props.block.body),
    ctaLabel: seedTextOrNull(props.block.ctaLabel),
    ctaUrl: seedTextOrNull(props.block.ctaUrl),
    showCta,
    imageSrc: seedTextOrNull(props.block.imageSrc),
    imageAlt: seedTextOrNull(props.block.imageAlt),
    showImage,
    displayOrder: props.block.displayOrder,
    isVisible: props.block.isVisible,
  };
}

async function seedCmsPageBlock(props: {
  readonly block: CmsSeedPage['blocks'][number];
  readonly p: PrismaClient;
  readonly pageId: string;
}): Promise<void> {
  const data = cmsSeedBlockData({
    block: props.block,
    pageId: props.pageId,
  });
  await props.p.cmsPageBlock.upsert({
    where: { id: props.block.id },
    create: {
      id: props.block.id,
      ...data,
    },
    update: data,
  });
}

async function seedCmsPageBlocks(props: {
  readonly p: PrismaClient;
  readonly page: CmsSeedPage;
}): Promise<void> {
  for (const block of props.page.blocks) {
    await seedCmsPageBlock({
      block,
      p: props.p,
      pageId: props.page.id,
    });
  }
}

async function seedCmsPages(p: PrismaClient): Promise<void> {
  for (const page of CMS_PAGE_SEED_ROWS) {
    const isPublished = page.isPublished ?? true;
    await p.cmsPage.upsert({
      where: { id: page.id },
      create: {
        id: page.id,
        slug: page.slug,
        path: page.path,
        title: page.title,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        isPublished,
      },
      update: {
        slug: page.slug,
        path: page.path,
        title: page.title,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        isPublished,
      },
    });
    await seedCmsPageBlocks({ p, page });
  }
}

function cmsMenuItemLinkData(item: CmsSeedMenuItem) {
  switch (item.kind) {
    case 'group': {
      return {
        isExternal: false,
        linkedPageId: null,
        url: null,
      };
    }
    case 'page_link': {
      return {
        isExternal: false,
        linkedPageId: item.linkedPageId,
        url: null,
      };
    }
    case 'url_link': {
      return {
        isExternal: item.isExternal,
        linkedPageId: null,
        url: seedTextOrNull(item.url),
      };
    }
    default: {
      return unhandledCmsMenuItemKind(item);
    }
  }
}

function cmsMenuItemData(props: {
  readonly item: CmsSeedMenuItem;
  readonly menuId: string;
}) {
  return {
    menuId: props.menuId,
    parentId: seedTextOrNull(props.item.parentId),
    ...cmsMenuItemLinkData(props.item),
    label: props.item.label,
    isVisible: props.item.isVisible,
    displayOrder: props.item.displayOrder,
    systemKey: seedTextOrNull(props.item.systemKey),
  };
}

async function seedCmsMenuItem(props: {
  readonly p: PrismaClient;
  readonly menu: CmsSeedMenu;
  readonly item: CmsSeedMenuItem;
}): Promise<void> {
  const data = cmsMenuItemData({
    item: props.item,
    menuId: props.menu.id,
  });
  await props.p.cmsMenuItem.upsert({
    where: { id: props.item.id },
    create: {
      id: props.item.id,
      ...data,
    },
    update: data,
  });
}

async function deleteStaleCmsMenuItems(props: {
  readonly items: readonly CmsSeedMenuItem[];
  readonly menu: CmsSeedMenu;
  readonly p: PrismaClient;
}): Promise<void> {
  await props.p.cmsMenuItem.deleteMany({
    where:
      props.items.length === 0
        ? { menuId: props.menu.id }
        : {
            menuId: props.menu.id,
            id: { notIn: props.items.map((item) => item.id) },
          },
  });
}

async function seedCmsMenus(p: PrismaClient): Promise<void> {
  for (const menu of CMS_MENU_SEED_ROWS) {
    const items = orderedCmsSeedMenuItems(menu);

    await p.cmsMenu.upsert({
      where: { id: menu.id },
      create: {
        id: menu.id,
        location: menu.location,
        title: menu.title,
      },
      update: {
        location: menu.location,
        title: menu.title,
      },
    });

    await deleteStaleCmsMenuItems({ items, menu, p });

    for (const item of items) {
      await seedCmsMenuItem({ p, menu, item });
    }
  }
}

/**
 * @param p - Prisma client
 */
export async function seedCmsContent(p: PrismaClient): Promise<void> {
  await seedCmsPages(p);
  await seedCmsMenus(p);
}
