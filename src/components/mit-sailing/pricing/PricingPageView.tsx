'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SiteModalContent } from '@/components/mit-sailing/site/SiteModal';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { mitRecreationMembershipHref } from '@/data/mit-sailing/mitRecreationMembership';
import { Link } from '@/libs/I18nNavigation';

type PricingPageViewProps = {
  readonly isSignedIn: boolean;
};

type GymRateRow = {
  readonly category: string;
  readonly individual: string;
  readonly family: string;
  readonly note?: string;
};

type IncludedClassRow = {
  readonly name: string;
  readonly fullSailing: boolean;
  readonly springRacing: boolean;
  readonly fullYearRacing: boolean;
  readonly thursdayTeamRacing: boolean;
};

type PricingCta = {
  readonly href: string;
  readonly label: string;
};

type PricingPlan = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: string;
  readonly frequency: string;
  readonly features: readonly string[];
  readonly under30?: string;
  readonly over30?: string;
};

function pricingPrimaryCta(props: PricingPageViewProps) {
  if (props.isSignedIn) {
    return {
      href: '/onboarding',
      labelKey: 'cta_start_sailing_card',
    } as const;
  }

  return {
    href: '/signup?callbackUrl=%2Fonboarding',
    labelKey: 'cta_create_account',
  } as const;
}

function useGymRateRows() {
  const t = useTranslations('PricingPage');

  return [
    {
      category: t('pricing_chart_gym_rate_mit_student'),
      individual: t('pricing_chart_gym_individual_mit_student'),
      family: t('pricing_chart_dash'),
    },
    {
      category: t('pricing_chart_gym_rate_student_family'),
      individual: t('pricing_chart_dash'),
      family: t('pricing_chart_gym_family_student'),
      note: t('pricing_chart_gym_student_family_note'),
    },
    {
      category: t('pricing_chart_gym_rate_alumni'),
      individual: t('pricing_chart_gym_individual_alumni'),
      family: t('pricing_chart_gym_family_alumni'),
    },
    {
      category: t('pricing_chart_gym_rate_public'),
      individual: t('pricing_chart_gym_individual_public'),
      family: t('pricing_chart_gym_family_public'),
    },
    {
      category: t('pricing_chart_gym_rate_employee'),
      individual: t('pricing_chart_gym_individual_employee'),
      family: t('pricing_chart_gym_family_employee'),
    },
    {
      category: t('pricing_chart_gym_rate_cross_registered'),
      individual: t('pricing_chart_gym_individual_cross_registered'),
      family: t('pricing_chart_gym_family_cross_registered'),
    },
    {
      category: t('pricing_chart_gym_rate_pfizer'),
      individual: t('pricing_chart_gym_individual_pfizer'),
      family: t('pricing_chart_gym_family_pfizer'),
    },
    {
      category: t('pricing_chart_gym_rate_novartis'),
      individual: t('pricing_chart_gym_individual_novartis'),
      family: t('pricing_chart_gym_family_novartis'),
    },
    {
      category: t('pricing_chart_gym_rate_capital_one'),
      individual: t('pricing_chart_gym_individual_capital_one'),
      family: t('pricing_chart_gym_family_capital_one'),
    },
    {
      category: t('pricing_chart_gym_rate_affiliate'),
      individual: t('pricing_chart_gym_individual_affiliate'),
      family: t('pricing_chart_gym_family_affiliate'),
    },
  ] satisfies readonly GymRateRow[];
}

function useIncludedClassRows() {
  const t = useTranslations('PricingPage');

  return [
    {
      name: t('pricing_chart_intro_sailing_101'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intro_experienced'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_learn_to_sail_intensive'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_windsurfing_fundamentals'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intermediate_boat_speed'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intermediate_crew'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intro_lynx'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_board_sailing_checkoffs'),
      fullSailing: true,
      springRacing: false,
      fullYearRacing: false,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intro_to_racing'),
      fullSailing: true,
      springRacing: true,
      fullYearRacing: true,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_intermediate_racing'),
      fullSailing: true,
      springRacing: true,
      fullYearRacing: true,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_laser_checkoff'),
      fullSailing: true,
      springRacing: true,
      fullYearRacing: true,
      thursdayTeamRacing: false,
    },
    {
      name: t('pricing_chart_420_checkoff'),
      fullSailing: true,
      springRacing: true,
      fullYearRacing: true,
      thursdayTeamRacing: false,
    },
  ] satisfies readonly IncludedClassRow[];
}

function usePricingPlans(rows: readonly IncludedClassRow[]) {
  const t = useTranslations('PricingPage');
  const racingFeatures = rows
    .filter((row) => row.springRacing)
    .map((row) => row.name);

  return [
    {
      id: 'full-sailing',
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

function GymRatesDialog() {
  const t = useTranslations('PricingPage');
  const gymRateRows = useGymRateRows();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="text-sm leading-6 font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none"
          type="button"
        >
          {t('pricing_chart_gym_membership_summary')}
        </button>
      </DialogTrigger>
      <SiteModalContent
        className="sm:max-w-4xl"
        closeLabel={t('pricing_chart_gym_modal_close')}
        eyebrow={t('pricing_chart_gym_modal_eyebrow')}
        title={t('pricing_chart_gym_modal_title')}
      >
        <div className="hidden overflow-hidden rounded-lg border border-mit-line bg-background md:block">
          <table
            aria-label={t('pricing_chart_gym_rates_table_label')}
            className="w-full table-fixed border-collapse text-left text-sm"
          >
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="border-b border-mit-line bg-muted/55 text-mit-text">
              <tr>
                <th className="py-2.5 pr-3 pl-4 font-medium" scope="col">
                  {t('pricing_chart_gym_category_heading')}
                </th>
                <th
                  className="px-3 py-2.5 font-medium whitespace-nowrap tabular-nums"
                  scope="col"
                >
                  {t('pricing_chart_gym_individual_heading')}
                </th>
                <th
                  className="py-2.5 pr-4 pl-3 font-medium whitespace-nowrap tabular-nums"
                  scope="col"
                >
                  {t('pricing_chart_gym_family_heading')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mit-line">
              {gymRateRows.map((row) => (
                <tr key={row.category}>
                  <th
                    className="py-2.5 pr-3 pl-4 font-medium text-mit-text"
                    scope="row"
                  >
                    <span>{row.category}</span>
                    {row.note ? (
                      <span className="mt-1 block text-xs leading-5 font-normal text-muted-foreground">
                        {row.note}
                      </span>
                    ) : null}
                  </th>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums dark:text-foreground">
                    {row.individual}
                  </td>
                  <td className="py-2.5 pr-4 pl-3 whitespace-nowrap text-muted-foreground tabular-nums dark:text-foreground">
                    {row.family}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          {gymRateRows.map((row) => (
            <section
              className="rounded-lg border border-mit-line bg-background p-4"
              key={row.category}
            >
              <h3 className="font-medium text-mit-text">{row.category}</h3>
              {row.note ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {row.note}
                </p>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-medium text-mit-text">
                    {t('pricing_chart_gym_individual_heading')}
                  </dt>
                  <dd className="mt-1 text-muted-foreground tabular-nums dark:text-foreground">
                    {row.individual}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-mit-text">
                    {t('pricing_chart_gym_family_heading')}
                  </dt>
                  <dd className="mt-1 text-muted-foreground tabular-nums dark:text-foreground">
                    {row.family}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
        <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <a
            className="font-medium text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none"
            href={mitRecreationMembershipHref}
            rel="noreferrer"
            target="_blank"
          >
            {t('pricing_chart_gym_rates_disclaimer')}
          </a>
        </div>
      </SiteModalContent>
    </Dialog>
  );
}

function IncludedMark() {
  const t = useTranslations('PricingPage');

  return (
    <span className="inline-flex items-center text-mit-red dark:text-mit-red-ink">
      <Check aria-hidden className="size-4" />
      <span className="sr-only">{t('pricing_chart_included_mark')}</span>
    </span>
  );
}

function PaidPriceLines(props: {
  readonly studentPrice: string;
  readonly under30: string;
  readonly over30: string;
}) {
  const t = useTranslations('PricingPage');

  return (
    <dl className="grid gap-2 text-sm leading-5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">
          {t('paid_table_non_mit_student')}
        </dt>
        <dd className="font-semibold text-mit-text tabular-nums">
          {props.studentPrice}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">{t('paid_table_under_30')}</dt>
        <dd className="font-semibold text-mit-text tabular-nums">
          {props.under30}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">{t('paid_table_30_plus')}</dt>
        <dd className="font-semibold text-mit-text tabular-nums">
          {props.over30}
        </dd>
      </div>
    </dl>
  );
}

function IncludedPriceLines() {
  const t = useTranslations('PricingPage');

  return (
    <dl className="grid gap-2 text-sm leading-5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">
          {t('full_sailing_mit_student_label')}
        </dt>
        <dd className="font-semibold text-mit-text">{t('included_price')}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">
          {t('full_sailing_mit_gym_member_label')}
        </dt>
        <dd className="font-semibold text-mit-text">{t('included_price')}</dd>
      </div>
    </dl>
  );
}

function PricingPlanPrice(props: { readonly plan: PricingPlan }) {
  if (props.plan.under30 && props.plan.over30) {
    return (
      <PaidPriceLines
        over30={props.plan.over30}
        studentPrice={props.plan.price}
        under30={props.plan.under30}
      />
    );
  }

  if (props.plan.id === 'full-sailing') {
    return (
      <>
        <IncludedPriceLines />
        <div className="mt-3">
          <GymRatesDialog />
        </div>
      </>
    );
  }

  return (
    <>
      <p className="flex items-baseline gap-x-1">
        <span className="text-2xl font-semibold tracking-normal text-mit-text xl:text-3xl">
          {props.plan.price}
        </span>
      </p>
      <p className="mt-2 text-sm leading-6 font-normal text-muted-foreground">
        {props.plan.frequency}
      </p>
    </>
  );
}

function PricingPlanCta(props: {
  readonly cta: PricingCta;
  readonly describedBy: string;
}) {
  return (
    <Link
      aria-describedby={props.describedBy}
      className="mt-5 block w-full rounded-md px-3 py-2 text-center text-sm/6 font-semibold text-primary-ink ring-1 ring-mit-line ring-inset hover:bg-muted/60 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red"
      href={props.cta.href}
    >
      {props.cta.label}
    </Link>
  );
}

function PricingPlanSummary(props: {
  readonly cta: PricingCta;
  readonly plan: PricingPlan;
  readonly idSuffix: string;
}) {
  const planId = `pricing-plan-${props.idSuffix}-${props.plan.id}`;

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <h3
          className="text-base leading-7 font-semibold text-mit-text"
          id={planId}
        >
          {props.plan.name}
        </h3>
        <p className="mt-3 text-sm leading-6 font-normal text-muted-foreground">
          {props.plan.description}
        </p>
      </div>
      <div className="mt-auto">
        <PricingPlanPrice plan={props.plan} />
        <PricingPlanCta cta={props.cta} describedBy={planId} />
      </div>
    </div>
  );
}

function PricingFeatureList(props: { readonly features: readonly string[] }) {
  return (
    <ul className="mt-8 space-y-3 text-sm leading-6 text-muted-foreground">
      {props.features.map((feature) => (
        <li className="flex gap-x-3" key={feature}>
          <Check
            aria-hidden
            className="mt-0.5 h-5 w-5 flex-none text-mit-red dark:text-mit-red-ink"
          />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingPlanCardsMobile(props: {
  readonly cta: PricingCta;
  readonly plans: readonly PricingPlan[];
}) {
  return (
    <div className="isolate mx-auto grid w-full max-w-md grid-cols-1 gap-8 lg:hidden">
      {props.plans.map((plan) => (
        <section
          aria-labelledby={`pricing-plan-mobile-${plan.id}`}
          className="rounded-3xl bg-background p-8 ring-1 ring-mit-line"
          key={plan.id}
        >
          <h2
            className="text-lg/8 font-semibold text-mit-text"
            id={`pricing-plan-mobile-${plan.id}`}
          >
            {plan.name}
          </h2>
          <p className="mt-4 text-sm/6 text-muted-foreground">
            {plan.description}
          </p>
          <div className="mt-6">
            <PricingPlanPrice plan={plan} />
          </div>
          <PricingPlanCta
            cta={props.cta}
            describedBy={`pricing-plan-mobile-${plan.id}`}
          />
          <PricingFeatureList features={plan.features} />
        </section>
      ))}
    </div>
  );
}

function PricingComparisonTable(props: {
  readonly cta: PricingCta;
  readonly rows: readonly IncludedClassRow[];
  readonly plans: readonly PricingPlan[];
}) {
  const t = useTranslations('PricingPage');

  return (
    <div className="hidden overflow-hidden rounded-lg border border-mit-line bg-background shadow-xs lg:block">
      <table
        aria-label={t('pricing_chart_label')}
        className="w-full table-fixed border-collapse text-left text-sm leading-6"
      >
        <thead className="border-b border-mit-line bg-muted/55 text-mit-text">
          <tr>
            <th className="w-[20%] px-5 py-6 font-semibold" scope="col">
              {t('pricing_chart_plan')}
            </th>
            {props.plans.map((plan) => (
              <th
                className="px-4 py-4 text-base leading-7 font-semibold"
                key={plan.id}
                scope="col"
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-mit-line">
          <tr>
            <th
              className="bg-muted/35 px-5 py-6 align-top text-sm font-semibold text-mit-red dark:text-mit-red-ink"
              scope="row"
            >
              {t('pricing_chart_details')}
            </th>
            {props.plans.map((plan) => (
              <td className="px-4 py-6 align-top" key={plan.id}>
                <PricingPlanSummary
                  cta={props.cta}
                  idSuffix="desktop"
                  plan={plan}
                />
              </td>
            ))}
          </tr>
          <tr>
            <th
              className="bg-muted/35 px-5 py-3 text-sm font-semibold text-mit-red dark:text-mit-red-ink"
              colSpan={5}
              scope="rowgroup"
            >
              {t('included_classes_heading')}
            </th>
          </tr>
          {props.rows.map((row) => (
            <tr key={row.name}>
              <th className="px-5 py-3.5 font-medium text-mit-text" scope="row">
                {row.name}
              </th>
              <td className="px-5 py-3.5 text-center">
                {row.fullSailing ? <IncludedMark /> : t('pricing_chart_dash')}
              </td>
              <td className="px-5 py-3.5 text-center">
                {row.springRacing ? <IncludedMark /> : t('pricing_chart_dash')}
              </td>
              <td className="px-5 py-3.5 text-center">
                {row.fullYearRacing ? (
                  <IncludedMark />
                ) : (
                  t('pricing_chart_dash')
                )}
              </td>
              <td className="px-5 py-3.5 text-center">
                {row.thursdayTeamRacing ? (
                  <IncludedMark />
                ) : (
                  t('pricing_chart_dash')
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingComparison(props: { readonly cta: PricingCta }) {
  const rows = useIncludedClassRows();
  const plans = usePricingPlans(rows);

  return (
    <section className="bg-mit-surface py-10 sm:py-12">
      <div className="mx-auto grid max-w-7xl gap-7 px-5 sm:px-6 lg:px-8">
        <PricingPlanCardsMobile cta={props.cta} plans={plans} />
        <PricingComparisonTable cta={props.cta} plans={plans} rows={rows} />
      </div>
    </section>
  );
}

function PricingFooterNotes() {
  const t = useTranslations('PricingPage');

  return (
    <section className="bg-background py-10">
      <div className="mx-auto grid max-w-7xl gap-3 px-5 text-sm leading-6 text-muted-foreground sm:px-6 lg:px-8">
        <p>{t('pricing_chart_note')}</p>
      </div>
    </section>
  );
}

export function PricingPageView(props: PricingPageViewProps) {
  const t = useTranslations('PricingPage');
  const primaryCta = pricingPrimaryCta(props);
  const cta = {
    href: primaryCta.href,
    label: t(primaryCta.labelKey),
  };

  return (
    <div className="min-h-0 min-w-0 bg-background">
      <section className="bg-background py-10 sm:py-18 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-base/7 font-semibold text-mit-red dark:text-mit-red-ink">
              {t('breadcrumb')}
            </p>
            <h1 className="mt-2 font-mit-serif text-4xl leading-tight font-bold text-balance text-mit-text sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 font-medium text-pretty text-muted-foreground sm:text-lg sm:leading-8">
              {t('description')}
            </p>
          </div>
        </div>
      </section>
      <PricingComparison cta={cta} />
      <PricingFooterNotes />
    </div>
  );
}
