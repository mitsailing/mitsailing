import { ArrowDown, ArrowRight, Check, MapPin, Sunset } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { pavilionHours } from '@/data/mit-sailing/pavilionInfoSeed';
import {
  mitAccentLinkClassName,
  textFocusRingClassName,
} from '@/lib/mit-sailing/tokens';
import { getSession } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import {
  loadHomeClassesBySlugs,
  loadHomeFeaturedFleetBoats,
  loadHomeIntroductionClasses,
  loadSailingClassNamesByIds,
} from '@/libs/mit-sailing/homeCatalogFromPrisma';
import { getHomeUpcomingDayGroups } from '@/libs/mit-sailing/homeUpcomingFromPrisma';
import { HomeEventRow } from './HomeEventRow';
import { SectionHeader } from './SectionHeader';

const HOME_FLEET_SLUGS = ['tech-dinghy', 'flying-junior', 'club-420'] as const;
const HOME_NEXT_CLASS_SLUGS = [
  'intermediate-sailing-boat-speed',
  'intro-to-racing',
  'windsurfing-fundamentals',
  'intermediate-racing-tactics-strategy',
] as const;

const UNSPLASH_BY_BOAT_SLUG: Record<string, string> = {
  'tech-dinghy':
    'https://images.unsplash.com/photo-1759809278956-70c6a72eecdd?w=1080',
  'flying-junior':
    'https://images.unsplash.com/photo-1660062436864-f7873d68df2d?w=1080',
  'club-420':
    'https://images.unsplash.com/photo-1776308786818-e498ccdb1cc4?w=1080',
};

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1577907073204-e5a8cbad51f5?w=1920';
const RENTAL_IMAGE =
  'https://images.unsplash.com/photo-1773083405898-bb79cb98ed51?w=1200';

type MitSailingHomePageViewProps = { locale: string };

/**
 * @param props - Home page
 * @param props.locale - Active UI locale
 * @returns Home page (mit-redesign parity)
 */
export async function MitSailingHomePageView(
  props: MitSailingHomePageViewProps
) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingHome',
  });

  const [
    upcomingDayGroups,
    session,
    featuredHomeBoats,
    homeNextClasses,
    homeIntroClasses,
  ] = await Promise.all([
    getHomeUpcomingDayGroups(),
    getSession(),
    loadHomeFeaturedFleetBoats(HOME_FLEET_SLUGS),
    loadHomeClassesBySlugs(HOME_NEXT_CLASS_SLUGS),
    loadHomeIntroductionClasses(),
  ]);
  const isSignedIn = Boolean(session?.user?.id);

  const firstPrereqIds = homeNextClasses
    .map((c) => c.prerequisiteIds[0])
    .filter((id): id is string => id !== undefined);
  const prereqNameById = await loadSailingClassNamesByIds(firstPrereqIds);

  const memPlans = [
    {
      title: t('mem_student_title'),
      who: t('mem_student_who'),
      price: t('mem_price_free'),
      freq: '',
      highlight: true,
      perks: t('mem_s1'),
    },
    {
      title: t('mem_faculty_title'),
      who: t('mem_faculty_who'),
      price: t('mem_price_free_rec'),
      freq: t('mem_with_rec'),
      highlight: false,
      perks: t('mem_f1'),
    },
    {
      title: t('mem_alumni_title'),
      who: t('mem_alumni_who'),
      price: t('mem_price_64'),
      freq: t('mem_per_month'),
      highlight: false,
      perks: t('mem_a1'),
    },
    {
      title: t('mem_public_title'),
      who: t('mem_public_who'),
      price: t('mem_price_90'),
      freq: t('mem_per_month'),
      highlight: false,
      perks: t('mem_p1'),
    },
  ] as const;

  return (
    <div className="w-full min-w-0">
      {/* News strip */}
      <div className="border-b border-mit-line bg-mit-red-highlight">
        <div className="mx-auto flex max-w-7xl items-stretch">
          <Link
            className="flex shrink-0 items-center bg-mit-red px-6 py-2.5 text-xs font-bold tracking-widest text-white uppercase no-underline transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:outline-none"
            href="/events/"
          >
            {t('news_badge')}
          </Link>
          <div className="no-scrollbar flex flex-1 items-center gap-8 overflow-x-auto px-6 py-2.5 text-xs whitespace-nowrap text-mit-text">
            <div className="flex items-center gap-2">{t('news_1')}</div>
            <div className="flex items-center gap-2 border-l border-mit-line pl-8">
              {t('news_2')}
            </div>
            <div className="flex items-center gap-2 border-l border-mit-line pl-8">
              {t('news_3')}
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative flex h-[600px] items-center overflow-hidden bg-mit-hero-ink">
        <Image
          alt={t('hero_image_alt')}
          className="object-cover object-center opacity-60"
          fill
          priority
          sizes="100vw"
          src={HERO_IMAGE}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-white/80 uppercase">
              <MapPin className="shrink-0" size={14} />
              {t('hero_kicker')}
            </div>
            <h1 className="mb-6 font-mit-serif text-4xl leading-tight font-bold text-white">
              {t('hero_title')}
            </h1>
            <p className="mb-10 text-base leading-relaxed text-white/90">
              {t('hero_body')}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-white bg-transparent px-7 py-3 text-base font-medium text-white no-underline backdrop-blur transition-colors hover:bg-white/10"
                href="/classes/"
              >
                {t('hero_cta_classes')}
              </Link>
              {isSignedIn ? null : (
                <Link
                  className="inline-flex items-center justify-center rounded-sm bg-transparent px-2 py-3 text-base font-medium text-white underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-mit-hero-ink focus-visible:outline-none"
                  href="/signup/"
                >
                  {t('hero_cta_create_account')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Hours + events */}
      <section className="border-b border-mit-line bg-mit-surface py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12">
            <div className="space-y-16 lg:col-span-8">
              <div>
                <SectionHeader
                  subtitle={pavilionHours.seasonSubtitle}
                  title={pavilionHours.sectionTitle}
                />
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-mit-line bg-white p-8">
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {pavilionHours.schedule.map((row, i) => {
                          const isLastRow =
                            i === pavilionHours.schedule.length - 1;
                          return (
                            <tr
                              className={
                                isLastRow
                                  ? undefined
                                  : 'border-b border-mit-line'
                              }
                              key={row.day}
                            >
                              <td className="py-3 font-semibold text-mit-text">
                                {row.day}
                              </td>
                              <td className="py-3 text-mit-text">
                                {row.hours}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-6 flex gap-3 rounded-lg bg-mit-red-highlight p-4">
                      <Sunset
                        className="mt-0.5 shrink-0 text-mit-red"
                        size={18}
                      />
                      <p className="text-xs leading-snug text-mit-text">
                        {t('hours_sun_box')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-6 font-mit-serif text-lg font-semibold text-mit-text">
                      {t('how_to_title')}
                    </h3>
                    <div className="relative space-y-6">
                      <div
                        aria-hidden
                        className="absolute inset-y-0 left-3.5 -z-10 w-px bg-mit-line"
                      />
                      {(
                        [
                          {
                            num: 1,
                            title: t('how_to_1_title'),
                            desc: t('how_to_1_desc'),
                          },
                          {
                            num: 2,
                            title: t('how_to_2_title'),
                            desc: t('how_to_2_desc'),
                          },
                          {
                            num: 3,
                            title: t('how_to_3_title'),
                            desc: t('how_to_3_desc'),
                          },
                        ] as const
                      ).map((step) => (
                        <div
                          className="relative flex items-start gap-4"
                          key={step.num}
                        >
                          <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mit-red text-xs font-bold text-white">
                            {step.num}
                          </div>
                          <div>
                            <h4 className="mb-1 text-sm font-semibold text-mit-text">
                              {step.title}
                            </h4>
                            <p className="text-xs leading-relaxed text-mit-text">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-4">
              <div className="rounded-xl border border-mit-line bg-white p-5 lg:sticky lg:top-24">
                <h3 className="mb-4 font-mit-serif text-base font-semibold text-mit-text">
                  {t('upcoming_title')}
                </h3>
                <div className="space-y-0">
                  {upcomingDayGroups.length === 0 ? (
                    <p className="text-[11px] leading-snug text-mit-text">
                      {t('upcoming_empty')}
                    </p>
                  ) : (
                    upcomingDayGroups.map((group, gi) => (
                      <div
                        className={gi > 0 ? 'mt-2.5' : undefined}
                        key={group.dateKey}
                      >
                        <div
                          className={
                            group.isToday
                              ? 'border-b border-mit-line pb-1 text-[11px] font-semibold text-mit-red underline'
                              : 'border-b border-mit-line pb-1 text-[11px] font-semibold text-mit-text'
                          }
                        >
                          {group.headingLabel}
                        </div>
                        <div className="space-y-0">
                          {group.rows.map((row, ri) => {
                            const lastInSection =
                              gi === upcomingDayGroups.length - 1 &&
                              ri === group.rows.length - 1;
                            return (
                              <HomeEventRow
                                key={row.rowKey}
                                row={row}
                                showBottomBorder={!lastInSection}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-5 flex w-full justify-center">
                  <Link
                    className={`inline-flex items-center gap-1 no-underline hover:underline ${mitAccentLinkClassName}`}
                    href="/events/"
                  >
                    {t('upcoming_view_all')}
                    <ArrowRight aria-hidden className="inline" size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet */}
      <section className="border-b border-mit-line bg-mit-surface py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            action={
              <Link
                className={`inline-flex items-center gap-1 no-underline hover:underline ${textFocusRingClassName} ${mitAccentLinkClassName}`}
                href="/fleet/"
              >
                {t('fleet_view_all')}
                <ArrowRight aria-hidden size={16} />
              </Link>
            }
            subtitle={t('fleet_subtitle')}
            title={t('fleet_title')}
          />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {featuredHomeBoats.map((boat) => {
              const imgSrc =
                UNSPLASH_BY_BOAT_SLUG[boat.slug] ?? boat.imagePaths[0] ?? '';
              const badge = boat.requiredClass
                ? `After: ${boat.requiredClass.name}`
                : `${boat.type} · ${boat.capacity} crew`;
              return (
                <Link
                  className={`group block overflow-hidden rounded-xl border border-mit-line bg-white no-underline transition-all duration-300 ${textFocusRingClassName}`}
                  href={`/fleet/${boat.slug}/`}
                  key={boat.id}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <div className="absolute inset-0 z-10 bg-black/5 transition-opacity group-hover:opacity-0" />
                    <Image
                      alt={boat.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      height={600}
                      src={imgSrc}
                      unoptimized
                      width={800}
                    />
                  </div>
                  <div className="p-8">
                    <div className="mb-4 inline-block rounded bg-mit-red-highlight px-3 py-1 text-[11px] font-bold tracking-wider text-mit-red uppercase">
                      {badge}
                    </div>
                    <h3 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text">
                      {boat.name}
                    </h3>
                    <p className="text-sm leading-relaxed text-mit-text">
                      {boat.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Classes - truncated: include intro + next + CTA; match Figma structure */}
      <section className="border-b border-mit-line bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            subtitle={t('classes_subtitle')}
            title={t('classes_title')}
          />
          <div className="mx-auto flex max-w-6xl flex-col items-center">
            <div className="w-full">
              <div className="mb-6 text-center text-[11px] font-bold tracking-widest text-mit-red uppercase">
                {t('classes_start_label')}
              </div>
              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {homeIntroClasses.map((cls) => (
                  <Link
                    className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-mit-line bg-white p-8 no-underline shadow-sm transition-shadow hover:shadow-sm ${textFocusRingClassName}`}
                    href={`/classes/${cls.slug}/`}
                    key={cls.id}
                  >
                    <span className="mb-3 inline-block self-start rounded bg-mit-red-highlight px-2 py-0.5 text-[10px] font-bold tracking-wide text-mit-red uppercase">
                      {cls.level}
                    </span>
                    <h4 className="mb-3 line-clamp-3 font-mit-serif text-[22px] font-bold text-mit-text">
                      {cls.name}
                    </h4>
                    <p className="mb-6 line-clamp-5 text-base leading-relaxed text-mit-text">
                      {cls.description}
                    </p>
                    <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-mit-red">
                      <span>{t('class_details')}</span>
                      <ArrowRight aria-hidden size={14} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="relative flex w-full flex-col items-center py-8">
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <div className="h-full w-px bg-mit-line" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-mit-line bg-white text-mit-red">
                <ArrowDown size={24} />
              </div>
            </div>
            <div className="w-full">
              <div className="mb-6 text-center text-[11px] font-bold tracking-widest text-mit-text uppercase">
                {t('classes_next_label')}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {homeNextClasses.map((cls) => {
                  const [preId] = cls.prerequisiteIds;
                  const firstPreName = preId
                    ? prereqNameById.get(preId)
                    : undefined;
                  let reqLabel: string;
                  if (cls.prerequisiteIds.length === 0) {
                    reqLabel = cls.level;
                  } else if (firstPreName) {
                    reqLabel = `After: ${firstPreName}`;
                  } else {
                    reqLabel = 'Prerequisites';
                  }
                  return (
                    <div
                      className="flex flex-col items-start rounded-xl border border-mit-line bg-mit-surface p-5 transition-shadow hover:shadow-sm"
                      key={cls.id}
                    >
                      <h4 className="mb-1 text-base font-semibold text-mit-text">
                        {cls.name}
                      </h4>
                      <p className="mb-3 text-sm leading-snug text-mit-text">
                        {cls.description}
                      </p>
                      <div className="mt-auto flex w-full items-center justify-between">
                        <span className="rounded border border-mit-line bg-white px-2 py-0.5 text-[10px] font-semibold text-mit-text">
                          {reqLabel}
                        </span>
                        <Link
                          className={`flex items-center gap-1 text-xs font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName}`}
                          href={`/classes/${cls.slug}/`}
                        >
                          {t('course_details')}
                          <ArrowRight aria-hidden size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex w-full justify-center">
                <Link
                  className={`inline-flex items-center gap-1 no-underline hover:underline ${textFocusRingClassName} ${mitAccentLinkClassName}`}
                  href="/classes/"
                >
                  {t('classes_view_all')}
                  <ArrowRight aria-hidden size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Membership */}
      <section className="border-b border-mit-line bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            subtitle={t('membership_subtitle')}
            title={t('membership_title')}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {memPlans.map((plan) => (
              <div
                className={
                  plan.highlight
                    ? 'relative flex flex-col rounded-xl border-2 border-mit-red bg-white p-8 shadow-[0_12px_32px_-8px_rgba(163,31,52,0.15)] transition-all hover:-translate-y-1'
                    : 'relative flex flex-col rounded-xl border border-transparent bg-mit-surface p-8 transition-all hover:-translate-y-1'
                }
                key={plan.title}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-8 rounded-full bg-mit-red px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
                    {t('mem_badge')}
                  </span>
                ) : null}
                <div className="mb-8">
                  <h3 className="mb-1 text-lg font-bold text-mit-text">
                    {plan.title}
                  </h3>
                  <p className="text-xs text-mit-text">{plan.who}</p>
                </div>
                <div className="mb-8 flex items-baseline gap-1">
                  <span className="font-mit-serif text-[32px] font-bold text-mit-text">
                    {plan.price}
                  </span>
                  <span className="text-xs text-mit-text">{plan.freq}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-4 text-xs text-mit-text">
                  {plan.perks.split('|').map((perk) => (
                    <li
                      className="flex items-start gap-3"
                      key={`${plan.title}::${perk}`}
                    >
                      <Check
                        className="mt-0.5 shrink-0 text-mit-success"
                        size={16}
                      />
                      <span className="leading-snug">{perk}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  className={
                    plan.highlight
                      ? 'w-full rounded-lg border-2 border-transparent bg-mit-red py-2.5 text-center text-sm font-medium text-white no-underline hover:bg-mit-red-hover'
                      : 'w-full rounded-lg border border-mit-line bg-white py-2.5 text-center text-sm font-medium text-mit-text no-underline'
                  }
                  href={isSignedIn ? '/' : '/signup/'}
                >
                  {isSignedIn
                    ? t('membership_cta_manage_account')
                    : t('create_account')}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-xs text-mit-text">
            {t('membership_foot')}
          </p>
        </div>
      </section>

      {/* Pavilion rental */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 font-mit-serif text-[32px] leading-tight font-semibold text-mit-text">
                {t('rental_title')}
              </h2>
              <p className="mb-8 text-base leading-relaxed text-mit-text">
                {t('rental_body')}
              </p>
              <ul className="mb-10 space-y-4">
                {(
                  [
                    t('rental_bullet_1'),
                    t('rental_bullet_2'),
                    t('rental_bullet_3'),
                    t('rental_bullet_4'),
                  ] as const
                ).map((line) => (
                  <li className="flex items-center gap-3" key={line}>
                    <ArrowRight className="shrink-0 text-mit-red" size={16} />
                    <span className="text-sm font-medium text-mit-text">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                className="inline-flex rounded-md bg-mit-red px-5 py-2.5 text-sm font-medium text-white no-underline hover:bg-mit-red-hover"
                href="/contact/"
              >
                {t('rental_cta')}
              </Link>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-mit-line shadow-lg">
              <Image
                alt={t('rental_image_alt')}
                className="h-full w-full object-cover"
                height={800}
                src={RENTAL_IMAGE}
                unoptimized
                width={1200}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
