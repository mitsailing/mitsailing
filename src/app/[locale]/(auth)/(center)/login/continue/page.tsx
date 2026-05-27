import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { requireCurrentUser } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';

type SignInContinuePageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}>;

export default async function SignInContinuePage(
  props: SignInContinuePageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const searchParams = await props.searchParams;
  const callbackUrl = safeAuthCallbackUrl(
    searchParams.callbackUrl,
    getI18nPath('/', locale)
  );

  await requireCurrentUser(locale, callbackUrl);
  redirect(callbackUrl);
}
