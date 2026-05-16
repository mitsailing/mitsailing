import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PavilionReservationWizard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationWizard';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { submitPavilionReservationRequestAction } from '@/libs/mit-sailing/pavilionReservationActions';
import {
  listPavilionReservationBlockedRanges,
  listVisiblePavilionReservableItems,
} from '@/libs/mit-sailing/pavilionReservationQueries';
import { initialPavilionReservationSubmitState } from '@/libs/mit-sailing/pavilionReservationState';
import { getI18nPath } from '@/utils/Helpers';

type ReservePavilionPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ReservePavilionPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'PavilionReservationPage',
  });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ReservePavilionPage(
  props: ReservePavilionPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [items, blockedRanges, t] = await Promise.all([
    listVisiblePavilionReservableItems(),
    listPavilionReservationBlockedRanges(),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
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
          permalink={getI18nPath('/reserve-pavilion', locale)}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
