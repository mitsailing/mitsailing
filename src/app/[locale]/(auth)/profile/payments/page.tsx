import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfilePaymentsView } from '@/components/auth/profile/ProfilePaymentsView';
import { requireCurrentUser } from '@/libs/auth/dal';
import { listUserEventPayments } from '@/libs/mit-sailing/userPaymentQueries';
import { getI18nPath } from '@/utils/Helpers';

type ProfilePaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfilePaymentsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  return {
    description: t('payments_meta_description'),
    title: t('payments_meta_title'),
  };
}

export default async function ProfilePaymentsPage(
  props: ProfilePaymentsPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(
    locale,
    getI18nPath('/profile/payments', locale)
  );
  const [payments, t] = await Promise.all([
    listUserEventPayments(user.id),
    getTranslations({ locale, namespace: 'UserProfilePage' }),
  ]);

  return <ProfilePaymentsView locale={locale} payments={payments} t={t} />;
}
