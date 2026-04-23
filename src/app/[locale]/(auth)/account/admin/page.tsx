import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImpersonateButton } from '@/components/mit-sailing/account/ImpersonateButton';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AdminPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminPage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function AdminPage(props: AdminPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const currentUserId = session.user.id;
  const accountHref = getI18nPath('/account', locale);

  const t = await getTranslations({ locale, namespace: 'AdminPage' });

  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    select: { id: true, email: true, name: true, role: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('description')}</p>
      </div>

      <section aria-labelledby="users-heading">
        <h2 className="sr-only" id="users-heading">
          {t('users_heading')}
        </h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {users.map((user) => (
            <li
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
              key={user.id}
            >
              <div>
                <p className="font-medium text-slate-900">{user.email}</p>
                <p className="text-sm text-slate-600">
                  {user.name ?? '—'}
                  {' · '}
                  {user.role ?? t('role_user_default')}
                </p>
              </div>
              {user.id === currentUserId ? (
                <span className="text-xs text-slate-500">{t('you')}</span>
              ) : (
                <ImpersonateButton
                  redirectHref={accountHref}
                  userId={user.id}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
