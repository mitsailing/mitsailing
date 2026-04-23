import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SignOutForm } from '@/components/auth/SignOutForm';
import { getCurrentUser } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';

const LINK_CLASS = 'text-slate-800 hover:underline';

type MarketingAuthNavProps = { locale: string };

/**
 * Sign in / sign up for guests, or account + sign out for signed-in users.
 *
 * @param props - Props
 * @param props.locale - Active UI locale
 * @returns List items for the utility nav column
 */
export async function MarketingAuthNav(props: MarketingAuthNavProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'RootLayout',
  });
  const user = await getCurrentUser();
  if (user) {
    return (
      <>
        <li>
          <Link className={LINK_CLASS} href="/account/">
            {t('account_link')}
          </Link>
        </li>
        <li>
          <SignOutForm label={t('sign_out_action')} locale={props.locale} />
        </li>
      </>
    );
  }
  return (
    <>
      <li>
        <Link className={LINK_CLASS} href="/sign-in/">
          {t('sign_in_link')}
        </Link>
      </li>
      <li>
        <Link className={LINK_CLASS} href="/sign-up/">
          {t('sign_up_link')}
        </Link>
      </li>
    </>
  );
}
