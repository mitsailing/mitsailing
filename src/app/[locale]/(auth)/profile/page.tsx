import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getI18nPath } from '@/utils/Helpers';

export default async function ProfileIndexPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  redirect(getI18nPath('/profile/account', locale));
}
