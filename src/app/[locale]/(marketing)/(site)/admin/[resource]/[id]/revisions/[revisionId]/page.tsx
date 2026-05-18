import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogRevisionCompareView } from '@/components/mit-sailing/admin/catalog/AdminCatalogRevisionCompareView';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { restoreCatalogResourceRevisionAction } from '@/libs/admin/catalog/catalogActions';
import { isCatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { requirePermission } from '@/libs/auth/dal';
import {
  getAdminCatalogRevisionCompare,
  isCatalogHistoryResourceId,
} from '@/libs/mit-sailing/catalogHistory';

type PageProps = {
  params: Promise<{
    id: string;
    locale: string;
    resource: string;
    revisionId: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_catalog_revision_compare') };
}

export default async function AdminCatalogRevisionComparePage(
  props: PageProps
) {
  const { id, locale, resource, revisionId } = await props.params;
  setRequestLocale(locale);

  if (!isCatalogResourceId(resource) || !isCatalogHistoryResourceId(resource)) {
    notFound();
  }
  await requirePermission(
    catalogPermissionForOperation({
      operation: 'restore',
      resourceId: resource,
    }),
    locale
  );

  const compare = await getAdminCatalogRevisionCompare({
    itemId: id,
    resourceId: resource,
    revisionId,
  });
  if (!compare) {
    notFound();
  }

  const t = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const tCommon = await getTranslations({
    locale,
    namespace: 'Common',
  });
  const restoreAction = restoreCatalogResourceRevisionAction.bind(
    null,
    locale,
    resource,
    id,
    revisionId
  );

  return (
    <AdminCatalogRevisionCompareView
      actionLabels={{
        create: t('cms_history_action_create'),
        delete: t('cms_history_action_delete'),
        restore: t('catalog_history_action_restore'),
        update: t('cms_history_action_update'),
      }}
      compare={compare}
      editHref={adminCatalogResourceEditPath(resource, id)}
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
      locale={locale}
      restoreAction={restoreAction}
      text={{
        backToEdit: t('catalog_revision_back_to_edit'),
        changed: t('cms_revision_changed'),
        compareHeading: t('cms_revision_compare_heading'),
        comparingAgainst: t('cms_revision_comparing_against'),
        current: t('cms_revision_current'),
        currentlyViewing: t('cms_revision_currently_viewing'),
        emptyValue: t('cms_revision_empty_value'),
        falseValue: t('cms_revision_false'),
        moreChanges: (count) => t('cms_revision_more_changes', { count }),
        noChanges: t('cms_revision_no_changes'),
        restore: t('cms_revision_restore'),
        restoreConfirm: t('catalog_revision_restore_confirm'),
        restorePending: tCommon('pending_restoring'),
        snapshotVersion: (version) =>
          t('cms_revision_snapshot_version', { version }),
        trueValue: t('cms_revision_true'),
        unknownEditor: t('cms_history_editor_unknown'),
      }}
    />
  );
}
