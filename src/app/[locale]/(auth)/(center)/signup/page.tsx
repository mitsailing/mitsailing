import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { SignUpForm } from './SignUpForm';

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: SignUpPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SignUpPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignUpPage(props: SignUpPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await redirectIfAuthenticated(locale);

  const t = await getTranslations({ locale, namespace: 'SignUpPage' });

  // Canonical post-verify URL embedded in the confirmation link. Better Auth
  // redirects to this on success (query string preserved) and appends
  // `&error=<code>` on failure, which the sign-in page renders as an error
  // banner.
  const verifyCallbackUrl = `${getBaseUrl()}${getI18nPath('/login?verified=1', locale)}`;

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <SignUpForm verifyCallbackUrl={verifyCallbackUrl} />

      <p className="text-center text-sm text-mit-text">
        {t('have_account')}{' '}
        <I18nLink className={authInlineLinkClassName} href="/login">
          {t('sign_in_link')}
        </I18nLink>
      </p>
    </>
  );
}
