import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { AdminEditLink } from '@/components/mit-sailing/AdminEditLink';
import { SanitizedMarketingHtml } from '@/components/mit-sailing/marketing/SanitizedMarketingHtml';
import { getFleetBoatMarketingHeroSrc } from '@/lib/mit-sailing/fleetBoatMarketingImages';
import { marketingRichTextArticleClassName } from '@/lib/mit-sailing/marketingRichTextContentClassName';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { FleetBoatDetail } from '@/libs/mit-sailing/fleetQueries';

type FleetBoatDetailViewProps = {
  adminEditHref?: string;
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

  const heroSrc = getFleetBoatMarketingHeroSrc(boat.slug);
  const bodyClass = 'text-base leading-relaxed text-mit-text';

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          className={`inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName}`}
          href="/fleet/"
        >
          <ArrowLeft aria-hidden size={16} />
          {t('back_to_fleet')}
        </Link>
        {props.adminEditHref ? (
          <AdminEditLink href={props.adminEditHref} locale={props.locale} />
        ) : null}
      </div>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {boat.name}
      </h1>
      <p className="mb-6 text-xs font-semibold tracking-wide text-mit-text uppercase">
        {boat.type} · {t('capacity_label')} {boat.capacity}
      </p>

      <section className="mb-8 rounded-xl border border-mit-line bg-mit-red-highlight p-6">
        <h2 className="mt-0 mb-2 font-mit-serif text-xl font-semibold text-mit-text">
          {t('required_class_heading')}
        </h2>
        <Link
          className={`inline-flex font-semibold text-mit-red hover:underline ${textFocusRingClassName}`}
          href={`/classes/${boat.requiredClass.slug}/`}
        >
          {boat.requiredClass.name}
        </Link>
      </section>

      <div className="relative mb-6 aspect-[16/10] max-h-[420px] overflow-hidden rounded-xl bg-mit-line">
        <Image
          alt={boat.name}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 1024px"
          src={heroSrc}
          unoptimized={heroSrc.startsWith('/')}
        />
      </div>

      <SanitizedMarketingHtml
        className={`${bodyClass} ${marketingRichTextArticleClassName}`}
        html={boat.description}
      />
    </>
  );
}
