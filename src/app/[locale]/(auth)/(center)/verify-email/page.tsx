import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { Link as I18nLink } from '@/libs/I18nNavigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

// Landing page for email-verification callbacks. Better Auth handles the
// token via its own `/api/auth/verify-email` endpoint and redirects to the
// `callbackURL` we pass in — on the happy path that goes straight to
// `sign-in?verified=1`, on failure Better Auth appends `error=<code>`.
// This page exists as a fallback for older links and explicit error landings.
export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { error } = await props.searchParams;
  const t = await getTranslations({ locale, namespace: 'VerifyEmailPage' });

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <p
        className={
          error
            ? 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-800'
            : 'rounded-md bg-mit-red-highlight px-3 py-2 text-sm text-mit-text'
        }
      >
        {error ? t('error_body') : t('pending_body')}
      </p>

      <p className="text-sm text-mit-text">
        {t.rich('expiry_note', {
          support: (chunks) => (
            <a
              className={authInlineLinkClassName}
              href="mailto:support@mitsailing.com"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      <p className="text-center text-sm text-mit-text">
        <I18nLink className={authInlineLinkClassName} href="/login">
          {t('back_sign_in')}
        </I18nLink>
      </p>
    </>
  );
}
