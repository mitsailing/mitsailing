import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { VerifyEmailForm } from './VerifyEmailForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; email?: string }>;
};

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const searchParams = await props.searchParams;
  const callbackUrl = safeAuthCallbackUrl(
    searchParams.callbackUrl,
    getI18nPath('/', locale)
  );
  await redirectIfAuthenticated(locale, callbackUrl);

  return (
    <VerifyEmailForm
      callbackUrl={callbackUrl}
      initialEmail={searchParams.email ?? ''}
    />
  );
}
