import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminSailingCardPrintLauncher } from '@/components/mit-sailing/admin/cards/AdminSailingCardPrintLauncher';
import type { SailingCardPrintMode } from '@/components/mit-sailing/admin/cards/AdminSailingCardPrintLauncher';

type SailingCardPrintPageProps = {
  readonly id: string;
  readonly locale: string;
  readonly mode: SailingCardPrintMode;
};

export async function SailingCardPrintPage(props: SailingCardPrintPageProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminCards',
  });

  return (
    <AdminSailingCardPrintLauncher
      failureLabel={t('print_launcher_failed')}
      frameTitle={t('print_launcher_frame_title')}
      loadingLabel={
        props.mode === 'quick'
          ? t('quick_print_launcher_loading')
          : t('print_card_launcher_loading')
      }
      mode={props.mode}
      pdfHref={`/api/admin/users/${encodeURIComponent(props.id)}/sailing-card/pdf`}
      readyLabel={
        props.mode === 'quick'
          ? t('quick_print_launcher_ready')
          : t('print_card_launcher_ready')
      }
      targetUserId={props.id}
    />
  );
}
