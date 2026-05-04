import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppThemeProvider } from '@/components/shell/AppThemeProvider';
import { SentryUserSync } from '@/components/shell/SentryUserSync';
import { Env } from '@/libs/Env';
import { routing } from '@/libs/I18nRouting';
import { getDefaultThemeForRootLayout } from '@/libs/theme-layout';
import { AppConfig } from '@/utils/AppConfig';
import '@/styles/global.css';

const SITE_URL = Env.NEXT_PUBLIC_APP_URL;

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

/** next-intl: per-request locale; do not use static build-time locale list. */
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

  const defaultTheme = await getDefaultThemeForRootLayout();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <SentryUserSync />
        <AppThemeProvider defaultTheme={defaultTheme}>
          <NextIntlClientProvider>{props.children}</NextIntlClientProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
