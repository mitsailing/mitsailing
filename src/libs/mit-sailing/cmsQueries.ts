import 'server-only';
import { prisma } from '@/libs/DB';

export type CmsMenuLocation =
  | 'header'
  | 'mobile_utility'
  | 'footer'
  | 'legal'
  | 'social';

export type PublicCmsMenuItem = {
  id: string;
  label: string;
  href?: string;
  isExternal: boolean;
  systemKey?: string;
  children: PublicCmsMenuItem[];
};

export type PublicCmsBlock = {
  id: string;
  kind: 'hero' | 'text_section' | 'callout' | 'pricing' | 'home_overview';
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageSrc?: string;
  imageAlt?: string;
};

export type PublicCmsPage = {
  id: string;
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  blocks: PublicCmsBlock[];
};

type CmsMenuItemRow = {
  id: string;
  parentId: string | null;
  label: string;
  url: string | null;
  isExternal: boolean;
  systemKey: string | null;
  linkedPage: { path: string } | null;
};

function hrefForCmsMenuItem(row: CmsMenuItemRow): string | undefined {
  return row.linkedPage?.path ?? row.url ?? undefined;
}

function mapCmsMenuTree(rows: CmsMenuItemRow[]): PublicCmsMenuItem[] {
  const nodes = new Map<string, PublicCmsMenuItem>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      label: row.label,
      href: hrefForCmsMenuItem(row),
      isExternal: row.isExternal,
      systemKey: row.systemKey ?? undefined,
      children: [],
    });
  }

  const root: PublicCmsMenuItem[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) {
      continue;
    }
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
      continue;
    }
    root.push(node);
  }
  return root;
}

/**
 * Loads one CMS-controlled public menu directly from Prisma for the current SSR request.
 *
 * @param location - Menu slot
 * @returns Visible menu tree, ordered by parent and display order
 */
export async function loadCmsMenu(
  location: CmsMenuLocation
): Promise<PublicCmsMenuItem[]> {
  const menu = await prisma.cmsMenu.findUnique({
    where: { location },
    select: {
      items: {
        where: { isVisible: true },
        orderBy: [
          { parentId: 'asc' },
          { displayOrder: 'asc' },
          { label: 'asc' },
        ],
        select: {
          id: true,
          parentId: true,
          label: true,
          url: true,
          isExternal: true,
          systemKey: true,
          linkedPage: { select: { path: true } },
        },
      },
    },
  });
  return menu ? mapCmsMenuTree(menu.items) : [];
}

/**
 * Loads a published CMS page with visible blocks directly from Prisma for SSR.
 *
 * @param path - Public path, including leading slash
 * @returns Page DTO or null when unpublished/missing
 */
export async function loadPublishedCmsPageByPath(
  path: string
): Promise<PublicCmsPage | null> {
  const page = await prisma.cmsPage.findUnique({
    where: { path },
    select: {
      id: true,
      slug: true,
      path: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      isPublished: true,
      blocks: {
        where: { isVisible: true },
        orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          kind: true,
          title: true,
          subtitle: true,
          body: true,
          ctaLabel: true,
          ctaUrl: true,
          imageSrc: true,
          imageAlt: true,
        },
      },
    },
  });
  if (!page?.isPublished) {
    return null;
  }
  return {
    id: page.id,
    slug: page.slug,
    path: page.path,
    title: page.title,
    metaTitle: page.metaTitle ?? page.title,
    metaDescription: page.metaDescription ?? '',
    blocks: page.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      title: block.title,
      subtitle: block.subtitle ?? undefined,
      body: block.body ?? undefined,
      ctaLabel: block.ctaLabel ?? undefined,
      ctaUrl: block.ctaUrl ?? undefined,
      imageSrc: block.imageSrc ?? undefined,
      imageAlt: block.imageAlt ?? undefined,
    })),
  };
}
