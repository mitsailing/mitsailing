import { getTranslations } from 'next-intl/server';
import { AdminCmsHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCmsHistoryPanelView';
import { adminCmsPageRevisionPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { listAdminCmsPageRevisions } from '@/libs/mit-sailing/cmsHistory';

export async function AdminCmsHistoryPanel(props: {
  locale: string;
  pageId: string;
}) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminCatalogResource',
  });
  const revisions = await listAdminCmsPageRevisions(props.pageId);

  return (
    <AdminCmsHistoryPanelView
      actionLabels={{
        create: t('cms_history_action_create'),
        delete: t('cms_history_action_delete'),
        update: t('cms_history_action_update'),
      }}
      compareHrefFor={(revisionId) =>
        adminCmsPageRevisionPath(props.pageId, revisionId)
      }
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
      locale={props.locale}
      revisions={revisions}
      text={{
        addedBlock: (blockTitle) =>
          t('cms_history_added_block_summary', { blockTitle }),
        changed: (changes) => t('cms_history_changed_summary', { changes }),
        createdSummary: t('cms_history_created_summary'),
        empty: t('cms_history_empty'),
        heading: t('cms_history_heading'),
        moreChanges: (count) => t('cms_history_more_changes', { count }),
        noChangesSummary: t('cms_history_no_field_changes'),
        removedBlock: (blockTitle) =>
          t('cms_history_removed_block_summary', { blockTitle }),
        unknownEditor: t('cms_history_editor_unknown'),
        version: (version) => t('cms_history_version', { version }),
        viewChanges: t('cms_history_view_changes'),
      }}
    />
  );
}
