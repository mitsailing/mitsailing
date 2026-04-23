import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
    <div className="w-full max-w-md space-y-6 px-4">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('heading')}
      </h1>

      <p
        className={
          error
            ? 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-800'
            : 'rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800'
        }
      >
        {error ? t('error_body') : t('pending_body')}
      </p>

      <p className="text-sm text-gray-600">
        {t.rich('expiry_note', {
          support: (chunks) => (
            <a
              className="text-blue-700 underline"
              href="mailto:support@mitsailing.com"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      <p className="text-center text-sm text-gray-600">
        <I18nLink className="text-blue-700 underline" href="/sign-in">
          {t('back_sign_in')}
        </I18nLink>
      </p>
    </div>
  );
}
