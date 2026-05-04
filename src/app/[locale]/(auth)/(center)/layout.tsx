import { setRequestLocale } from 'next-intl/server';
import { AuthCenterBrandMark } from '@/components/mit-sailing/site/AuthCenterBrandMark';

export default async function CenteredLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-background font-mit-sans text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <main className="w-full max-w-md space-y-6 px-4">
          <AuthCenterBrandMark />
          {props.children}
        </main>
      </div>
    </div>
  );
}
