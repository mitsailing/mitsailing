import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HoursPageView } from '@/components/mit-sailing/hours/HoursPageView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

type HoursPageProps = {
  params: Promise<{ locale: string }>;
};

const NOON_DAYS = [
  'day_tuesday',
  'day_wednesday',
  'day_thursday',
  'day_friday',
  'day_saturday',
  'day_sunday',
] as const;

export async function generateMetadata(
  props: HoursPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'HoursPage',
  });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function HoursPage(props: HoursPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'HoursPage',
  });

  return (
    <SiteSectionShell locale={locale} segments={[{ label: t('crumb') }]}>
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <HoursPageView
          note={t('note')}
          rows={[
            { day: t('day_monday'), hours: t('hours_monday') },
            ...NOON_DAYS.map((dayKey) => ({
              day: t(dayKey),
              hours: t('hours_noon'),
            })),
          ]}
          scheduleLabel={t('schedule_label')}
          season={t('season')}
          title={t('title')}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
