import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';

type AccountPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AccountPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'AccountHome',
  });
  return { title: t('meta_title') };
}

export default async function AccountPage(props: AccountPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const accountHref = getI18nPath('/account/', locale);
  const user = await requireCurrentUser(locale, accountHref);
  const t = await getTranslations({
    locale,
    namespace: 'AccountHome',
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-mit-text">
        {t('heading', { email: user.email ?? '' })}
      </h1>
      <p className="mt-2 text-mit-text">{t('intro')}</p>
      <ul className="mt-4 list-inside list-disc text-mit-text">
        <li>
          <Link className="text-mit-red hover:underline" href="/">
            {t('link_home')}
          </Link>
        </li>
        <li>
          <Link className="text-mit-red hover:underline" href="/events/">
            {t('link_events')}
          </Link>
        </li>
        <li>
          <Link className="text-mit-red hover:underline" href="/profile/">
            {t('link_profile')}
          </Link>
        </li>
      </ul>
    </div>
  );
}
