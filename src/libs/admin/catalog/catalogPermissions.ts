import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { Permission } from '@/libs/auth/permissions';

const CATALOG_RESOURCE_PERMISSIONS = {
  class_categories: Permission.CLASS_CATEGORIES_MANAGE,
  donation_funds: Permission.DONATION_FUNDS_MANAGE,
  event_categories: Permission.EVENT_CATEGORIES_MANAGE,
  fleet: Permission.FLEET_MANAGE,
  pavilion_spaces: Permission.PAVILION_RESERVATIONS_MANAGE,
  sailing_classes: Permission.SAILING_CLASSES_MANAGE,
  sailing_rating_rules: Permission.SAILING_RATING_RULES_MANAGE,
  sailing_ratings: Permission.SAILING_RATINGS_MANAGE,
  news: Permission.NEWS_MANAGE,
} as const satisfies Partial<Record<CatalogResourceId, Permission>>;
const CATALOG_RESOURCE_PERMISSION_LOOKUP: Readonly<
  Record<string, Permission | undefined>
> = CATALOG_RESOURCE_PERMISSIONS;

type CatalogPermissionOperation =
  | 'create'
  | 'delete'
  | 'reorder'
  | 'restore'
  | 'update'
  | 'view';

export function catalogPermissionForOperation(props: {
  operation: CatalogPermissionOperation;
  resourceId: string;
}): Permission {
  const permission = CATALOG_RESOURCE_PERMISSION_LOOKUP[props.resourceId];
  if (permission) {
    return permission;
  }
  if (props.operation === 'view') {
    return Permission.ADMIN_VIEW;
  }
  throw new Error(
    `Missing catalog permission mapping for resource "${props.resourceId}" and operation "${props.operation}"`
  );
}
