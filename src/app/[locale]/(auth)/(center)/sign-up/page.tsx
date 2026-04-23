import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  const verifyCallbackUrl = `${getBaseUrl()}${getI18nPath('/sign-in?verified=1', locale)}`;

  return (
    <div className="w-full max-w-md space-y-6 px-4">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <SignUpForm verifyCallbackUrl={verifyCallbackUrl} />

      <p className="text-center text-sm text-gray-600">
        {t('have_account')}{' '}
        <I18nLink className="text-blue-700 underline" href="/sign-in">
          {t('sign_in_link')}
        </I18nLink>
      </p>
    </div>
  );
}
