import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCmsRevisionCompareView } from '@/components/mit-sailing/admin/catalog/AdminCmsRevisionCompareView';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { restoreCmsPageRevisionAction } from '@/libs/admin/catalog/catalogActions';
import { getAdminCmsPageRevisionCompare } from '@/libs/mit-sailing/cmsHistory';

type PageProps = {
  params: Promise<{ locale: string; id: string; revisionId: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_catalog_edit') };
}

export default async function AdminCmsPageRevisionComparePage(
  props: PageProps
) {
  const { locale, id, revisionId } = await props.params;
  setRequestLocale(locale);

  const compare = await getAdminCmsPageRevisionCompare({
    pageId: id,
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
  const restoreAction = restoreCmsPageRevisionAction.bind(
    null,
    locale,
    id,
    revisionId
  );

  return (
    <AdminCmsRevisionCompareView
      actionLabels={{
        create: t('cms_history_action_create'),
        delete: t('cms_history_action_delete'),
        update: t('cms_history_action_update'),
      }}
      compare={compare}
      editHref={adminCatalogResourceEditPath('cms_pages', id)}
      fieldLabels={{
        body: t('field_cms_body'),
        ctaLabel: t('field_cms_cta_label'),
        ctaUrl: t('field_cms_cta_url'),
        displayOrder: t('field_display_order'),
        imageAlt: t('field_cms_image_alt'),
        imageSrc: t('field_cms_image_src'),
        isPublished: t('field_cms_published'),
        isVisible: t('field_visible'),
        kind: t('field_cms_kind'),
        metaDescription: t('field_cms_meta_description'),
        metaTitle: t('field_cms_meta_title'),
        path: t('field_cms_path'),
        slug: t('field_slug'),
        subtitle: t('field_cms_subtitle'),
        title: t('field_title'),
      }}
      locale={locale}
      restoreAction={restoreAction}
      text={{
        added: t('cms_revision_added'),
        backToEdit: t('cms_revision_back_to_edit'),
        changed: t('cms_revision_changed'),
        compareHeading: t('cms_revision_compare_heading'),
        comparingAgainst: t('cms_revision_comparing_against'),
        current: t('cms_revision_current'),
        currentlyViewing: t('cms_revision_currently_viewing'),
        emptyValue: t('cms_revision_empty_value'),
        falseValue: t('cms_revision_false'),
        moreChanges: (count) => t('cms_revision_more_changes', { count }),
        noChanges: t('cms_revision_no_changes'),
        removed: t('cms_revision_removed'),
        restore: t('cms_revision_restore'),
        restoreConfirm: t('cms_revision_restore_confirm'),
        restorePending: tCommon('pending_restoring'),
        snapshotVersion: (version) =>
          t('cms_revision_snapshot_version', { version }),
        trueValue: t('cms_revision_true'),
        unknownEditor: t('cms_history_editor_unknown'),
      }}
    />
  );
}
