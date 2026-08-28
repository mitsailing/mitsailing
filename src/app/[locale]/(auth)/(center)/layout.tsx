import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCenterBrandMark } from '@/components/mit-sailing/site/AuthCenterBrandMark';
import { SitePreviewBanner } from '@/components/mit-sailing/site/SitePreviewBanner';

export default async function CenteredLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-background font-mit-sans text-foreground">
      <Suspense fallback={null}>
        <SitePreviewBanner />
      </Suspense>
      <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:justify-center">
        <main className="w-full max-w-xl space-y-6 px-4">
          <AuthCenterBrandMark />
          {props.children}
        </main>
      </div>
    </div>
  );
}
