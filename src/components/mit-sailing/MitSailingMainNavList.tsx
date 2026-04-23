import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

const LINK_CLASS = 'text-slate-800 hover:underline';

type MitSailingMainNavListProps = { locale: string };

/**
 * Primary site nav shared by marketing and account layouts.
 *
 * @param props - Props
 * @param props.locale - Active UI locale
 * @returns List items for the main nav column
 */
export async function MitSailingMainNavList(props: MitSailingMainNavListProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'RootLayout',
  });
  return (
    <>
      <li>
        <Link className={LINK_CLASS} href="/">
          {t('home_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/about/">
          {t('about_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/events/">
          {t('events_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/classes/">
          {t('classes_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/fleet/">
          {t('fleet_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/contact/">
          {t('contact_link')}
        </Link>
      </li>
    </>
  );
}
