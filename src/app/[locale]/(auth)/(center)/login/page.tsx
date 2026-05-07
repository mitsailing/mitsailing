import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import {
  authHrefWithCallback,
  safeAuthCallbackUrl,
} from '@/libs/auth/callbackUrl';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';
import { SignInForm } from './SignInForm';

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    unlocked?: string;
    error?: string;
  }>;
};

export async function generateMetadata(
  props: SignInPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SignInPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignInPage(props: SignInPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const searchParams = await props.searchParams;
  const defaultCallback = getI18nPath('/', locale);
  const callbackUrl = safeAuthCallbackUrl(
    searchParams.callbackUrl,
    defaultCallback
  );

  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'SignInPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      {searchParams.error === 'unlock_invalid' ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {t('unlock_invalid_error')}
        </p>
      ) : null}
      {!searchParams.error && searchParams.unlocked ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('unlocked_banner')}
        </p>
      ) : null}

      <SignInForm callbackUrl={callbackUrl} />

      <p className="text-center text-sm text-mit-text">
        <I18nLink
          className={authInlineLinkClassName}
          href={authHrefWithCallback('/forgot-password', callbackUrl)}
        >
          {t('forgot_password')}
        </I18nLink>
      </p>

      <p className="text-center text-sm text-mit-text">
        {t('no_account')}{' '}
        <I18nLink
          className={authInlineLinkClassName}
          href={authHrefWithCallback('/signup', callbackUrl)}
        >
          {t('sign_up_link')}
        </I18nLink>
      </p>
    </>
  );
}
