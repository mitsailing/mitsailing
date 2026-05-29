'use client';

import { useTranslations } from 'next-intl';

type GymRateRow = {
  readonly category: string;
  readonly individual: string;
  readonly family: string;
  readonly note?: string;
};

export type IncludedClassRow = {
  readonly name: string;
  readonly fullSailing: boolean;
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
  {
    category: 'pricing_chart_gym_rate_mit_student',
    individual: 'pricing_chart_gym_individual_mit_student',
    family: 'pricing_chart_dash',
  },
  {
    category: 'pricing_chart_gym_rate_student_family',
    individual: 'pricing_chart_dash',
    family: 'pricing_chart_gym_family_student',
    note: 'pricing_chart_gym_student_family_note',
  },
  {
    category: 'pricing_chart_gym_rate_alumni',
    individual: 'pricing_chart_gym_individual_alumni',
    family: 'pricing_chart_gym_family_alumni',
  },
  {
    category: 'pricing_chart_gym_rate_public',
    individual: 'pricing_chart_gym_individual_public',
    family: 'pricing_chart_gym_family_public',
  },
  {
    category: 'pricing_chart_gym_rate_employee',
    individual: 'pricing_chart_gym_individual_employee',
    family: 'pricing_chart_gym_family_employee',
  },
  {
    category: 'pricing_chart_gym_rate_cross_registered',
    individual: 'pricing_chart_gym_individual_cross_registered',
    family: 'pricing_chart_gym_family_cross_registered',
  },
  {
    category: 'pricing_chart_gym_rate_pfizer',
    individual: 'pricing_chart_gym_individual_pfizer',
    family: 'pricing_chart_gym_family_pfizer',
  },
  {
    category: 'pricing_chart_gym_rate_novartis',
    individual: 'pricing_chart_gym_individual_novartis',
    family: 'pricing_chart_gym_family_novartis',
  },
  {
    category: 'pricing_chart_gym_rate_capital_one',
    individual: 'pricing_chart_gym_individual_capital_one',
    family: 'pricing_chart_gym_family_capital_one',
  },
  {
    category: 'pricing_chart_gym_rate_affiliate',
    individual: 'pricing_chart_gym_individual_affiliate',
    family: 'pricing_chart_gym_family_affiliate',
  },
] as const;

const includedClassRowKeys = [
  {
    name: 'pricing_chart_intro_sailing_101',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intro_experienced',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_learn_to_sail_intensive',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_windsurfing_fundamentals',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intermediate_boat_speed',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intermediate_crew',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intro_lynx',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_board_sailing_checkoffs',
    fullSailing: true,
    springRacing: false,
    fullYearRacing: false,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intro_to_racing',
    fullSailing: true,
    springRacing: true,
    fullYearRacing: true,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_intermediate_racing',
    fullSailing: true,
    springRacing: true,
    fullYearRacing: true,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_laser_checkoff',
    fullSailing: true,
    springRacing: true,
    fullYearRacing: true,
    thursdayTeamRacing: false,
  },
  {
    name: 'pricing_chart_420_checkoff',
    fullSailing: true,
    springRacing: true,
    fullYearRacing: true,
    thursdayTeamRacing: false,
  },
] as const;

export function useGymRateRows() {
  const t = useTranslations('PricingPage');

  return gymRateRowKeys.map((row) => ({
    category: t(row.category),
    individual: t(row.individual),
    family: t(row.family),
    note: 'note' in row ? t(row.note) : undefined,
  })) satisfies readonly GymRateRow[];
}

export function useIncludedClassRows() {
  const t = useTranslations('PricingPage');

  return includedClassRowKeys.map((row) => ({
    name: t(row.name),
    fullSailing: row.fullSailing,
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
