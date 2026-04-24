import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_class_categories') };
}

export default async function AdminClassCategoriesPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const tc = await getTranslations({
    locale,
    namespace: 'AdminCatalog',
  });

  const categories = await prisma.classCategory.findMany({
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      displayOrder: true,
      isVisible: true,
      createdAt: true,
    },
  });

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t('title_admin_class_categories')}
      </h1>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-medium">{tc('column_id')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_slug')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_name')}</th>
              <th className="px-4 py-3 font-medium">
                {tc('column_display_order')}
              </th>
              <th className="px-4 py-3 font-medium">{tc('column_visible')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_created')}</th>
              <th className="px-4 py-3 font-medium">
                {tc('link_catalog_section')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {categories.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {row.id}
                </td>
                <td className="px-4 py-3 text-slate-900">{row.slug}</td>
                <td className="px-4 py-3 text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-slate-900 tabular-nums">
                  {row.displayOrder}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {row.isVisible ? tc('yes') : tc('no')}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {dateFmt.format(row.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-sm font-medium text-mit-red no-underline hover:underline"
                    href={`/classes/#${row.slug}`}
                  >
                    #{row.slug}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
