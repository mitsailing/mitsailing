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
  const rawCallbackUrl = searchParams.callbackUrl;
  const normalizedCallbackUrl = Array.isArray(rawCallbackUrl)
    ? rawCallbackUrl[0]
    : rawCallbackUrl;
  const callbackUrl = safeAuthCallbackUrl(
    normalizedCallbackUrl,
    getI18nPath('/', locale)
  );

  await requireCurrentUser(locale, callbackUrl);
  redirect(callbackUrl);
}
