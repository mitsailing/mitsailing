import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FleetBoatDetailView } from '@/components/mit-sailing/fleet/FleetBoatDetailView';
import { getFleetBoatForPublicBySlug } from '@/libs/mit-sailing/fleetQueries';
import { redirectPublicSlugAliasOrNotFound } from '@/libs/mit-sailing/publicSlugRedirects';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
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
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const boat = await getFleetBoatForPublicBySlug(slug);
  if (!boat) {
    return redirectPublicSlugAliasOrNotFound({
      locale,
      scope: 'fleet',
      slug,
    });
  }
  return <FleetBoatDetailView boat={boat} locale={locale} />;
}
