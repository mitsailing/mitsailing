import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { CheckEmailNotice } from './CheckEmailNotice';

type CheckEmailPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string | string[];
    email?: string | string[];
  }>;
};

export async function generateMetadata(
  props: CheckEmailPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'CheckEmailPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function CheckEmailPage(props: CheckEmailPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const searchParams = await props.searchParams;
  const rawCallbackUrl = searchParams.callbackUrl;
  const rawEmail = searchParams.email;
  const normalizedCallbackUrl =
    typeof rawCallbackUrl === 'string' ? rawCallbackUrl : rawCallbackUrl?.[0];
  const email = typeof rawEmail === 'string' ? rawEmail : (rawEmail?.[0] ?? '');
  const callbackUrl = safeAuthCallbackUrl(
    normalizedCallbackUrl,
    getI18nPath('/onboarding', locale)
  );
  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'CheckEmailPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <CheckEmailNotice callbackUrl={callbackUrl} email={email} />
    </>
  );
}
