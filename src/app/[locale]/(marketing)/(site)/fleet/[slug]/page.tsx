import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FleetBoatDetailView } from '@/components/mit-sailing/fleet/FleetBoatDetailView';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { adminEditLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { getSession } from '@/libs/auth/dal';
import { getFleetBoatForPublicBySlug } from '@/libs/mit-sailing/fleetQueries';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  const boat = await getFleetBoatForPublicBySlug(slug);
  if (!boat) {
    const t = await getTranslations({
      locale,
      namespace: 'MitSailingFleet',
    });
    return { title: t('meta_not_found_title') };
  }
  return { title: boat.name };
}

export default async function BoatDetailPage(props: PageProps) {
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  setRequestLocale(locale);
  const boat = await getFleetBoatForPublicBySlug(slug);
  if (!boat) {
    notFound();
  }
  const session = await getSession();
  const adminEditHref = adminEditLinkVisibleFromSession({
    userId: session?.user?.id,
    userRole: session?.user?.role,
    impersonatedBy: session?.session?.impersonatedBy,
  })
    ? adminCatalogResourceEditPath('fleet', boat.id)
    : undefined;
  return (
    <FleetBoatDetailView
      adminEditHref={adminEditHref}
      boat={boat}
      locale={locale}
    />
  );
}
