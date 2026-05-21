import { getTranslations } from 'next-intl/server';
import { getSession } from '@/libs/auth/dal';
import { StopImpersonationButton } from './StopImpersonationButton';

type ImpersonationBannerProps = {
  locale: string;
};

// Alerts admins when viewing the app as another user and exposes an exit
// control. Impersonation state lives on `session.impersonatedBy` per the
// Better Auth admin plugin.
export async function ImpersonationBanner(props: ImpersonationBannerProps) {
  const session = await getSession();

  if (!session?.session?.impersonatedBy) {
    return null;
  }

  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AccountLayout',
  });

  return (
    <section
      aria-labelledby="impersonation-banner-notice"
      aria-live="polite"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
    >
      <span id="impersonation-banner-notice">{t('impersonation_notice')}</span>{' '}
      <StopImpersonationButton
        errorLabel={t('impersonation_exit_error')}
        label={t('impersonation_exit')}
        locale={props.locale}
      />
    </section>
  );
}
