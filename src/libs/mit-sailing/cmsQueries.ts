import 'server-only';
import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { safeCmsMenuItemHref } from '@/libs/mit-sailing/cmsHref';
import { safePublicCmsBlockImageSrc } from '@/libs/mit-sailing/cmsValidation';

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
  kind:
    | 'hero'
    | 'text_section'
    | 'callout'
    | 'pricing'
    | 'home_overview'
    | 'home_classes';
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageSrc?: string;
  imageAlt?: string;
};

const VALID_PUBLIC_CMS_BLOCK_KINDS = new Set<string>([
  'hero',
  'text_section',
  'callout',
  'pricing',
  'home_overview',
  'home_classes',
]);

function isPublicCmsBlockKind(kind: string): kind is PublicCmsBlock['kind'] {
  return VALID_PUBLIC_CMS_BLOCK_KINDS.has(kind);
}

function isPublicCmsBlockRow<T extends { kind: string }>(
  block: T
): block is T & { kind: PublicCmsBlock['kind'] } {
  return isPublicCmsBlockKind(block.kind);
}

function publicCmsBlockCtaAndImage(block: {
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageAlt: string | null;
  imageSrc: string | null;
  showCta: boolean;
  showImage: boolean;
}): Pick<PublicCmsBlock, 'ctaLabel' | 'ctaUrl' | 'imageSrc' | 'imageAlt'> {
  const safeHref = safeCmsMenuItemHref(block.ctaUrl?.trim());
  const ctaLabelTrimmed = block.ctaLabel?.trim();
  const emitCta =
    block.showCta && Boolean(ctaLabelTrimmed) && Boolean(safeHref);

  const normalizedImageSrc = safePublicCmsBlockImageSrc(block.imageSrc);
  const imageAltTrimmed = block.imageAlt?.trim();
  const emitImage =
    block.showImage && Boolean(normalizedImageSrc) && Boolean(imageAltTrimmed);

  return {
    ctaLabel: emitCta ? ctaLabelTrimmed : undefined,
    ctaUrl: emitCta ? safeHref : undefined,
    imageSrc: emitImage ? normalizedImageSrc : undefined,
    imageAlt: emitImage ? imageAltTrimmed : undefined,
  };
}

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

/**
 * Builds a public menu `href` from linked page path or explicit URL, then sanitizes via
 * {@link safeCmsMenuItemHref} (safe app paths, `http`/`https`, `mailto`; no `javascript:`/`data:`/etc.).
 *
 * @param row - Menu row from Prisma (linked page and/or explicit URL)
 * @returns Sanitized `href` when allowed, otherwise `undefined`
 */
function hrefForCmsMenuItem(row: CmsMenuItemRow): string | undefined {
  const linkedPath = row.linkedPage?.path?.trim();
  const explicitUrl = row.url?.trim();
  const candidate =
    linkedPath !== undefined && linkedPath.length > 0
      ? linkedPath
      : (explicitUrl ?? undefined);
  return safeCmsMenuItemHref(candidate);
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
        logger.warn('CMS menu item omitted: parent not in menu result', {
          nodeId: row.id,
          parentId: row.parentId,
        });
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
 * Block CTAs emit {@link safeCmsMenuItemHref}-validated URLs paired with non-empty labels;
 * images emit {@link safePublicCmsBlockImageSrc}-validated paths paired with non-empty alt text.
 *
 * @param path - Public path, including leading slash
 * @returns Page DTO or null when unpublished/missing
 */
async function loadPublishedCmsPageByPathUnchecked(
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
          showCta: true,
          imageSrc: true,
          imageAlt: true,
          showImage: true,
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
    blocks: page.blocks.filter(isPublicCmsBlockRow).map((block) => ({
      id: block.id,
      kind: block.kind,
      title: block.title,
      subtitle: block.subtitle ?? undefined,
      body: block.body ?? undefined,
      ...publicCmsBlockCtaAndImage(block),
    })),
  };
}

export const loadPublishedCmsPageByPath = cache(
  loadPublishedCmsPageByPathUnchecked
);
