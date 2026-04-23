import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

type IndexPageProps = {
  params: Promise<{ locale: string }>;
};

const linkClass = 'font-medium text-blue-800 hover:underline';

export async function generateMetadata(
  props: IndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingHome' });
  return { title: t('meta_title'), description: t('meta_description') };
}

export default async function Index(props: IndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'MitSailingHome' });

  return (
    <div>
      <p className="text-lg text-slate-800">{t('tagline')}</p>
      <p className="mt-6 text-slate-700">
        {t.rich('browse_rich', {
          events: (chunks) => (
            <Link className={linkClass} href="/events/">
              {chunks}
            </Link>
          ),
          classes: (chunks) => (
            <Link className={linkClass} href="/classes/">
              {chunks}
            </Link>
          ),
          contact: (chunks) => (
            <Link className={linkClass} href="/contact/">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
