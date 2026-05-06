import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { AdminCatalogVersionSnapshotFields } from '@/components/mit-sailing/admin/catalog/AdminCatalogVersionFields';
import { formatCatalogEditDate } from '@/components/mit-sailing/admin/catalog/catalogEditMetadataFormat';
import {
  adminCatalogResourceEditPath,
  adminCatalogResourceVersionComparePath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import { getCatalogVersionPageData } from '@/libs/admin/catalog/catalogVersionPageData';
import type { AdminCatalogResourceMessageKey } from '@/libs/admin/catalog/types';
import { getI18nPath } from '@/utils/Helpers';

type AdminCatalogVersionPageProps = {
  params: Promise<{
    locale: string;
    resource: string;
    id: string;
    changeId: string;
  }>;
};

function changeLabel(
  action: string,
  t: (key: AdminCatalogResourceMessageKey) => string
): string {
  if (action === 'created') {
    return t('metadata_change_created');
  }
  if (action === 'deleted') {
    return t('metadata_change_deleted');
  }
  if (action === 'restored') {
    return t('metadata_change_restored');
  }
  return t('metadata_change_updated');
}

/**
 * Shows one stored catalog row version.
 *
 * @param props - App Router page props
 * @param props.params - Locale, resource, row id, and change id
 * @returns Read-only version detail page
 */
export default async function AdminCatalogVersionPage(
  props: AdminCatalogVersionPageProps
) {
  const { locale, resource, id, changeId } = await props.params;
  setRequestLocale(locale);
  const data = await getCatalogVersionPageData({
    locale,
    resource,
    id,
    changeId,
  });

  const t = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const editor = data.version.editorName ?? t('metadata_unknown_editor');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className="text-sm font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
          href={getI18nPath(adminCatalogResourceEditPath(resource, id), locale)}
        >
          {t('metadata_back_to_edit')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-mit-text hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
            href={getI18nPath(
              adminCatalogResourceVersionComparePath(resource, id, changeId),
              locale
            )}
          >
            {t('metadata_action_compare')}
          </Link>
          <form action={data.restoreAction}>
            <input name="changeId" type="hidden" value={data.version.id} />
            <button
              className="rounded-md bg-mit-red px-3 py-2 text-sm font-semibold text-white hover:bg-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none"
              type="submit"
            >
              {t('metadata_action_restore')}
            </button>
          </form>
        </div>
      </div>

      <header className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          {changeLabel(data.version.action, t)}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-mit-text">
          {t('metadata_version_heading')}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {editor} · {formatCatalogEditDate(data.version.createdAt, locale)}
        </p>
      </header>

      <AdminCatalogVersionSnapshotFields
        definition={data.definition}
        snapshot={data.version.snapshot}
        t={(key) => t(key)}
      />
    </div>
  );
}
