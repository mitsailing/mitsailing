import { getTranslations } from 'next-intl/server';
import { AdminCatalogHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCatalogHistoryPanelView';
import { adminCatalogResourceRevisionPath } from '@/libs/admin/catalog/adminCatalogPaths';
import type { CatalogHistoryResourceId } from '@/libs/mit-sailing/catalogHistory';
import { listAdminCatalogRevisions } from '@/libs/mit-sailing/catalogHistory';

export async function AdminCatalogHistoryPanel(props: {
  itemId: string;
  locale: string;
  resourceId: CatalogHistoryResourceId;
}) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminCatalogResource',
  });
  const revisions = await listAdminCatalogRevisions({
    itemId: props.itemId,
    resourceId: props.resourceId,
  });
  const headingKey =
    props.resourceId === 'sailing_classes'
      ? 'catalog_history_class_heading'
      : 'catalog_history_fleet_heading';

  return (
    <AdminCatalogHistoryPanelView
      actionLabels={{
        create: t('cms_history_action_create'),
        delete: t('cms_history_action_delete'),
        restore: t('catalog_history_action_restore'),
        update: t('cms_history_action_update'),
      }}
      compareHrefFor={(revisionId) =>
        adminCatalogResourceRevisionPath(
          props.resourceId,
          props.itemId,
          revisionId
        )
      }
      fieldLabels={{
        capacity: t('field_capacity'),
        classCategoryId: t('field_class_category'),
        description: t('field_description'),
        imagePath: t('field_fleet_image'),
        imagePaths: t('field_image_paths'),
        isVisible: t('field_visible'),
        level: t('field_level'),
        name: t('field_name'),
        requiredClassId: t('field_required_class'),
        slug: t('field_slug'),
        type: t('field_boat_type'),
      }}
      locale={props.locale}
      revisions={revisions}
      text={{
        changed: (changes) => t('cms_history_changed_summary', { changes }),
        createdSummary: t('cms_history_created_summary'),
        empty: t('catalog_history_empty'),
        heading: t(headingKey),
        moreChanges: (count) => t('cms_history_more_changes', { count }),
        noChangesSummary: t('cms_history_no_field_changes'),
        unknownEditor: t('cms_history_editor_unknown'),
        version: (version) => t('cms_history_version', { version }),
        viewChanges: t('cms_history_view_changes'),
      }}
    />
  );
}
