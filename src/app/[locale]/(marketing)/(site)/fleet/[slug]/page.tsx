import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { FleetBoatDetailView } from '@/components/mit-sailing/fleet/FleetBoatDetailView';
import { getFleetBoatForPublicBySlug } from '@/libs/mit-sailing/fleetQueries';
import { resolvePublicSlugRedirect } from '@/libs/mit-sailing/publicSlugRedirects';

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
    const redirectPath = await resolvePublicSlugRedirect({
      locale,
      scope: 'fleet',
      slug,
    });
    if (redirectPath) {
      permanentRedirect(redirectPath);
    }
    notFound();
  }
  return <FleetBoatDetailView boat={boat} locale={locale} />;
}
