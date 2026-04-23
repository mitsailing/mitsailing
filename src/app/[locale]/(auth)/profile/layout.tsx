import { setRequestLocale } from 'next-intl/server';
import { AuthenticatedAccountChrome } from '@/components/auth/AuthenticatedAccountChrome';
import { getI18nPath } from '@/utils/Helpers';

export default async function ProfileLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const profileHref = getI18nPath('/profile/', locale);

  return (
    <AuthenticatedAccountChrome locale={locale} loginCallbackUrl={profileHref}>
      {props.children}
    </AuthenticatedAccountChrome>
  );
}
