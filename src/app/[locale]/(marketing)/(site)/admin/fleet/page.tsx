import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';
import { prismaOrderByDisplayOrderAscNameAsc } from '@/libs/mit-sailing/prismaOrderPublicNav';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_fleet') };
}

export default async function AdminFleetPage(props: PageProps) {
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

  const boats = await prisma.fleetBoat.findMany({
    orderBy: prismaOrderByDisplayOrderAscNameAsc,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      capacity: true,
      requiredClass: {
        select: { slug: true, name: true },
      },
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title_admin_fleet')}</h1>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-medium">{tc('column_name')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_slug')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_type')}</th>
              <th className="px-4 py-3 font-medium">{tc('column_capacity')}</th>
              <th className="px-4 py-3 font-medium">
                {tc('column_required_class')}
              </th>
              <th className="px-4 py-3 font-medium">
                {tc('link_public_boat')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {boats.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-slate-900">{row.slug}</td>
                <td className="px-4 py-3 text-slate-900">{row.type}</td>
                <td className="px-4 py-3 text-slate-900 tabular-nums">
                  {row.capacity}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-mit-red no-underline hover:underline"
                    href={`/classes/${row.requiredClass.slug}/`}
                  >
                    {row.requiredClass.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-sm font-medium text-mit-red no-underline hover:underline"
                    href={`/fleet/${row.slug}/`}
                  >
                    {row.slug}
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
