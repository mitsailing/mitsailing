import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { redirectIfAuthenticated } from '@/libs/auth/dal';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';
import { ResetPasswordForm } from './ResetPasswordForm';

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
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
  await redirectIfAuthenticated(locale);

  const { token, error } = await props.searchParams;
  const t = await getTranslations({ locale, namespace: 'ResetPasswordPage' });
  const signInUrl = getI18nPath('/login', locale);

  const tokenMissing =
    !token || error === 'INVALID_TOKEN' || error === 'invalid_token';

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      {tokenMissing ? (
        <div className="space-y-4">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {t('invalid_token')}
          </p>
          <p className="text-center text-sm text-mit-text">
            <I18nLink
              className={authInlineLinkClassName}
              href="/forgot-password"
            >
              {t('request_new_link')}
            </I18nLink>
          </p>
        </div>
      ) : (
        <ResetPasswordForm signInUrl={signInUrl} token={token ?? ''} />
      )}
    </>
  );
}
