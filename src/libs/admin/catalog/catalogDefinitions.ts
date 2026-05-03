import type { CatalogResourceDefinition } from '@/libs/admin/catalog/types';

/**
 * Static UI definitions for catalog admin resources (serializable; safe to pass
 * from server components into client field renderers).
 */
const donationFundsDefinition = {
  id: 'donation_funds',
  titleKey: 'title_admin_catalog_donation_funds',
  metaTitleKey: 'meta_title_admin_catalog_donation_funds',
  hubLabelKey: 'hub_label_donation_funds',
  listColumns: [
    {
      field: 'fundId',
      kind: 'string',
      headerKey: 'column_designation_id',
    },
    { field: 'name', kind: 'string', headerKey: 'column_name_label' },
    {
      field: 'isVisible',
      kind: 'visibility',
      headerKey: 'column_status',
    },
    {
      field: 'displayOrder',
      kind: 'number',
      headerKey: 'column_display_order_label',
    },
  ],
  formFields: [
    {
      field: 'fundId',
      kind: 'string',
      required: true,
      labelKey: 'field_designation_id',
    },
    {
      field: 'name',
      kind: 'string',
      required: true,
      labelKey: 'field_name',
    },
    {
      field: 'description',
      kind: 'text',
      labelKey: 'field_description',
    },
    {
      field: 'url',
      kind: 'url',
      required: true,
      labelKey: 'field_url',
    },
    {
      field: 'isVisible',
      kind: 'boolean',
      labelKey: 'field_visible',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: true,
  },
} as const satisfies CatalogResourceDefinition;

const eventCategoriesDefinition = {
  id: 'event_categories',
  titleKey: 'title_admin_event_categories',
  metaTitleKey: 'meta_title_admin_event_categories',
  hubLabelKey: 'hub_label_event_categories',
  listColumns: [
    { field: 'name', kind: 'string', headerKey: 'column_name_label' },
    {
      field: 'isVisible',
      kind: 'visibility',
      headerKey: 'column_status',
    },
    {
      field: 'displayOrder',
      kind: 'number',
      headerKey: 'column_display_order_label',
    },
  ],
  formFields: [
    {
      field: 'name',
      kind: 'string',
      required: true,
      labelKey: 'field_name',
    },
    {
      field: 'isVisible',
      kind: 'boolean',
      labelKey: 'field_visible',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: true,
  },
} as const satisfies CatalogResourceDefinition;

const classCategoriesDefinition = {
  id: 'class_categories',
  titleKey: 'title_admin_class_categories',
  metaTitleKey: 'meta_title_admin_class_categories',
  hubLabelKey: 'hub_label_class_categories',
  listColumns: [
    { field: 'slug', kind: 'string', headerKey: 'column_slug_label' },
    { field: 'name', kind: 'string', headerKey: 'column_name_label' },
    {
      field: 'isVisible',
      kind: 'visibility',
      headerKey: 'column_status',
    },
    {
      field: 'displayOrder',
      kind: 'number',
      headerKey: 'column_display_order_label',
    },
  ],
  formFields: [
    {
      field: 'slug',
      kind: 'string',
      required: true,
      labelKey: 'field_slug',
    },
    {
      field: 'name',
      kind: 'string',
      required: true,
      labelKey: 'field_name',
    },
    {
      field: 'isVisible',
      kind: 'boolean',
      labelKey: 'field_visible',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: true,
  },
} as const satisfies CatalogResourceDefinition;

const fleetDefinition = {
  id: 'fleet',
  titleKey: 'title_admin_catalog_fleet',
  metaTitleKey: 'meta_title_admin_catalog_fleet',
  hubLabelKey: 'hub_label_fleet',
  listColumns: [
    { field: 'name', kind: 'string', headerKey: 'column_name_label' },
    { field: 'slug', kind: 'string', headerKey: 'column_slug_label' },
    { field: 'type', kind: 'string', headerKey: 'column_type_label' },
    {
      field: 'capacity',
      kind: 'number',
      headerKey: 'column_capacity_label',
    },
    {
      field: 'requiredClassName',
      kind: 'string',
      headerKey: 'column_required_class_label',
    },
    {
      field: 'publicBoatUrl',
      kind: 'url',
      headerKey: 'column_public_boat_label',
    },
    {
      field: 'displayOrder',
      kind: 'number',
      headerKey: 'column_display_order_label',
    },
  ],
  formFields: [
    {
      field: 'name',
      kind: 'string',
      required: true,
      labelKey: 'field_name',
    },
    {
      field: 'slug',
      kind: 'string',
      required: true,
      labelKey: 'field_slug',
    },
    {
      field: 'type',
      kind: 'string',
      required: true,
      labelKey: 'field_boat_type',
    },
    {
      field: 'capacity',
      kind: 'number',
      required: true,
      labelKey: 'field_capacity',
    },
    {
      field: 'requiredClassId',
      kind: 'select',
      required: true,
      labelKey: 'field_required_class',
    },
    {
      field: 'description',
      kind: 'text',
      labelKey: 'field_description',
    },
    {
      field: 'imagePaths',
      kind: 'text',
      labelKey: 'field_image_paths',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: true,
  },
} as const satisfies CatalogResourceDefinition;

export const CATALOG_RESOURCE_IDS = [
  'donation_funds',
  'event_categories',
  'class_categories',
  'fleet',
] as const;

export type CatalogResourceId = (typeof CATALOG_RESOURCE_IDS)[number];

export const catalogResourceDefinitions: Record<
  CatalogResourceId,
  CatalogResourceDefinition
> = {
  donation_funds: donationFundsDefinition,
  event_categories: eventCategoriesDefinition,
  class_categories: classCategoriesDefinition,
  fleet: fleetDefinition,
};

export function isCatalogResourceId(id: string): id is CatalogResourceId {
  return CATALOG_RESOURCE_IDS.some((rid) => rid === id);
}

/**
 * @param id - URL segment under `/admin/:resource` (registered catalog id)
 * @returns Definition when `id` is registered
 */
export function tryGetCatalogDefinition(
  id: string
): CatalogResourceDefinition | undefined {
  if (!isCatalogResourceId(id)) {
    return undefined;
  }
  return catalogResourceDefinitions[id];
}
