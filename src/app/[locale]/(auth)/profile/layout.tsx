import { setRequestLocale } from 'next-intl/server';
import { ProfileSettingsChrome } from '@/components/auth/profile/ProfileSettingsChrome';
import { getI18nPath } from '@/utils/Helpers';

export default async function ProfileLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const profileResumeHref = getI18nPath('/profile', locale);

  return (
    <ProfileSettingsChrome locale={locale} loginCallbackUrl={profileResumeHref}>
      {props.children}
    </ProfileSettingsChrome>
  );
}
