import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  adminCatalogResourceAssociationPath,
  adminCatalogResourceEditPath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import {
  addSailingClassUnlockedBoatAction,
  removeSailingClassUnlockedBoatAction,
} from '@/libs/admin/sailing-classes/sailingClassAssociationActions';
import { sailingClassAssocQueryErrorMessage } from '@/libs/admin/sailing-classes/sailingClassAssocQueryErrorMessage';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';

type PageProps = {
  params: Promise<{ locale: string; resource: string; id: string }>;
  searchParams: Promise<{ error?: string; page?: string }>;
};

const PAGE_SIZE = 15;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_sailing_class_unlocked_boats') };
}

/**
 * Paginated unlocked boat links for a sailing class (`resource` must be `sailing_classes`).
 *
 * @param props - App Router page props
 * @returns Association admin UI
 */
export default async function AdminSailingClassUnlockedBoatsPage(
  props: PageProps
) {
  const { locale, resource, id } = await props.params;
  const { error: errorCode, page: pageRaw } = await props.searchParams;
  setRequestLocale(locale);

  if (resource !== 'sailing_classes') {
    notFound();
  }

  const sailingClass = await prisma.sailingClass.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!sailingClass) {
    notFound();
  }

  const page =
    pageRaw !== undefined && pageRaw !== ''
      ? Math.max(1, Number.parseInt(pageRaw, 10) || 1)
      : 1;

  const total = await prisma.sailingClassUnlockedBoat.count({
    where: { sailingClassId: id },
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const rows = await prisma.sailingClassUnlockedBoat.findMany({
    where: { sailingClassId: id },
    orderBy: { fleetBoat: { displayOrder: 'asc' } },
    skip,
    take: PAGE_SIZE,
    select: {
      fleetBoat: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  const linkedBoats = await prisma.sailingClassUnlockedBoat.findMany({
    where: { sailingClassId: id },
    select: { fleetBoatId: true },
  });
  const linkedSet = new Set(linkedBoats.map((r) => r.fleetBoatId));

  const candidateBoats = await prisma.fleetBoat.findMany({
    where: linkedSet.size === 0 ? undefined : { id: { notIn: [...linkedSet] } },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    take: 400,
    select: { id: true, name: true, slug: true },
  });

  const t = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const tRoutes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });

  const basePath = adminCatalogResourceAssociationPath(
    resource,
    id,
    'unlocked-boats'
  );
  const addAction = addSailingClassUnlockedBoatAction.bind(null, locale, id);
  const assocErrorMessage = sailingClassAssocQueryErrorMessage(errorCode, t);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-mit-text">
          {t('assoc_page_unlocked_boats_title')} — {sailingClass.name}
        </h1>
        <Link
          className="text-sm font-medium text-mit-red no-underline hover:underline"
          href={adminCatalogResourceEditPath(resource, id)}
        >
          {t('assoc_back_to_edit')}
        </Link>
      </div>

      {assocErrorMessage ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {assocErrorMessage}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-mit-text">
          {t('assoc_action_add')}
        </h2>
        {candidateBoats.length === 0 ? (
          <p className="mt-2 text-sm text-mit-text">{t('assoc_empty')}</p>
        ) : (
          <form
            action={addAction}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <label className="flex min-w-[240px] flex-col gap-1 text-sm">
              <span className="font-medium text-mit-text">
                {t('assoc_select_boat')}
              </span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none"
                name="fleetBoatId"
                required
              >
                <option value="">—</option>
                {candidateBoats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.slug})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-md bg-mit-red px-3 py-2 text-sm font-semibold text-white hover:bg-mit-red-hover"
              type="submit"
            >
              {t('assoc_action_add')}
            </button>
          </form>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-medium">
                {t('assoc_column_linked_item')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('assoc_column_slug')}
              </th>
              <th className="px-4 py-3 font-medium">{t('column_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={3}>
                  {t('assoc_empty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.fleetBoat.id}>
                  <td className="px-4 py-3 text-mit-text">
                    {row.fleetBoat.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mit-text">
                    {row.fleetBoat.slug}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={removeSailingClassUnlockedBoatAction.bind(
                        null,
                        locale,
                        id
                      )}
                    >
                      <input
                        name="fleetBoatId"
                        type="hidden"
                        value={row.fleetBoat.id}
                      />
                      <button
                        className="text-sm font-medium text-mit-red hover:underline"
                        type="submit"
                      >
                        {t('assoc_action_remove')}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label={tRoutes('meta_title_admin_sailing_class_unlocked_boats')}
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="text-mit-text">
            {safePage} / {totalPages}
          </span>
          <div className="flex gap-3">
            {safePage > 1 ? (
              <Link
                className="font-medium text-mit-red no-underline hover:underline"
                href={`${basePath}?page=${safePage - 1}`}
              >
                {t('assoc_pagination_prev')}
              </Link>
            ) : (
              <span className="text-slate-400">
                {t('assoc_pagination_prev')}
              </span>
            )}
            {safePage < totalPages ? (
              <Link
                className="font-medium text-mit-red no-underline hover:underline"
                href={`${basePath}?page=${safePage + 1}`}
              >
                {t('assoc_pagination_next')}
              </Link>
            ) : (
              <span className="text-slate-400">
                {t('assoc_pagination_next')}
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
