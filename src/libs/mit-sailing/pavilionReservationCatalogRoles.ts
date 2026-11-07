import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

export type PavilionCatalogRole =
  | 'addon'
  | 'after_hours'
  | 'hourly_venue'
  | 'program'
  | 'hidden';

const AFTER_HOURS_SLUGS = new Set(['after_10', 'after_midnight']);
const ADDON_SLUGS = new Set(['grill', 'party_boat', 'wedding_space']);
const PROGRAM_SLUGS = new Set(['lab_access', 'group_sailing']);
const WEDDING_SLUGS = new Set(['wedding_space', 'wedding_service']);

/**
 * Maps a catalog item to its reserve-builder role for the public wizard.
 *
 * @param item - Visible or seeded pavilion catalog item
 * @returns UI role used to group venues, add-ons, programs, and after-hours
 */
export function pavilionReservableItemCatalogRole(
  item: Pick<PavilionReservableItemDto, 'kind' | 'pricingType' | 'slug'>
): PavilionCatalogRole {
  if (AFTER_HOURS_SLUGS.has(item.slug)) {
    return 'after_hours';
  }
  if (WEDDING_SLUGS.has(item.slug) || ADDON_SLUGS.has(item.slug)) {
    return 'addon';
  }
  if (PROGRAM_SLUGS.has(item.slug)) {
    return 'program';
  }
  if (item.pricingType === 'hourly') {
    return 'hourly_venue';
  }
  if (item.kind === 'service') {
    return 'hidden';
  }
  if (item.pricingType === 'flat') {
    return 'addon';
  }
  return 'hidden';
}

/**
 * Returns whether the catalog item is the wedding add-on.
 *
 * @param item - Catalog item
 * @returns True when the item is a wedding add-on
 */
export function isPavilionWeddingCatalogItem(
  item: Pick<PavilionReservableItemDto, 'slug'>
) {
  return WEDDING_SLUGS.has(item.slug);
}

/**
 * Returns whether the catalog item is an after-hours fee band.
 *
 * @param item - Catalog item
 * @returns True when the item is an after-hours fee
 */
export function isPavilionAfterHoursCatalogItem(
  item: Pick<PavilionReservableItemDto, 'slug'>
) {
  return AFTER_HOURS_SLUGS.has(item.slug);
}

/**
 * Partitions visible catalog items for the request builder.
 *
 * @param items - Visible pavilion reservable items
 * @returns Hourly venues, add-ons, programs, and after-hours rows
 */
export function partitionPavilionCatalogForRequestBuilder(
  items: PavilionReservableItemDto[]
) {
  const hourlyVenues: PavilionReservableItemDto[] = [];
  const addons: PavilionReservableItemDto[] = [];
  const programs: PavilionReservableItemDto[] = [];
  const afterHours: PavilionReservableItemDto[] = [];

  for (const item of items) {
    switch (pavilionReservableItemCatalogRole(item)) {
      case 'hourly_venue': {
        hourlyVenues.push(item);
        break;
      }
      case 'addon': {
        addons.push(item);
        break;
      }
      case 'program': {
        programs.push(item);
        break;
      }
      case 'after_hours': {
        afterHours.push(item);
        break;
      }
      case 'hidden': {
        break;
      }
      default: {
        break;
      }
    }
  }

  return { addons, afterHours, hourlyVenues, programs };
}
