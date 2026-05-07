import { ArrowLeft, MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { mashneeBluewaterLocation } from '@/data/mit-sailing/pavilionInfoSeed';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

type MashneeDirectionsViewProps = {
  locale: string;
};

/**
 * Mashnee bluewater venue directions page body.
 *
 * @param props - Active locale
 * @returns Directions article
 */
export async function MashneeDirectionsView(props: MashneeDirectionsViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingContact',
  });
  const paragraphs = [
    { key: 'mashnee_paragraph_1', text: t('mashnee_paragraph_1') },
    { key: 'mashnee_paragraph_2', text: t('mashnee_paragraph_2') },
    { key: 'mashnee_paragraph_3', text: t('mashnee_paragraph_3') },
  ];

  return (
    <article className="max-w-3xl pb-24 text-mit-text">
      <Link
        className={`mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
        href="/contact/"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('mashnee_back')}
      </Link>

      <h1 className="mb-6 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
        {t('mashnee_heading')}
      </h1>
      <p className="mb-8 text-base leading-relaxed text-mit-text">
        {t('mashnee_location_summary')}
      </p>

      <div className="mb-10 rounded-xl border border-mit-line bg-card p-6">
        <h2 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text">
          {t('mashnee_location_title')}
        </h2>
        <address className="mb-5 flex items-start gap-2 text-base leading-relaxed text-mit-text not-italic">
          <MapPin
            aria-hidden
            className="mt-1 size-4 shrink-0 text-mit-red-ink"
          />
          <span>
            {mashneeBluewaterLocation.lines.map((line) => (
              <span className="block" key={line}>
                {line}
              </span>
            ))}
          </span>
        </address>
        <a
          className={`font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
          href={mashneeBluewaterLocation.mapsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('mashnee_maps_link')}
          <span className="sr-only"> {t('opens_new_window')}</span>
        </a>
      </div>

      <div className="space-y-6">
        {paragraphs.map((paragraph) => (
          <p
            className="m-0 text-base leading-relaxed text-mit-text"
            key={paragraph.key}
          >
            {paragraph.text}
          </p>
        ))}
      </div>
    </article>
  );
}
