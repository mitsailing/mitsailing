'use client';

import { useTranslations } from 'next-intl';

export type GymRateRow = {
  readonly category: string;
  readonly individual: string;
  readonly family: string;
  readonly note?: string;
};

export type IncludedClassRow = {
  readonly name: string;
  readonly normal: boolean;
  readonly springRacing: boolean;
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

const gymRateRowKeys = [
  [
    'pricing_chart_gym_rate_mit_student',
    'pricing_chart_gym_individual_mit_student',
    'pricing_chart_dash',
  ],
  [
    'pricing_chart_gym_rate_student_family',
    'pricing_chart_dash',
    'pricing_chart_gym_family_student',
    'pricing_chart_gym_student_family_note',
  ],
  [
    'pricing_chart_gym_rate_alumni',
    'pricing_chart_gym_individual_alumni',
    'pricing_chart_gym_family_alumni',
  ],
  [
    'pricing_chart_gym_rate_public',
    'pricing_chart_gym_individual_public',
    'pricing_chart_gym_family_public',
  ],
  [
    'pricing_chart_gym_rate_employee',
    'pricing_chart_gym_individual_employee',
    'pricing_chart_gym_family_employee',
  ],
  [
    'pricing_chart_gym_rate_cross_registered',
    'pricing_chart_gym_individual_cross_registered',
    'pricing_chart_gym_family_cross_registered',
  ],
  [
    'pricing_chart_gym_rate_pfizer',
    'pricing_chart_gym_individual_pfizer',
    'pricing_chart_gym_family_pfizer',
  ],
  [
    'pricing_chart_gym_rate_novartis',
    'pricing_chart_gym_individual_novartis',
    'pricing_chart_gym_family_novartis',
  ],
  [
    'pricing_chart_gym_rate_capital_one',
    'pricing_chart_gym_individual_capital_one',
    'pricing_chart_gym_family_capital_one',
  ],
  [
    'pricing_chart_gym_rate_affiliate',
    'pricing_chart_gym_individual_affiliate',
    'pricing_chart_gym_family_affiliate',
  ],
] as const;

const normalOnlyClassNames = [
  'pricing_chart_intro_sailing_101',
  'pricing_chart_intro_experienced',
  'pricing_chart_learn_to_sail_intensive',
  'pricing_chart_windsurfing_fundamentals',
  'pricing_chart_intermediate_boat_speed',
  'pricing_chart_intermediate_crew',
  'pricing_chart_intro_lynx',
  'pricing_chart_board_sailing_checkoffs',
] as const;

const racingClassNames = [
  'pricing_chart_intro_to_racing',
  'pricing_chart_intermediate_racing',
  'pricing_chart_laser_checkoff',
  'pricing_chart_420_checkoff',
] as const;

export function useGymRateRows() {
  const t = useTranslations('PricingPage');

  return gymRateRowKeys.map(([category, individual, family, note]) => ({
    category: t(category),
    individual: t(individual),
    family: t(family),
    note: note ? t(note) : undefined,
  })) satisfies readonly GymRateRow[];
}

export function useIncludedClassRows() {
  const t = useTranslations('PricingPage');
  const normalOnlyRows = normalOnlyClassNames.map((name) => ({
    fullYearRacing: false,
    name,
    normal: true,
    springRacing: false,
    thursdayTeamRacing: false,
  }));
  const racingRows = racingClassNames.map((name) => ({
    fullYearRacing: true,
    name,
    normal: true,
    springRacing: true,
    thursdayTeamRacing: false,
  }));

  return [...normalOnlyRows, ...racingRows].map((row) => ({
    name: t(row.name),
    normal: row.normal,
    springRacing: row.springRacing,
    fullYearRacing: row.fullYearRacing,
    thursdayTeamRacing: row.thursdayTeamRacing,
  })) satisfies readonly IncludedClassRow[];
}

export function usePricingPlans(rows: readonly IncludedClassRow[]) {
  const t = useTranslations('PricingPage');
  const racingFeatures = rows
    .filter((row) => row.springRacing)
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
      id: 'spring-racing-card',
      name: t('plan_pavilion_racing_spring'),
      description: t('pavilion_racing_spring_body'),
      price: t('paid_table_pavilion_before_july_15_student'),
      frequency: t('paid_table_non_mit_student'),
      features: racingFeatures,
      under30: t('paid_table_pavilion_before_july_15_under_30'),
      over30: t('paid_table_pavilion_before_july_15_30_plus'),
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
