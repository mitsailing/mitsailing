import 'server-only';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { classCategoriesCatalogHandlers } from '@/libs/admin/catalog/classCategoriesHandlers';
import { donationFundsCatalogHandlers } from '@/libs/admin/catalog/donationFundsHandlers';
import { eventCategoriesCatalogHandlers } from '@/libs/admin/catalog/eventCategoriesHandlers';
import { fleetCatalogHandlers } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassesCatalogHandlers } from '@/libs/admin/catalog/sailingClassesHandlers';
import {
  sailingRatingRulesCatalogHandlers,
  sailingRatingsCatalogHandlers,
} from '@/libs/admin/catalog/sailingRatingsHandlers';
import { siteAlertsCatalogHandlers } from '@/libs/admin/catalog/siteAlertsCatalogHandlers';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';

/**
 * Maps catalog resource ids to Prisma-backed handlers (server-only).
 */
const catalogServerHandlers: Record<CatalogResourceId, CatalogServerHandlers> =
  {
    donation_funds: donationFundsCatalogHandlers,
    event_categories: eventCategoriesCatalogHandlers,
    class_categories: classCategoriesCatalogHandlers,
    sailing_classes: sailingClassesCatalogHandlers,
    sailing_ratings: sailingRatingsCatalogHandlers,
    sailing_rating_rules: sailingRatingRulesCatalogHandlers,
    fleet: fleetCatalogHandlers,
    site_alerts: siteAlertsCatalogHandlers,
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
