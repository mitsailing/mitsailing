import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { CatalogCategorySection } from '@/libs/mit-sailing/classQueries';

type ClassesCatalogViewProps = {
  locale: string;
  grouped: CatalogCategorySection[];
};

/**
 * @param props - Catalog list (mit-redesign ClassesPage parity)
 * @returns Classes index sections
 */
export async function ClassesCatalogView(props: ClassesCatalogViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingClasses',
  });

  return (
    <>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {t('catalog_heading')}
      </h1>
      <p className="mb-12 max-w-2xl text-base leading-relaxed text-mit-text">
        {t('catalog_intro')}
      </p>

      <div className="space-y-14">
        {props.grouped.map(({ category, classes: clsList }) => (
          <section
            aria-labelledby={`class-cat-${category.slug}`}
            id={category.slug}
            key={category.id}
          >
            <h2
              className="mb-6 font-mit-serif text-xl font-semibold text-mit-text md:text-2xl"
              id={`class-cat-${category.slug}`}
            >
              {category.name}
            </h2>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
              {clsList.map((c) => (
                <li key={c.id}>
                  <Link
                    className={`block h-full rounded-xl border border-mit-line bg-mit-surface p-6 no-underline transition-shadow hover:shadow-sm ${textFocusRingClassName}`}
                    href={`/classes/${c.slug}/`}
                  >
                    <div className="mb-2 text-[11px] font-bold tracking-wider text-mit-text uppercase">
                      {c.level}
                    </div>
                    <div className="mb-2 font-mit-serif text-lg font-semibold text-mit-text md:text-[18px]">
                      {c.name}
                    </div>
                    <p className="mb-4 line-clamp-3 text-sm leading-snug text-mit-text">
                      {c.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-mit-red">
                      {t('catalog_card_cta')}{' '}
                      <ArrowRight aria-hidden size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
