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
import { ForgotPasswordForm } from './ForgotPasswordForm';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; email?: string }>;
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
  const searchParams = await props.searchParams;
  const callbackUrl = safeAuthCallbackUrl(
    searchParams.callbackUrl,
    getI18nPath('/', locale)
  );
  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'ForgotPasswordPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <ForgotPasswordForm
        callbackUrl={callbackUrl}
        initialEmail={searchParams.email ?? ''}
      />

      <p className="text-center text-sm text-mit-text">
        <I18nLink
          className={authInlineLinkClassName}
          href={authHrefWithCallback('/login', callbackUrl)}
        >
          {t('back_sign_in')}
        </I18nLink>
      </p>
    </>
  );
}
