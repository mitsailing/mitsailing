import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { Link } from '@/libs/I18nNavigation';
import type { SailingClassCatalogDetail } from '@/libs/mit-sailing/classQueries';
import type { ClassRelatedEventBlock } from '@/libs/mit-sailing/classRelatedOccurrences';

type ClassDetailViewProps = {
  locale: string;
  sailingClass: SailingClassCatalogDetail;
  occurrenceBlocks: ClassRelatedEventBlock[];
};

/**
 * @param props - Class detail (mit-redesign ClassDetailPage parity)
 * @returns Single class marketing page
 */
export async function ClassDetailView(props: ClassDetailViewProps) {
  const { sailingClass: cl, occurrenceBlocks } = props;
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingClasses',
  });

  const bodyClass = 'text-base leading-relaxed text-mit-text';
  const [primaryImage, ...moreImages] = cl.imagePaths;

  return (
    <>
      <PublicAdminEditLink
        href={adminCatalogResourceEditPath('sailing_classes', cl.id)}
      />
      <Link
        className={`mb-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
        href="/classes"
      >
        <ArrowLeft aria-hidden size={16} />
        {t('back_to_classes')}
      </Link>
      <p className="mb-2 text-xs font-semibold tracking-wide text-mit-text uppercase">
        {cl.classCategory.name}
      </p>
      <h1 className="mb-1 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {cl.name}
      </h1>
      <p className={`${bodyClass} mb-2 text-sm`}>
        {t('level_label')} <strong className="font-semibold">{cl.level}</strong>
      </p>
      {primaryImage ? (
        <div className="relative mt-6 mb-6 aspect-[16/10] max-h-[420px] overflow-hidden rounded-xl bg-mit-line">
          <Image
            alt={cl.name}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 1024px"
            src={primaryImage}
            unoptimized={primaryImage.startsWith('/')}
          />
        </div>
      ) : null}

      {moreImages.length > 0 ? (
        <ul className="m-0 mb-10 grid list-none grid-cols-2 gap-3 p-0">
          {moreImages.map((src) => (
            <li
              className="relative aspect-[4/3] overflow-hidden rounded-lg bg-mit-line"
              key={src}
            >
              <Image
                alt={t('additional_image_alt', { name: cl.name })}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 50vw, 320px"
                src={src}
                unoptimized={src.startsWith('/')}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <CmsRichText className={`${bodyClass} mt-5`} html={cl.description} />

      {cl.prerequisites.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text md:text-2xl">
            {t('section_prerequisites')}
          </h2>
          <ul className="m-0 list-disc space-y-2 pl-5">
            {cl.prerequisites.map((pre) => (
              <li className={bodyClass} key={pre.id}>
                <Link
                  className={`font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                  href={`/classes/${pre.slug}`}
                >
                  {pre.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text md:text-2xl">
          {t('section_related_events')}
        </h2>
        <div className="space-y-6">
          {occurrenceBlocks.map(({ eventId, event, occurrenceLines }) => (
            <div key={eventId}>
              {event ? (
                <>
                  <Link
                    className={`text-base font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                    href={`/events/${event.slug}`}
                  >
                    {event.name}
                  </Link>
                  {occurrenceLines.length === 0 ? (
                    <p className="mt-2 mb-0 text-sm text-mit-text">
                      {t('related_events_empty')}{' '}
                      <Link
                        className={`font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                        href="/events"
                      >
                        {t('related_events_calendar')}
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="m-0 mt-2 list-none space-y-1 p-0">
                      {occurrenceLines.map((row) => (
                        <li
                          className="text-sm text-mit-text"
                          key={row.eventDateId}
                        >
                          {row.rangeLabel}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-mit-text">
                  {t('related_event_unlisted')}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {cl.unlockedBoats.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text md:text-2xl">
            {t('section_fleet_access')}
          </h2>
          <ul className="m-0 list-none space-y-3 p-0">
            {cl.unlockedBoats.map((boat) => (
              <li key={boat.id}>
                <Link
                  className={`text-base font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                  href={`/fleet/${boat.slug}`}
                >
                  {boat.name}
                </Link>
                <p className="mt-1 mb-0 text-sm leading-snug text-mit-text">
                  {boat.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
