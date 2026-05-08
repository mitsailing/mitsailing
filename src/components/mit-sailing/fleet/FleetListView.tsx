import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { FleetBoatListRow } from '@/libs/mit-sailing/fleetQueries';

type FleetListViewProps = {
  locale: string;
  boats: FleetBoatListRow[];
};

/**
 * @param props - Fleet catalog list
 * @returns Fleet index grid
 */
export async function FleetListView(props: FleetListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingFleet',
  });

  return (
    <>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {t('list_heading')}
      </h1>
      <p className="mb-12 max-w-2xl text-base leading-relaxed text-mit-text">
        {t('list_intro')}
      </p>

      <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
        {props.boats.map((boat) => (
          <li key={boat.id}>
            <Link
              className={`block h-full overflow-hidden rounded-xl border border-mit-line bg-mit-surface no-underline transition-shadow hover:shadow-sm ${textFocusRingClassName}`}
              href={`/fleet/${boat.slug}/`}
            >
              <div
                aria-hidden
                className="flex aspect-[4/3] items-center justify-center bg-mit-line text-xs text-mit-text"
              >
                {t('photo_placeholder')}
              </div>
              <div className="p-6">
                <div className="mb-2 text-[11px] font-bold tracking-wider text-mit-text uppercase">
                  {boat.type} · {boat.capacity}{' '}
                  {boat.capacity === 1 ? t('crew_one') : t('crew_many')}
                </div>
                <h2 className="mb-2 font-mit-serif text-xl font-semibold text-mit-text">
                  {boat.name}
                </h2>
                <p className="mb-4 line-clamp-3 text-sm leading-snug text-mit-text">
                  {boat.description}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-mit-red-ink">
                  {t('card_cta')} <ArrowRight aria-hidden size={14} />
                </span>
                <p className="mt-3 mb-0 text-xs text-mit-text">
                  {t('required_class_label')}{' '}
                  <span className="font-semibold">
                    {boat.requiredClass.name}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
