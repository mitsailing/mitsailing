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
      locale={props.locale}
      revisions={revisions}
      text={{
        compare: t('cms_history_compare'),
        empty: t('cms_history_empty'),
        heading: t('cms_history_heading'),
        snapshotBlocks: (count) => t('cms_history_snapshot_blocks', { count }),
        unknownEditor: t('cms_history_editor_unknown'),
        version: (version) => t('cms_history_version', { version }),
      }}
    />
  );
}
