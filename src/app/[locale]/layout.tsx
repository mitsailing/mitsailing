import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/libs/I18nRouting';
import { AppConfig } from '@/utils/AppConfig';
import '@/styles/global.css';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mitsailing.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: AppConfig.name,
    template: `%s · ${AppConfig.name}`,
  },
  description: 'Pavilion and programs on the Charles.',
  openGraph: {
    type: 'website',
    siteName: AppConfig.name,
    url: SITE_URL,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Keeps `[locale]` on the server request path (`setRequestLocale`, next-intl) instead of stale
 * build-time locales. Narrower segments still use `revalidate` where safe (see fleet/classes pages).
 */
export const dynamic = 'force-dynamic';

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{props.children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
