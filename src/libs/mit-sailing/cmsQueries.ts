import 'server-only';
import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { safeCmsMenuItemHref } from '@/libs/mit-sailing/cmsHref';
import { safePublicCmsBlockImageSrc } from '@/libs/mit-sailing/cmsValidation';
import { ensureHeaderMenuSeedSafely } from '@/libs/mit-sailing/seedHeaderMenu';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { payloadIdString } from '@/libs/payload/mediaUrls';
import { publicPathFromPageSlug } from '@/libs/payload/pagePaths';

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

type PayloadMenuRelation =
  | number
  | string
  | { slug?: string | null }
  | null
  | undefined;

type PayloadMenuItem = {
  id?: string | null;
  label: string;
  linkType: 'boat' | 'class' | 'page' | 'url';
  page?: PayloadMenuRelation;
  boat?: PayloadMenuRelation;
  class?: PayloadMenuRelation;
  url?: string | null;
  parent?: string | null;
  systemKey?: string | null;
};

function slugFromMenuRelation(value: PayloadMenuRelation): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return typeof value.slug === 'string' ? value.slug : null;
}

/**
 * Builds a public menu `href` from Payload linkType + relationship/url.
 *
 * @param item - Payload menu array row
 * @returns Sanitized `href` when allowed, otherwise `undefined`
 */
function hrefForPayloadMenuItem(item: PayloadMenuItem): string | undefined {
  let candidate: string | undefined;
  switch (item.linkType) {
    case 'page': {
      const slug = slugFromMenuRelation(item.page);
      candidate = slug ? publicPathFromPageSlug(slug) : undefined;
      break;
    }
    case 'boat': {
      const slug = slugFromMenuRelation(item.boat);
      candidate = slug ? `/fleet/${encodeURIComponent(slug)}` : undefined;
      break;
    }
    case 'class': {
      const slug = slugFromMenuRelation(item.class);
      candidate = slug ? `/classes/${encodeURIComponent(slug)}` : undefined;
      break;
    }
    case 'url': {
      candidate = item.url?.trim() ?? undefined;
      break;
    }
    default: {
      candidate = undefined;
    }
  }
  return safeCmsMenuItemHref(candidate);
}

function isExternalMenuHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }
  return !href.startsWith('/') || href.startsWith('//');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPayloadMenuItem(value: unknown): value is PayloadMenuItem {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;
  return (
    typeof record.label === 'string' &&
    (record.linkType === 'boat' ||
      record.linkType === 'class' ||
      record.linkType === 'page' ||
      record.linkType === 'url')
  );
}

function payloadMenuItemsFromUnknown(value: unknown): PayloadMenuItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isPayloadMenuItem);
}

function mapPayloadMenuTree(items: PayloadMenuItem[]): PublicCmsMenuItem[] {
  const nodes = new Map<string, PublicCmsMenuItem>();
  const rows: { id: string; parentId: string | null }[] = [];

  for (const item of items) {
    if (!item.id) {
      continue;
    }
    const id = payloadIdString(item.id);
    const href = hrefForPayloadMenuItem(item);
    nodes.set(id, {
      children: [],
      href,
      id,
      isExternal: isExternalMenuHref(href),
      label: item.label,
      systemKey: item.systemKey ?? undefined,
    });
    rows.push({
      id,
      parentId: item.parent?.trim() ? item.parent.trim() : null,
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
 * Loads one CMS-controlled public menu from Payload for the current SSR request.
 *
 * @param location - Menu slot
 * @returns Menu tree nested by Payload item parent ids
 */
export async function loadCmsMenu(
  location: CmsMenuLocation
): Promise<PublicCmsMenuItem[]> {
  if (location === 'header') {
    await ensureHeaderMenuSeedSafely();
  }
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'menus',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    where: {
      location: { equals: location },
    },
  });
  const [menu] = result.docs;
  if (!menu?.items) {
    return [];
  }
  return mapPayloadMenuTree(payloadMenuItemsFromUnknown(menu.items));
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
