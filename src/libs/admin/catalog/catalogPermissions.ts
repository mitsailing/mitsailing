import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { Permission } from '@/libs/auth/permissions';

const CMS_CATALOG_RESOURCE_IDS = [
  'cms_pages',
  'cms_page_blocks',
  'cms_menus',
  'cms_menu_items',
] as const satisfies readonly CatalogResourceId[];

const CATALOG_RESOURCE_PERMISSIONS: Partial<
  Record<CatalogResourceId, Permission>
> = {
  class_categories: Permission.CLASS_CATEGORIES_MANAGE,
  donation_funds: Permission.DONATION_FUNDS_MANAGE,
  event_categories: Permission.EVENT_CATEGORIES_MANAGE,
  fleet: Permission.FLEET_MANAGE,
  sailing_classes: Permission.SAILING_CLASSES_MANAGE,
  sailing_rating_rules: Permission.SAILING_RATING_RULES_MANAGE,
  sailing_ratings: Permission.SAILING_RATINGS_MANAGE,
  site_alerts: Permission.SITE_ALERTS_MANAGE,
};

type CatalogPermissionOperation =
  | 'create'
  | 'delete'
  | 'reorder'
  | 'restore'
  | 'update'
  | 'view';

function isCmsCatalogResource(resourceId: CatalogResourceId): boolean {
  return (CMS_CATALOG_RESOURCE_IDS as readonly CatalogResourceId[]).includes(
    resourceId
  );
}

export function catalogPermissionForOperation(props: {
  operation: CatalogPermissionOperation;
  resourceId: CatalogResourceId;
}): Permission {
  if (isCmsCatalogResource(props.resourceId)) {
    if (props.operation === 'view') {
      return Permission.CMS_VIEW;
    }
    if (props.operation === 'delete') {
      return Permission.CMS_DELETE;
    }
    return Permission.CMS_EDIT;
  }
  const permission = CATALOG_RESOURCE_PERMISSIONS[props.resourceId];
  return permission ?? Permission.ADMIN_VIEW;
}

export function catalogPermissionsForOperation(props: {
  operation: CatalogPermissionOperation;
  resourceId: CatalogResourceId;
}): readonly Permission[] {
  return [catalogPermissionForOperation(props)];
}
