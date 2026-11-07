import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsListView } from '@/components/mit-sailing/news/NewsListView';
import { listPublishedNews } from '@/libs/mit-sailing/newsQueries';

const NEWS_HEADING_ID = 'news-heading';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingNews',
  });
  return { title: t('meta_title') };
}

/**
 * Public news index (published rows from `news`).
 *
 * @param props - Page props
 * @param props.params - `[locale]` route params
 * @returns News list in marketing shell
 */
export default async function NewsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingNews',
  });
  const items = await listPublishedNews();

  return (
    <div>
      <h1
        id={NEWS_HEADING_ID}
        className="mb-3 text-2xl font-semibold text-foreground"
      >
        {t('page_heading')}
      </h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {t('page_intro')}
      </p>
      <NewsListView locale={locale} headingId={NEWS_HEADING_ID} items={items} />
    </div>
  );
}
