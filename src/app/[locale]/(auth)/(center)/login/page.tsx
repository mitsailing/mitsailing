import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { SignInForm } from './SignInForm';

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    verified?: string;
    reset?: string;
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
  const callbackUrl = searchParams.callbackUrl?.startsWith('/')
    ? searchParams.callbackUrl
    : defaultCallback;

  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'SignInPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      {searchParams.error ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {searchParams.error === 'unlock_invalid'
            ? t('unlock_invalid_error')
            : t('verification_error')}
        </p>
      ) : null}
      {!searchParams.error && searchParams.verified ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('verified_banner')}
        </p>
      ) : null}
      {!searchParams.error && searchParams.reset ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('reset_banner')}
        </p>
      ) : null}
      {!searchParams.error && searchParams.unlocked ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('unlocked_banner')}
        </p>
      ) : null}

      <SignInForm
        callbackUrl={callbackUrl}
        verifyCallbackUrl={`${getBaseUrl()}${getI18nPath('/login?verified=1', locale)}`}
      />

      <p className="text-center text-sm text-mit-text">
        <I18nLink className={authInlineLinkClassName} href="/forgot-password">
          {t('forgot_password')}
        </I18nLink>
      </p>

      <p className="text-center text-sm text-mit-text">
        {t('no_account')}{' '}
        <I18nLink className={authInlineLinkClassName} href="/signup">
          {t('sign_up_link')}
        </I18nLink>
      </p>
    </>
  );
}
