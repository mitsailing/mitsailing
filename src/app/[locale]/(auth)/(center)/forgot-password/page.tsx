import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ForgotPasswordPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'ForgotPasswordPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ForgotPasswordPage(
  props: ForgotPasswordPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await redirectIfAuthenticated(locale);

  const t = await getTranslations({ locale, namespace: 'ForgotPasswordPage' });
  const resetRedirectUrl = `${getBaseUrl()}${getI18nPath('/reset-password', locale)}`;

  return (
    <div className="w-full max-w-md space-y-6 px-4">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <ForgotPasswordForm resetRedirectUrl={resetRedirectUrl} />

      <p className="text-center text-sm text-gray-600">
        <I18nLink className="text-blue-700 underline" href="/sign-in">
          {t('back_sign_in')}
        </I18nLink>
      </p>
    </div>
  );
}
