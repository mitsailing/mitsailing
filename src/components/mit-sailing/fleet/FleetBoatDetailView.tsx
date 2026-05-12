import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { PublicCatalogDetailTopNav } from '@/components/mit-sailing/admin/PublicCatalogDetailTopNav';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { Link } from '@/libs/I18nNavigation';
import {
  cmsRichTextContainsRenderedImageFromSanitized,
  sanitizeCmsRichTextHtml,
} from '@/libs/mit-sailing/cmsRichText';
import type { FleetBoatDetail } from '@/libs/mit-sailing/fleetQueries';

type FleetBoatDetailViewProps = {
  locale: string;
  boat: FleetBoatDetail;
};

/**
 * @param props - Single boat detail page
 * @returns Boat detail marketing page
 */
export async function FleetBoatDetailView(props: FleetBoatDetailViewProps) {
  const { boat } = props;
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingFleet',
  });

  const bodyClass = 'text-base leading-relaxed text-mit-text';
  const sanitizedDescription = sanitizeCmsRichTextHtml(boat.description);
  const descriptionHasImage =
    cmsRichTextContainsRenderedImageFromSanitized(sanitizedDescription);
  const isLocalImagePath =
    boat.imagePath?.startsWith('/') === true &&
    !boat.imagePath.startsWith('//');

  return (
    <>
      <PublicCatalogDetailTopNav>
        <Link
          className={`inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
          href="/fleet"
        >
          <ArrowLeft aria-hidden size={16} />
          {t('back_to_fleet')}
        </Link>
        <PublicAdminEditLink
          className="mb-0 ml-auto shrink-0"
          href={adminCatalogResourceEditPath('fleet', boat.id)}
        />
      </PublicCatalogDetailTopNav>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {boat.name}
      </h1>
      <p className="mb-6 text-xs font-semibold tracking-wide text-mit-text uppercase">
        {boat.type} · {t('capacity_label')} {boat.capacity}
      </p>

      {boat.requiredRatings.length > 0 ? (
        <section className="mb-8 rounded-xl border border-mit-line bg-mit-red-highlight p-6">
          <h2 className="mt-0 mb-2 font-mit-serif text-xl font-semibold text-mit-text">
            {t('required_rating_heading')}
          </h2>
          <ul className="m-0 list-none space-y-1 p-0">
            {boat.requiredRatings.map((rating) => (
              <li key={rating.id}>
                <Link
                  className={`inline-flex items-center gap-1 font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                  href={`/ratings#${rating.slug}`}
                >
                  {rating.name} <ArrowRight aria-hidden size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mb-8 rounded-xl border border-mit-line bg-mit-red-highlight p-6">
          <h2 className="mt-0 mb-2 font-mit-serif text-xl font-semibold text-mit-text">
            {t('required_class_heading')}
          </h2>
          <Link
            className={`inline-flex items-center gap-1 font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
            href={`/classes/${boat.requiredClass.slug}/`}
          >
            {boat.requiredClass.name} <ArrowRight aria-hidden size={14} />
          </Link>
        </section>
      )}

      {boat.advancedRatings.length > 0 ? (
        <section className="mb-8 rounded-xl border border-mit-line bg-mit-surface p-6">
          <h2 className="mt-0 mb-2 font-mit-serif text-xl font-semibold text-mit-text">
            {t('advanced_rating_heading')}
          </h2>
          <ul className="m-0 list-none space-y-1 p-0">
            {boat.advancedRatings.map((rating) => (
              <li key={rating.id}>
                <Link
                  className={`inline-flex items-center gap-1 font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                  href={`/ratings#${rating.slug}`}
                >
                  {rating.name} <ArrowRight aria-hidden size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {boat.imagePath && !descriptionHasImage ? (
        <div className="relative mb-6 aspect-[16/10] max-h-[420px] overflow-hidden rounded-xl bg-mit-line">
          <Image
            alt={boat.name}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 1024px"
            src={boat.imagePath}
            unoptimized={isLocalImagePath}
          />
        </div>
      ) : null}

      <CmsRichText className={bodyClass} sanitizedHtml={sanitizedDescription} />
    </>
  );
}
