import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { Link as I18nLink } from '@/libs/I18nNavigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type UnlockAccountPageProps = {
  params: Promise<{ locale: string }>;
};

// Informational page surfaced by the account-locked email. Lockout is
// time-based (15-minute rolling window) so there is no explicit unlock
// action to perform; the page just points users back at sign-in.
export default async function UnlockAccountPage(props: UnlockAccountPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'UnlockAccountPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <p className="rounded-md bg-mit-red-highlight px-3 py-2 text-sm text-mit-text">
        {t('body')}
      </p>

      <p className="text-center text-sm text-mit-text">
        <I18nLink className={authInlineLinkClassName} href="/login">
          {t('back_sign_in')}
        </I18nLink>
      </p>
    </>
  );
}
