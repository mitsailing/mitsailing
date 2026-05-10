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
      field: 'imagePath',
      kind: 'image',
      labelKey: 'field_fleet_image',
    },
    {
      field: 'description',
      kind: 'richText',
      labelKey: 'field_description',
    },
    {
      field: 'requiredClassId',
      kind: 'select',
      required: true,
      labelKey: 'field_required_class',
    },
  ],
  formSections: [
    {
      fields: ['name', 'slug', 'type', 'capacity'],
      headingKey: 'fleet_form_section_basics',
    },
    {
      fields: ['imagePath'],
      headingKey: 'fleet_form_section_fleet_image',
      helperKey: 'fleet_form_section_fleet_image_helper',
    },
    {
      fields: ['description'],
      headingKey: 'fleet_form_section_boat_page',
      helperKey: 'fleet_form_section_boat_page_helper',
    },
    {
      fields: ['requiredClassId'],
      headingKey: 'fleet_form_section_access',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: true,
  },
} as const satisfies CatalogResourceDefinition;

const sailingClassesDefinition = {
  id: 'sailing_classes',
  titleKey: 'title_admin_catalog_sailing_classes',
  metaTitleKey: 'meta_title_admin_catalog_sailing_classes',
  hubLabelKey: 'hub_label_sailing_classes',
  listColumns: [
    { field: 'name', kind: 'string', headerKey: 'column_name_label' },
    {
      field: 'isVisible',
      kind: 'visibility',
      headerKey: 'column_status',
    },
    { field: 'slug', kind: 'string', headerKey: 'column_slug_label' },
    { field: 'level', kind: 'string', headerKey: 'column_level_label' },
    {
      field: 'classCategoryName',
      kind: 'string',
      headerKey: 'column_class_category_label',
    },
    {
      field: 'relatedEventsCount',
      kind: 'number',
      headerKey: 'column_related_events_count',
    },
    {
      field: 'prerequisitesCount',
      kind: 'number',
      headerKey: 'column_prerequisites_count',
    },
    {
      field: 'unlockedBoatsCount',
      kind: 'number',
      headerKey: 'column_unlocked_boats_count',
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
      field: 'classCategoryId',
      kind: 'select',
      required: true,
      labelKey: 'field_class_category',
    },
    {
      field: 'level',
      kind: 'string',
      required: true,
      labelKey: 'field_level',
    },
    {
      field: 'description',
      kind: 'richText',
      labelKey: 'field_description',
    },
    {
      field: 'imagePaths',
      kind: 'imageList',
      labelKey: 'field_image_paths',
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

const siteAlertsDefinition = {
  id: 'site_alerts',
  titleKey: 'title_admin_catalog_site_alerts',
  metaTitleKey: 'meta_title_admin_catalog_site_alerts',
  hubLabelKey: 'hub_label_site_alerts',
  listColumns: [
    {
      field: 'bodyPlainText',
      kind: 'string',
      headerKey: 'column_site_alert_message',
    },
    {
      field: 'isPublished',
      kind: 'visibility',
      headerKey: 'column_site_alert_published',
    },
    {
      field: 'startDateLabel',
      kind: 'string',
      headerKey: 'column_site_alert_start_date',
    },
    {
      field: 'lastDateLabel',
      kind: 'string',
      headerKey: 'column_site_alert_last_date',
    },
  ],
  formFields: [
    {
      field: 'body',
      kind: 'text',
      labelKey: 'field_site_alert_message',
    },
    {
      field: 'startDate',
      kind: 'date',
      required: true,
      labelKey: 'field_site_alert_start_date',
    },
    {
      field: 'lastDate',
      kind: 'date',
      required: true,
      labelKey: 'field_site_alert_last_date',
    },
    {
      field: 'isPublished',
      kind: 'boolean',
      labelKey: 'field_site_alert_published',
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: false,
  },
} as const satisfies CatalogResourceDefinition;

const cmsPagesDefinition = {
  id: 'cms_pages',
  titleKey: 'title_admin_catalog_cms_pages',
  metaTitleKey: 'meta_title_admin_catalog_cms_pages',
  hubLabelKey: 'hub_label_cms_pages',
  publicViewHrefField: 'path',
  listColumns: [
    { field: 'path', kind: 'string', headerKey: 'column_cms_path' },
    { field: 'title', kind: 'string', headerKey: 'column_name_label' },
    { field: 'isPublished', kind: 'visibility', headerKey: 'column_status' },
  ],
  formFields: [
    { field: 'slug', kind: 'string', required: true, labelKey: 'field_slug' },
    {
      field: 'path',
      kind: 'string',
      required: true,
      labelKey: 'field_cms_path',
    },
    { field: 'title', kind: 'string', required: true, labelKey: 'field_name' },
    {
      field: 'metaTitle',
      kind: 'string',
      required: true,
      labelKey: 'field_cms_meta_title',
    },
    {
      field: 'metaDescription',
      kind: 'text',
      required: true,
      labelKey: 'field_cms_meta_description',
    },
    {
      field: 'isPublished',
      kind: 'boolean',
      labelKey: 'field_cms_published',
    },
  ],
  capabilities: { create: true, update: true, delete: true, reorder: false },
} as const satisfies CatalogResourceDefinition;

const cmsPageBlocksDefinition = {
  id: 'cms_page_blocks',
  titleKey: 'title_admin_catalog_cms_page_blocks',
  metaTitleKey: 'meta_title_admin_catalog_cms_page_blocks',
  hubLabelKey: 'hub_label_cms_page_blocks',
  listColumns: [
    { field: 'kind', kind: 'string', headerKey: 'column_cms_kind' },
    { field: 'title', kind: 'string', headerKey: 'column_name_label' },
    { field: 'isVisible', kind: 'visibility', headerKey: 'column_status' },
  ],
  formFields: [
    {
      field: 'pageId',
      kind: 'select',
      required: true,
      labelKey: 'field_cms_page',
    },
    {
      field: 'kind',
      kind: 'select',
      required: true,
      labelKey: 'field_cms_kind',
      selectOptions: [
        { value: 'hero', labelKey: 'field_cms_kind_hero' },
        { value: 'text_section', labelKey: 'field_cms_kind_text_section' },
        { value: 'callout', labelKey: 'field_cms_kind_callout' },
        { value: 'pricing', labelKey: 'field_cms_kind_pricing' },
        { value: 'home_overview', labelKey: 'field_cms_kind_home_overview' },
        { value: 'home_classes', labelKey: 'field_cms_kind_home_classes' },
      ],
    },
    { field: 'title', kind: 'string', required: true, labelKey: 'field_name' },
    { field: 'subtitle', kind: 'text', labelKey: 'field_cms_subtitle' },
    { field: 'body', kind: 'richText', labelKey: 'field_cms_body' },
    { field: 'ctaLabel', kind: 'string', labelKey: 'field_cms_cta_label' },
    { field: 'ctaUrl', kind: 'string', labelKey: 'field_cms_cta_url' },
    { field: 'imageSrc', kind: 'image', labelKey: 'field_cms_image_src' },
    { field: 'imageAlt', kind: 'string', labelKey: 'field_cms_image_alt' },
    { field: 'isVisible', kind: 'boolean', labelKey: 'field_visible' },
  ],
  capabilities: { create: true, update: true, delete: true, reorder: true },
} as const satisfies CatalogResourceDefinition;

const cmsMenusDefinition = {
  id: 'cms_menus',
  titleKey: 'title_admin_catalog_cms_menus',
  metaTitleKey: 'meta_title_admin_catalog_cms_menus',
  hubLabelKey: 'hub_label_cms_menus',
  listColumns: [
    { field: 'location', kind: 'string', headerKey: 'column_cms_location' },
    { field: 'title', kind: 'string', headerKey: 'column_name_label' },
  ],
  formFields: [
    {
      field: 'location',
      kind: 'select',
      required: true,
      labelKey: 'field_cms_location',
      selectOptions: [
        { value: 'header', labelKey: 'field_cms_location_header' },
        {
          value: 'mobile_utility',
          labelKey: 'field_cms_location_mobile_utility',
        },
        { value: 'footer', labelKey: 'field_cms_location_footer' },
        { value: 'legal', labelKey: 'field_cms_location_legal' },
        { value: 'social', labelKey: 'field_cms_location_social' },
      ],
    },
    { field: 'title', kind: 'string', required: true, labelKey: 'field_name' },
  ],
  capabilities: { create: true, update: true, delete: true, reorder: false },
} as const satisfies CatalogResourceDefinition;

const cmsMenuItemsDefinition = {
  id: 'cms_menu_items',
  titleKey: 'title_admin_catalog_cms_menu_items',
  metaTitleKey: 'meta_title_admin_catalog_cms_menu_items',
  hubLabelKey: 'hub_label_cms_menu_items',
  listColumns: [
    { field: 'parentLabel', kind: 'string', headerKey: 'column_cms_parent' },
    { field: 'label', kind: 'string', headerKey: 'column_name_label' },
    { field: 'url', kind: 'string', headerKey: 'column_cms_url' },
    { field: 'isVisible', kind: 'visibility', headerKey: 'column_status' },
  ],
  formFields: [
    {
      field: 'menuId',
      kind: 'select',
      required: true,
      labelKey: 'field_cms_menu',
    },
    { field: 'parentId', kind: 'select', labelKey: 'field_cms_parent' },
    {
      field: 'linkedPageId',
      kind: 'select',
      labelKey: 'field_cms_linked_page',
    },
    { field: 'label', kind: 'string', required: true, labelKey: 'field_name' },
    { field: 'url', kind: 'string', labelKey: 'field_cms_url' },
    { field: 'systemKey', kind: 'string', labelKey: 'field_cms_system_key' },
    { field: 'isExternal', kind: 'boolean', labelKey: 'field_cms_external' },
    { field: 'isVisible', kind: 'boolean', labelKey: 'field_visible' },
  ],
  capabilities: { create: true, update: true, delete: true, reorder: true },
} as const satisfies CatalogResourceDefinition;

export const CATALOG_RESOURCE_IDS = [
  'donation_funds',
  'event_categories',
  'class_categories',
  'sailing_classes',
  'fleet',
  'site_alerts',
  'cms_pages',
  'cms_page_blocks',
  'cms_menus',
  'cms_menu_items',
] as const;

export type CatalogResourceId = (typeof CATALOG_RESOURCE_IDS)[number];

export const catalogResourceDefinitions: Record<
  CatalogResourceId,
  CatalogResourceDefinition
> = {
  donation_funds: donationFundsDefinition,
  event_categories: eventCategoriesDefinition,
  class_categories: classCategoriesDefinition,
  sailing_classes: sailingClassesDefinition,
  fleet: fleetDefinition,
  site_alerts: siteAlertsDefinition,
  cms_pages: cmsPagesDefinition,
  cms_page_blocks: cmsPageBlocksDefinition,
  cms_menus: cmsMenusDefinition,
  cms_menu_items: cmsMenuItemsDefinition,
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
