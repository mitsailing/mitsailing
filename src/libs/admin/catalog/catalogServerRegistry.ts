import 'server-only';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { classCategoriesCatalogHandlers } from '@/libs/admin/catalog/classCategoriesHandlers';
import { donationFundsCatalogHandlers } from '@/libs/admin/catalog/donationFundsHandlers';
import { fleetCatalogHandlers } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { newsCatalogHandlers } from '@/libs/admin/catalog/newsCatalogHandlers';
import { pavilionSpacesCatalogHandlers } from '@/libs/admin/catalog/pavilionSpacesHandlers';
import { sailingClassesCatalogHandlers } from '@/libs/admin/catalog/sailingClassesHandlers';
import {
  sailingRatingRulesCatalogHandlers,
  sailingRatingsCatalogHandlers,
} from '@/libs/admin/catalog/sailingRatingsHandlers';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';
import { createZenStackCatalogHandlers } from '@/libs/admin/catalog/zenstackCatalogHandlers';

/**
 * Maps catalog resource ids to Prisma-backed handlers (server-only).
 */
const catalogServerHandlers: Record<CatalogResourceId, CatalogServerHandlers> =
  {
    donation_funds: donationFundsCatalogHandlers,
    event_categories: createZenStackCatalogHandlers('event_categories'),
    class_categories: classCategoriesCatalogHandlers,
    sailing_classes: sailingClassesCatalogHandlers,
    sailing_ratings: sailingRatingsCatalogHandlers,
    sailing_rating_rules: sailingRatingRulesCatalogHandlers,
    fleet: fleetCatalogHandlers,
    news: newsCatalogHandlers,
    pavilion_spaces: pavilionSpacesCatalogHandlers,
  };

/**
 * Resolves server handlers for a validated catalog resource id.
 *
 * @param id - Registered catalog resource id
 * @returns Handler bundle
 */
export function getCatalogServerHandlers(
  id: CatalogResourceId
): CatalogServerHandlers {
  return catalogServerHandlers[id];
}
