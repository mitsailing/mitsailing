import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PavilionReservationWizard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationWizard';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { submitPavilionReservationRequestAction } from '@/libs/mit-sailing/pavilionReservationActions';
import {
  listPavilionReservationBlockedRanges,
  listVisiblePavilionReservableItems,
} from '@/libs/mit-sailing/pavilionReservationQueries';
import { initialPavilionReservationSubmitState } from '@/libs/mit-sailing/pavilionReservationState';
import { AppConfig } from '@/utils/AppConfig';

const locale = AppConfig.i18n.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PavilionReservationPage');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ReservePage() {
  const [items, blockedRanges, t] = await Promise.all([
    listVisiblePavilionReservableItems(),
    listPavilionReservationBlockedRanges(),
    getTranslations('MitSailingRoutes'),
  ]);
  const action = submitPavilionReservationRequestAction.bind(null, locale);

  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_reserve_pavilion') }]}
    >
      <SiteSectionMain maxWidth="7xl" variant="catalog">
        <PavilionReservationWizard
          action={action}
          blockedRanges={blockedRanges}
          initialState={initialPavilionReservationSubmitState}
          items={items}
          permalink="/reserve"
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
