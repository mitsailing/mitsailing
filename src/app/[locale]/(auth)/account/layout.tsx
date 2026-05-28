import { setRequestLocale } from 'next-intl/server';
import { AuthenticatedAccountChrome } from '@/components/auth/AuthenticatedAccountChrome';
import { getI18nPath } from '@/utils/Helpers';

export default async function AccountLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const accountHref = getI18nPath('/account/', locale);

  return (
    <AuthenticatedAccountChrome locale={locale} loginCallbackUrl={accountHref}>
      {props.children}
    </AuthenticatedAccountChrome>
  );
}
