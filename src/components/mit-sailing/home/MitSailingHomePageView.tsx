import { ArrowDown, ArrowRight, MapPin, Sunset } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { CmsPricingBlock } from '@/components/mit-sailing/cms/CmsPricingBlock';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import {
  mitAccentLinkClassName,
  textFocusRingClassName,
} from '@/lib/mit-sailing/tokens';
import { getSession } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { parseCmsHomeOverviewBody } from '@/libs/mit-sailing/cmsHomeOverview';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';
import type { PublicCmsBlock } from '@/libs/mit-sailing/cmsQueries';
import {
  loadHomeClassesBySlugs,
  loadHomeFeaturedFleetBoats,
  loadHomeIntroductionClasses,
  loadSailingClassNamesByIds,
} from '@/libs/mit-sailing/homeCatalogFromPrisma';
import { getHomeUpcomingDayGroups } from '@/libs/mit-sailing/homeUpcomingFromPrisma';
import type { HomeUpcomingDayGroup } from '@/libs/mit-sailing/homeUpcomingFromPrisma';
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

/**
 * Home hero layout: `next/image` with `fill`, `sizes="100vw"`, and `priority` (LCP); left scrim; shared white CTA focus ring.
 */
const HERO_IMAGE_CLASS_NAME = 'object-cover object-center brightness-[1.05]';

const HERO_SCRIM_CLASS_NAME =
  'absolute inset-0 bg-gradient-to-r from-black/58 via-black/24 to-transparent';

const HERO_COPY_STACK_CLASS_NAME =
  'max-w-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]';

const HERO_ON_IMAGE_FOCUS_RING_CLASS_NAME =
  'focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-mit-hero-ink focus-visible:outline-none';

type MitSailingHomePageViewProps = { locale: string };

function HomeHeroSection(props: {
  block: PublicCmsBlock;
  createAccountLabel: string;
  isSignedIn: boolean;
}) {
  return (
    <section className="relative flex h-[600px] items-center overflow-hidden bg-mit-hero-ink">
      {props.block.imageSrc ? (
        <Image
          alt={props.block.imageAlt ?? ''}
          className={HERO_IMAGE_CLASS_NAME}
          fill
          priority
          sizes="100vw"
          src={props.block.imageSrc}
        />
      ) : null}
      {props.block.imageSrc ? <div className={HERO_SCRIM_CLASS_NAME} /> : null}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
        <div className={HERO_COPY_STACK_CLASS_NAME}>
          {props.block.subtitle ? (
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-white uppercase">
              <MapPin className="shrink-0" size={14} />
              {props.block.subtitle}
            </div>
          ) : null}
          <h1 className="mb-6 font-mit-serif text-4xl leading-tight font-bold text-white">
            {props.block.title}
          </h1>
          {props.block.body ? (
            <CmsRichText
              className="mb-10 text-base leading-relaxed text-white"
              html={props.block.body}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            {props.block.ctaUrl && props.block.ctaLabel ? (
              <Link
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-white bg-transparent px-7 py-3 text-base font-medium text-white no-underline backdrop-blur transition-colors hover:bg-white/10 ${HERO_ON_IMAGE_FOCUS_RING_CLASS_NAME}`}
                href={props.block.ctaUrl}
              >
                {props.block.ctaLabel}
              </Link>
            ) : null}
            {props.isSignedIn ? null : (
              <Link
                className={`inline-flex items-center justify-center rounded-sm bg-transparent px-2 py-3 text-base font-medium text-white underline-offset-4 transition-colors hover:underline ${HERO_ON_IMAGE_FOCUS_RING_CLASS_NAME}`}
                href="/signup/"
              >
                {props.createAccountLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function limitHomeUpcomingDayGroups(
  groups: HomeUpcomingDayGroup[],
  maxRows: number
): HomeUpcomingDayGroup[] {
  let remaining = maxRows;
  const limited: HomeUpcomingDayGroup[] = [];
  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }
    const rows = group.rows.slice(0, remaining);
    if (rows.length > 0) {
      limited.push({ ...group, rows });
      remaining -= rows.length;
    }
  }
  return limited;
}

function HomeOverviewCtaLink(props: { href: string; label: string }) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return null;
  }
  const className = `inline-flex items-center gap-1 no-underline hover:underline ${mitAccentLinkClassName}`;
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link className={className} href={href}>
        {props.label}
        <ArrowRight aria-hidden className="inline" size={16} />
      </Link>
    );
  }
  return (
    <a className={className} href={href} {...externalCmsLinkProps(href)}>
      {props.label}
      <ArrowRight aria-hidden className="inline" size={16} />
    </a>
  );
}

function HomeRentalSection(props: { block: PublicCmsBlock }) {
  const contentClassName = props.block.imageSrc
    ? 'grid grid-cols-1 items-center gap-16 lg:grid-cols-2'
    : 'max-w-3xl';
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className={contentClassName}>
          <div>
            <h2 className="mb-4 font-mit-serif text-[32px] leading-tight font-semibold text-mit-text">
              {props.block.title}
            </h2>
            {props.block.body ? (
              <CmsRichText
                className="mb-8 text-base leading-relaxed text-mit-text"
                html={props.block.body}
              />
            ) : null}
            {props.block.ctaUrl && props.block.ctaLabel ? (
              <Link
                className="inline-flex rounded-md bg-mit-red px-5 py-2.5 text-sm font-medium text-white no-underline hover:bg-mit-red-hover"
                href={props.block.ctaUrl}
              >
                {props.block.ctaLabel}
              </Link>
            ) : null}
          </div>
          {props.block.imageSrc ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-mit-line shadow-lg">
              <Image
                alt={props.block.imageAlt ?? ''}
                className="h-full w-full object-cover"
                height={800}
                src={props.block.imageSrc}
                width={1200}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

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
    cmsHomePage,
  ] = await Promise.all([
    getHomeUpcomingDayGroups(),
    getSession(),
    loadHomeFeaturedFleetBoats(HOME_FLEET_SLUGS),
    loadHomeClassesBySlugs(HOME_NEXT_CLASS_SLUGS),
    loadHomeIntroductionClasses(),
    loadPublishedCmsPageByPath('/'),
  ]);
  const isSignedIn = Boolean(session?.user?.id);
  const homeHeroBlock = cmsHomePage?.blocks.find(
    (block) => block.kind === 'hero'
  );
  const homeOverviewBlock = cmsHomePage?.blocks.find(
    (block) => block.kind === 'home_overview'
  );

  const firstPrereqIds = homeNextClasses
    .map((c) => c.prerequisiteIds[0])
    .filter((id): id is string => id !== undefined);
  const prereqNameById = await loadSailingClassNamesByIds(firstPrereqIds);
  const homeOverviewData = parseCmsHomeOverviewBody(homeOverviewBlock?.body);
  const homeOverviewUpcomingDayGroups = homeOverviewData
    ? limitHomeUpcomingDayGroups(upcomingDayGroups, homeOverviewData.eventCount)
    : [];
  const orderedHomeCmsBlocks =
    cmsHomePage?.blocks.filter(
      (block) => block.kind === 'callout' || block.kind === 'pricing'
    ) ?? [];

  return (
    <div className="w-full min-w-0">
      {homeHeroBlock ? (
        <HomeHeroSection
          block={homeHeroBlock}
          createAccountLabel={t('hero_cta_create_account')}
          isSignedIn={isSignedIn}
        />
      ) : null}

      {homeOverviewBlock && homeOverviewData ? (
        <section className="border-b border-mit-line bg-mit-surface py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12">
              <div className="space-y-16 lg:col-span-8">
                <div>
                  <SectionHeader
                    subtitle={homeOverviewBlock.subtitle}
                    title={homeOverviewBlock.title}
                  />
                  <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-border bg-card p-8">
                      <table className="w-full text-left text-sm">
                        <tbody>
                          {homeOverviewData.schedule.map((row, i) => {
                            const isLastRow =
                              i === homeOverviewData.schedule.length - 1;
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
                      {homeOverviewData.hoursNote ? (
                        <div className="mt-6 flex gap-3 rounded-lg bg-mit-red-highlight p-4">
                          <Sunset
                            className="mt-0.5 shrink-0 text-primary-ink"
                            size={18}
                          />
                          <p className="text-xs leading-snug text-mit-text">
                            {homeOverviewData.hoursNote}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="mb-6 font-mit-serif text-lg font-semibold text-mit-text">
                        {homeOverviewData.stepsTitle}
                      </h3>
                      <div className="relative space-y-6">
                        <div
                          aria-hidden
                          className="absolute inset-y-0 left-3.5 -z-10 w-px bg-mit-line"
                        />
                        {homeOverviewData.steps.map((step, stepIndex) => (
                          <div
                            className="relative flex items-start gap-4"
                            key={step.title}
                          >
                            <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mit-red text-xs font-bold text-white">
                              {stepIndex + 1}
                            </div>
                            <div>
                              <h4 className="mb-1 text-sm font-semibold text-mit-text">
                                {step.title}
                              </h4>
                              <p className="text-xs leading-relaxed text-mit-text">
                                {step.description}
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
                <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
                  <h3 className="mb-4 font-mit-serif text-base font-semibold text-mit-text">
                    {homeOverviewData.eventsTitle}
                  </h3>
                  <div className="space-y-0">
                    {homeOverviewUpcomingDayGroups.length === 0 ? (
                      <p className="text-[11px] leading-snug text-mit-text">
                        {homeOverviewData.eventsEmptyText}
                      </p>
                    ) : (
                      homeOverviewUpcomingDayGroups.map((group, gi) => (
                        <div
                          className={gi > 0 ? 'mt-2.5' : undefined}
                          key={group.dateKey}
                        >
                          <div
                            className={
                              group.isToday
                                ? 'border-b border-mit-line pb-1 text-[11px] font-semibold text-primary-ink underline'
                                : 'border-b border-mit-line pb-1 text-[11px] font-semibold text-mit-text'
                            }
                          >
                            {group.headingLabel}
                          </div>
                          <div className="space-y-0">
                            {group.rows.map((row, ri) => {
                              const lastInSection =
                                gi ===
                                  homeOverviewUpcomingDayGroups.length - 1 &&
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
                    <HomeOverviewCtaLink
                      href={homeOverviewData.eventsCtaUrl}
                      label={homeOverviewData.eventsCtaLabel}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
                  className={`group block overflow-hidden rounded-xl border border-border bg-card no-underline transition-all duration-300 ${textFocusRingClassName}`}
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
                    <div className="mb-4 inline-block rounded bg-mit-red-highlight px-3 py-1 text-[11px] font-bold tracking-wider text-primary-ink uppercase">
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
      <section className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            subtitle={t('classes_subtitle')}
            title={t('classes_title')}
          />
          <div className="mx-auto flex max-w-6xl flex-col items-center">
            <div className="w-full">
              <div className="mb-6 text-center text-[11px] font-bold tracking-widest text-primary-ink uppercase">
                {t('classes_start_label')}
              </div>
              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {homeIntroClasses.map((cls) => (
                  <Link
                    className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-8 no-underline shadow-sm transition-shadow hover:shadow-sm ${textFocusRingClassName}`}
                    href={`/classes/${cls.slug}/`}
                    key={cls.id}
                  >
                    <span className="mb-3 inline-block self-start rounded bg-mit-red-highlight px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-ink uppercase">
                      {cls.level}
                    </span>
                    <h4 className="mb-3 line-clamp-3 font-mit-serif text-[22px] font-bold text-mit-text">
                      {cls.name}
                    </h4>
                    <p className="mb-6 line-clamp-5 text-base leading-relaxed text-mit-text">
                      {cls.description}
                    </p>
                    <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary-ink">
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-card text-primary-ink">
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
                    reqLabel = t('class_next_badge_by_level', {
                      level: cls.level,
                    });
                  } else if (firstPreName) {
                    reqLabel = t('class_next_badge_after', {
                      name: firstPreName,
                    });
                  } else {
                    reqLabel = t('class_next_badge_prerequisites');
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
                        <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          {reqLabel}
                        </span>
                        <Link
                          className={`flex items-center gap-1 text-xs font-semibold text-primary-ink no-underline hover:underline ${textFocusRingClassName}`}
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

      {orderedHomeCmsBlocks.map((block) => {
        if (block.kind === 'pricing') {
          return <CmsPricingBlock block={block} key={block.id} />;
        }
        return <HomeRentalSection block={block} key={block.id} />;
      })}
    </div>
  );
}
