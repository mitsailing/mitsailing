import { HEADER_MENU_SEED_ITEMS } from '@/data/mit-sailing/headerMenuSeed';
import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';

const HEADER_CSV_MARKER_ID = 'header-pavilion';
const REMOVED_INTRO_CHILD_ID = 'header-learn-intro-xp';
const LEARN_ITEM_ID = 'header-learn';
const LEARN_ITEM_URL = '/classes';

type HeaderMenuItemRow = {
  id?: string | null;
  label?: string | null;
  linkType?: string | null;
  parent?: string | null;
  url?: string | null;
  systemKey?: string | null;
  page?: unknown;
  boat?: unknown;
  class?: unknown;
};

function headerMenuItemsFromSeed() {
  return HEADER_MENU_SEED_ITEMS.map((item) => {
    const hasUrl = typeof item.url === 'string' && item.url.trim().length > 0;
    return {
      id: item.id,
      label: item.label,
      // Payload requires linkType; parents without a destination still use `url`
      // with an empty value so editors see a blank URL instead of a fake page link.
      linkType: 'url' as const,
      parent: item.parent,
      ...(hasUrl ? { url: item.url } : {}),
    };
  });
}

function itemId(item: HeaderMenuItemRow): string | null {
  return typeof item.id === 'string' && item.id.trim() ? item.id : null;
}

/**
 * Creates the CSV header menu when missing, replaces a pre-CSV menu once, and
 * surgically drops the retired Intro-for-XP child without wiping CMS edits.
 */
export async function ensureHeaderMenuSeed(): Promise<void> {
  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: 'menus',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      location: { equals: 'header' },
    },
  });
  const [menu] = existing.docs;
  const items = (Array.isArray(menu?.items) ? menu.items : []).filter(
    (item): item is HeaderMenuItemRow =>
      typeof item === 'object' && item !== null
  );
  const hasCsvSeed = items.some(
    (item) => itemId(item) === HEADER_CSV_MARKER_ID
  );
  const hasRemovedIntroChild = items.some(
    (item) => itemId(item) === REMOVED_INTRO_CHILD_ID
  );

  if (!menu) {
    await payload.create({
      collection: 'menus',
      data: {
        location: 'header',
        items: headerMenuItemsFromSeed(),
      },
      overrideAccess: true,
    });
    return;
  }

  if (!hasCsvSeed) {
    await payload.update({
      collection: 'menus',
      id: menu.id,
      data: {
        location: 'header',
        items: headerMenuItemsFromSeed(),
      },
      overrideAccess: true,
    });
    return;
  }

  if (!hasRemovedIntroChild) {
    return;
  }

  const nextItems = items
    .filter((item) => itemId(item) !== REMOVED_INTRO_CHILD_ID)
    .map((item) => {
      if (itemId(item) !== LEARN_ITEM_ID) {
        return item;
      }
      return {
        ...item,
        linkType: item.linkType ?? 'url',
        url:
          typeof item.url === 'string' && item.url.trim()
            ? item.url
            : LEARN_ITEM_URL,
      };
    });

  await payload.update({
    collection: 'menus',
    id: menu.id,
    data: {
      items: nextItems,
    },
    overrideAccess: true,
  });
}

let headerMenuSeedChecked = false;

/**
 * Runs {@link ensureHeaderMenuSeed} and logs failures without hiding chrome.
 */
export async function ensureHeaderMenuSeedSafely(): Promise<void> {
  if (headerMenuSeedChecked) {
    return;
  }
  try {
    await ensureHeaderMenuSeed();
    headerMenuSeedChecked = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed header menu: ${message}`);
  }
}
