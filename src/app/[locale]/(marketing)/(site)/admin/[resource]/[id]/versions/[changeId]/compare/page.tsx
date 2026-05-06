import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { AdminCatalogVersionCompareFields } from '@/components/mit-sailing/admin/catalog/AdminCatalogVersionFields';
import { formatCatalogEditDate } from '@/components/mit-sailing/admin/catalog/catalogEditMetadataFormat';
import {
  adminCatalogResourceEditPath,
  adminCatalogResourceVersionPath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import { getCatalogVersionPageData } from '@/libs/admin/catalog/catalogVersionPageData';
import { catalogVersionDiffFields } from '@/libs/admin/catalog/catalogVersionSnapshots';
import { getI18nPath } from '@/utils/Helpers';

type AdminCatalogVersionComparePageProps = {
  params: Promise<{
    locale: string;
    resource: string;
    id: string;
    changeId: string;
  }>;
};

/**
 * Compares one stored catalog row version with the current row.
 *
 * @param props - App Router page props
 * @param props.params - Locale, resource, row id, and change id
 * @returns Version comparison page
 */
export default async function AdminCatalogVersionComparePage(
  props: AdminCatalogVersionComparePageProps
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
  const fields = catalogVersionDiffFields({
    definition: data.definition,
    current: data.current,
    snapshot: data.version.snapshot,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
              adminCatalogResourceVersionPath(resource, id, changeId),
              locale
            )}
          >
            {t('metadata_action_view')}
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
          {formatCatalogEditDate(data.version.createdAt, locale)}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-mit-text">
          {t('metadata_compare_heading')}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t('metadata_compare_intro')}
        </p>
      </header>

      <AdminCatalogVersionCompareFields fields={fields} t={(key) => t(key)} />
    </div>
  );
}
