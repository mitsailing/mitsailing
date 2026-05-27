import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';
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
  const callbackUrl = getI18nPath('/onboarding', locale);
  await redirectIfAuthenticated(locale, callbackUrl);

  const t = await getTranslations({ locale, namespace: 'SignUpPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <SignUpForm callbackUrl={callbackUrl} />

      <p className="text-center text-sm text-mit-text">
        {t('have_account')}{' '}
        <I18nLink
          className={authInlineLinkClassName}
          href={authHrefWithCallback('/login', callbackUrl)}
        >
          {t('sign_in_link')}
        </I18nLink>
      </p>
    </>
  );
}
