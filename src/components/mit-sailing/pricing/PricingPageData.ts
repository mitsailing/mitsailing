'use client';

import { useTranslations } from 'next-intl';

export type IncludedClassRow = {
  readonly name: string;
  readonly normal: boolean;
  readonly fullYearRacing: boolean;
  readonly thursdayTeamRacing: boolean;
};

export type PricingPlan = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: string;
  readonly frequency: string;
  readonly features: readonly string[];
  readonly under30?: string;
  readonly over30?: string;
};

const normalOnlyClassNames = [
  'pricing_chart_intro_sailing_101',
  'pricing_chart_intro_experienced',
  'pricing_chart_learn_to_sail_intensive',
  'pricing_chart_windsurfing_fundamentals',
  'pricing_chart_intermediate_boat_speed',
  'pricing_chart_intermediate_crew',
  'pricing_chart_intro_lynx',
  'pricing_chart_board_sailing_checkoffs',
  'pricing_chart_laser_checkoff',
  'pricing_chart_420_checkoff',
] as const;

const racingClassNames = [
  'pricing_chart_intro_to_racing',
  'pricing_chart_intermediate_racing',
] as const;

export function useIncludedClassRows() {
  const t = useTranslations('PricingPage');
  const normalOnlyRows = normalOnlyClassNames.map((name) => ({
    fullYearRacing: false,
    name,
    normal: true,
    thursdayTeamRacing: false,
  }));
  const racingRows = racingClassNames.map((name) => ({
    fullYearRacing: true,
    name,
    normal: true,
    thursdayTeamRacing: false,
  }));

  return [...normalOnlyRows, ...racingRows].map((row) => ({
    name: t(row.name),
    normal: row.normal,
    fullYearRacing: row.fullYearRacing,
    thursdayTeamRacing: row.thursdayTeamRacing,
  })) satisfies readonly IncludedClassRow[];
}

export function usePricingPlans(rows: readonly IncludedClassRow[]) {
  const t = useTranslations('PricingPage');
  const racingFeatures = rows
    .filter((row) => row.fullYearRacing)
    .map((row) => row.name);

  return [
    {
      id: 'normal',
      name: t('plan_full_sailing'),
      description: t('full_sailing_body'),
      price: t('included_price'),
      frequency: t('full_sailing_frequency'),
      features: rows.map((row) => row.name),
    },
    {
      id: 'full-year-racing-card',
      name: t('plan_pavilion_racing_full_year'),
      description: t('pavilion_racing_full_year_body'),
      price: t('paid_table_pavilion_july_15_later_student'),
      frequency: t('paid_table_non_mit_student'),
      features: racingFeatures,
      under30: t('paid_table_pavilion_july_15_later_under_30'),
      over30: t('paid_table_pavilion_july_15_later_30_plus'),
    },
    {
      id: 'thursday-team-racing',
      name: t('plan_thursday_team_racing'),
      description: t('thursday_team_racing_body'),
      price: t('thursday_team_racing_student_price'),
      frequency: t('paid_table_non_mit_student'),
      features: [
        t('thursday_team_racing_feature_series'),
        t('thursday_team_racing_feature_separate'),
      ],
      under30: t('thursday_team_racing_under_30_price'),
      over30: t('thursday_team_racing_30_plus_price'),
    },
  ] satisfies readonly PricingPlan[];
}
