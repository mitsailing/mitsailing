import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PavilionReservationWizard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationWizard';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { submitPavilionReservationRequestAction } from '@/libs/mit-sailing/pavilionReservationActions';
import { upsertPavilionReservationDraftAction } from '@/libs/mit-sailing/pavilionReservationDraftActions';
import { findPavilionReservationDraftByResumeToken } from '@/libs/mit-sailing/pavilionReservationDraftQueries';
import {
  listPavilionReservationBlockedRanges,
  listVisiblePavilionReservableItems,
} from '@/libs/mit-sailing/pavilionReservationQueries';
import { initialPavilionReservationSubmitState } from '@/libs/mit-sailing/pavilionReservationState';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ resume?: string | string[] }>;
};

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
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

export default async function ReservePage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const searchParams = await props.searchParams;
  const resumeToken = firstSearchParam(searchParams.resume);
  const [items, blockedRanges, t, resumeSeed] = await Promise.all([
    listVisiblePavilionReservableItems(),
    listPavilionReservationBlockedRanges(),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
    resumeToken
      ? findPavilionReservationDraftByResumeToken(resumeToken)
      : Promise.resolve(null),
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
          serverResume={
            resumeSeed
              ? {
                  draft: resumeSeed.draft,
                  requestId: resumeSeed.requestId,
                  resumeToken: resumeSeed.resumeToken,
                }
              : null
          }
          upsertDraft={upsertPavilionReservationDraftAction}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
