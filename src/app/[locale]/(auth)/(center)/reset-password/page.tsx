import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { ResetPasswordForm } from './ResetPasswordForm';

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
    codeSent?: string;
  }>;
};

export async function generateMetadata(
  props: ResetPasswordPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'ResetPasswordPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const searchParams = await props.searchParams;
  const callbackUrl = safeAuthCallbackUrl(
    searchParams.callbackUrl,
    getI18nPath('/', locale)
  );
  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'ResetPasswordPage' });

  return (
    <ResetPasswordForm
      callbackUrl={callbackUrl}
      initialEmail={searchParams.email ?? ''}
      initialResendLocked={searchParams.codeSent === '1'}
      passwordHeading={t('password_heading')}
    />
  );
}
