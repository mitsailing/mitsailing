import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppThemeProvider } from '@/components/shell/AppThemeProvider';
import { SentryUserSync } from '@/components/shell/SentryUserSync';
import type { AppColorScheme } from '@/lib/mit-sailing/themePreference';
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

function themeBootScript(defaultTheme: AppColorScheme) {
  return `(() => {
  const theme = ${JSON.stringify(defaultTheme)};
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = resolved;
})();`;
}

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
    <html
      className={defaultTheme === 'dark' ? 'dark' : undefined}
      data-theme={defaultTheme}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <script id="theme-boot">{themeBootScript(defaultTheme)}</script>
      </head>
      <body>
        <SentryUserSync />
        <AppThemeProvider defaultTheme={defaultTheme}>
          <NextIntlClientProvider>{props.children}</NextIntlClientProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
