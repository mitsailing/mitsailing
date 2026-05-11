import 'server-only';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { classCategoriesCatalogHandlers } from '@/libs/admin/catalog/classCategoriesHandlers';
import {
  cmsMenuItemsCatalogHandlers,
  cmsMenusCatalogHandlers,
  cmsPageBlocksCatalogHandlers,
  cmsPagesCatalogHandlers,
} from '@/libs/admin/catalog/cmsCatalogHandlers';
import { donationFundsCatalogHandlers } from '@/libs/admin/catalog/donationFundsHandlers';
import { eventCategoriesCatalogHandlers } from '@/libs/admin/catalog/eventCategoriesHandlers';
import { fleetCatalogHandlers } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassesCatalogHandlers } from '@/libs/admin/catalog/sailingClassesHandlers';
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
    fleet: fleetCatalogHandlers,
    site_alerts: siteAlertsCatalogHandlers,
    cms_pages: cmsPagesCatalogHandlers,
    cms_page_blocks: cmsPageBlocksCatalogHandlers,
    cms_menus: cmsMenusCatalogHandlers,
    cms_menu_items: cmsMenuItemsCatalogHandlers,
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
