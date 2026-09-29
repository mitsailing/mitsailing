'use client';

import { useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { homeSailPathSignupHref } from '@/libs/mit-sailing/homeSailPathSchedule';
import type {
  HomeSailPathExperiencedSession,
  HomeSailPathScheduleSummary,
  HomeSailPathWaitlistState,
} from '@/libs/mit-sailing/homeSailPathSchedule';

const sailPathRichText = {
  strong: (chunks: React.ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  ),
};

const pillThumbClassName =
  'pointer-events-none absolute top-0 left-0 rounded-full bg-foreground motion-reduce:transition-none motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]';

const panelClassName =
  'motion-reduce:animate-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 motion-safe:slide-in-from-bottom-1 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]';

const dateLinkClassName = cn(
  'font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
  textFocusRingClassName,
  'rounded-sm'
);

function sailPathOptionTone(selected: boolean, thumbReady: boolean) {
  if (!selected) {
    return 'bg-transparent text-muted-foreground hover:text-foreground';
  }
  if (thumbReady) {
    return 'bg-transparent text-background';
  }
  return 'bg-foreground text-background';
}

type ThumbBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

function measureThumb(track: HTMLElement, button: HTMLElement): ThumbBox {
  const trackBox = track.getBoundingClientRect();
  const buttonBox = button.getBoundingClientRect();
  return {
    height: buttonBox.height,
    width: buttonBox.width,
    x: buttonBox.left - trackBox.left,
    y: buttonBox.top - trackBox.top,
  };
}

function sameThumb(current: ThumbBox | null, next: ThumbBox) {
  return (
    current !== null &&
    current.height === next.height &&
    current.width === next.width &&
    current.x === next.x &&
    current.y === next.y
  );
}

function SailPathTitle(props: { accent: string; lead: string }) {
  return (
    <h1
      aria-label={`${props.lead} ${props.accent}`}
      className="font-mit-serif text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.05] font-semibold tracking-tight text-balance text-mit-text"
      id="home-sail-path-heading"
    >
      <span className="block">{props.lead}</span>
      <span className="mt-1 block text-mit-red dark:text-mit-red-ink">
        {props.accent}
      </span>
    </h1>
  );
}

function NewSailorWaitlistAction(props: {
  joinWaitlistAction: () => Promise<void>;
  waitlist: HomeSailPathWaitlistState;
}) {
  const t = useTranslations('MitSailingHome');

  if (props.waitlist.kind === 'position') {
    return (
      <p
        className="mt-6 rounded-lg border border-mit-line bg-muted/40 px-4 py-3 text-base font-semibold text-mit-text"
        role="status"
      >
        {t('sail_path_waitlist_place', {
          position: props.waitlist.position,
        })}
      </p>
    );
  }

  if (props.waitlist.kind === 'closed') {
    return (
      <p
        className="mt-6 rounded-lg border border-mit-line bg-muted/40 px-4 py-3 text-sm font-semibold text-mit-readable-ink"
        role="status"
      >
        {t('sail_path_waitlist_not_open')}
      </p>
    );
  }

  if (props.waitlist.kind === 'join') {
    return (
      <form action={props.joinWaitlistAction} className="mt-6">
        <SubmitButton
          className="min-h-11 px-4"
          pendingLabel={t('sail_path_waitlist_pending')}
          size="lg"
          type="submit"
          variant="mit"
        >
          {t('sail_path_waitlist_cta')}
        </SubmitButton>
      </form>
    );
  }

  return (
    <Button asChild className="mt-6 min-h-11 px-4" size="lg" variant="mit">
      <Link href={homeSailPathSignupHref()}>{t('sail_path_waitlist_cta')}</Link>
    </Button>
  );
}

function NewSailorPanel(props: {
  joinWaitlistAction: () => Promise<void>;
  waitlist: HomeSailPathWaitlistState;
}) {
  const t = useTranslations('MitSailingHome');
  const steps = [
    { id: 'join', body: t.rich('sail_path_new_step_1', sailPathRichText) },
    {
      id: 'request',
      body: t.rich('sail_path_new_step_2', sailPathRichText),
    },
    { id: 'earn', body: t.rich('sail_path_new_step_3', sailPathRichText) },
  ];

  return (
    <div className={panelClassName} id="home-sail-path-panel">
      <SailPathTitle
        accent={t('sail_path_new_title_accent')}
        lead={t('sail_path_new_title_lead')}
      />
      <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-mit-text">
        {t.rich('sail_path_new_body', sailPathRichText)}
      </p>
      <ol className="mt-5 flex list-none flex-col gap-3 p-0">
        {steps.map((step, index) => (
          <li
            className="flex gap-3 text-base leading-relaxed text-mit-text"
            key={step.id}
          >
            <span
              aria-hidden
              className="w-7 shrink-0 font-semibold text-mit-red tabular-nums dark:text-mit-red-ink"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{step.body}</span>
          </li>
        ))}
      </ol>
      <NewSailorWaitlistAction
        joinWaitlistAction={props.joinWaitlistAction}
        waitlist={props.waitlist}
      />
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        {t('sail_path_new_fine_print')}
      </p>
    </div>
  );
}

function ExperiencedSessionDates(props: {
  sessions: readonly HomeSailPathExperiencedSession[];
}) {
  const t = useTranslations('MitSailingHome');

  if (props.sessions.length === 0) {
    return (
      <p className="mt-3 text-sm font-semibold text-mit-red dark:text-mit-red-ink">
        <Link className={dateLinkClassName} href="/events">
          {t('sail_path_experienced_see_events')}
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-3 flex flex-wrap gap-y-1 text-sm font-semibold text-mit-red dark:text-mit-red-ink">
      {props.sessions.map((session, index) => (
        <span className="inline-flex items-center" key={session.id}>
          <Link className={dateLinkClassName} href={session.href}>
            {session.dateLabel}
          </Link>
          {index < props.sessions.length - 1 ? (
            <span className="mx-2 font-normal text-muted-foreground">·</span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

function ExperiencedSailorPanel(props: {
  scheduleSummary: HomeSailPathScheduleSummary | null;
  sessions: readonly HomeSailPathExperiencedSession[];
}) {
  const t = useTranslations('MitSailingHome');

  return (
    <div className={panelClassName} id="home-sail-path-panel">
      <SailPathTitle
        accent={t('sail_path_experienced_title_accent')}
        lead={t('sail_path_experienced_title_lead')}
      />
      <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-mit-text">
        {t.rich('sail_path_experienced_body', sailPathRichText)}
      </p>
      <h2 className="mt-6 text-base font-semibold text-mit-text">
        {t('sail_path_experienced_name')}
      </h2>
      {props.scheduleSummary ? (
        <p className="mt-2 text-base">
          <span className="font-semibold text-mit-text">
            {t('sail_path_experienced_when_from_sessions', {
              time: props.scheduleSummary.time,
              weekdayPlural: props.scheduleSummary.weekdayPlural,
            })}
          </span>
          {props.scheduleSummary.durationMinutes === null ? null : (
            <span className="text-muted-foreground">
              {t('sail_path_experienced_duration_from_sessions', {
                minutes: props.scheduleSummary.durationMinutes,
              })}
            </span>
          )}
        </p>
      ) : null}
      <ExperiencedSessionDates sessions={props.sessions} />
      <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-mit-text">
        {t.rich('sail_path_experienced_no_waitlist', sailPathRichText)}
      </p>
      <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-mit-text">
        {t.rich('sail_path_experienced_bring', sailPathRichText)}
      </p>
    </div>
  );
}

function SailPathSwitch(props: {
  knowsHow: boolean;
  onChange: (knowsHow: boolean) => void;
}) {
  const t = useTranslations('MitSailingHome');
  const trackRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const experiencedRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<ThumbBox | null>(null);
  const [thumb, setThumb] = useState<ThumbBox | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const button = props.knowsHow ? experiencedRef.current : newRef.current;
    if (!track || !button) {
      return;
    }

    const apply = () => {
      const next = measureThumb(track, button);
      if (next.width === 0 || next.height === 0) {
        if (thumbRef.current !== null) {
          thumbRef.current = null;
          setThumb(null);
        }
        return;
      }
      if (sameThumb(thumbRef.current, next)) {
        return;
      }
      thumbRef.current = next;
      setThumb(next);
    };

    apply();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(apply);
    observer.observe(track);
    return () => {
      observer.disconnect();
    };
  }, [props.knowsHow]);

  function selectPath(knowsHow: boolean) {
    props.onChange(knowsHow);
    const target = knowsHow ? experiencedRef.current : newRef.current;
    target?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectPath(true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectPath(false);
    }
  }

  const optionClassName = (selected: boolean) =>
    cn(
      'relative z-10 min-h-11 whitespace-nowrap px-3.5 text-sm font-semibold motion-reduce:transition-none motion-safe:transition-colors motion-safe:duration-200 sm:px-4',
      textFocusRingClassName,
      'rounded-full',
      sailPathOptionTone(selected, thumb !== null)
    );

  return (
    <div
      aria-label={t('sail_path_switch_label')}
      className="relative inline-flex max-w-full rounded-full bg-muted p-1"
      ref={trackRef}
      role="radiogroup"
      onKeyDown={onKeyDown}
    >
      {thumb ? (
        <span
          aria-hidden
          className={pillThumbClassName}
          style={{
            height: thumb.height,
            transform: `translate3d(${thumb.x}px, ${thumb.y}px, 0)`,
            width: thumb.width,
          }}
        />
      ) : null}
      <button
        aria-checked={!props.knowsHow}
        className={optionClassName(!props.knowsHow)}
        ref={newRef}
        role="radio"
        tabIndex={props.knowsHow ? -1 : 0}
        type="button"
        onClick={() => {
          selectPath(false);
        }}
      >
        {t('sail_path_new_label')}
      </button>
      <button
        aria-checked={props.knowsHow}
        className={optionClassName(props.knowsHow)}
        ref={experiencedRef}
        role="radio"
        tabIndex={props.knowsHow ? 0 : -1}
        type="button"
        onClick={() => {
          selectPath(true);
        }}
      >
        {t('sail_path_experienced_label')}
      </button>
    </div>
  );
}

function HomeSailPathCollage() {
  const t = useTranslations('MitSailingHome');

  return (
    <div className="hidden aspect-[168/100] w-full grid-cols-[1.15fr_1fr] grid-rows-2 gap-2.5 lg:grid">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed object-cover collage cells */}
      <img
        alt={t('sail_path_photo_rainbow_alt')}
        className="col-start-1 row-span-2 h-full w-full rounded-2xl object-cover"
        height={1203}
        src="/assets/images/home-collage/tech-dinghy-rainbow.jpg"
        width={1080}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed object-cover collage cells */}
      <img
        alt={t('sail_path_photo_black_sails_alt')}
        className="h-full w-full rounded-2xl object-cover"
        height={167}
        src="/assets/images/home-collage/black-sails-dusk.jpg"
        width={302}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed object-cover collage cells */}
      <img
        alt={t('sail_path_photo_keelboat_alt')}
        className="h-full w-full rounded-2xl object-cover object-[center_42%]"
        height={587}
        src="/assets/images/home-collage/keelboat-on-water.jpg"
        width={1024}
      />
    </div>
  );
}

type HomeSailPathProps = {
  readonly experiencedSessions: readonly HomeSailPathExperiencedSession[];
  readonly joinWaitlistAction: () => Promise<void>;
  readonly scheduleSummary: HomeSailPathScheduleSummary | null;
  readonly waitlist: HomeSailPathWaitlistState;
};

/**
 * Homepage path fork: new sailors join the waitlist, experienced sailors take the intro orientation.
 *
 * @param props - Server-loaded sessions and waitlist CTA state
 * @returns Segmented path switcher and the active path copy
 */
export function HomeSailPath(props: HomeSailPathProps) {
  const [knowsHow, setKnowsHow] = useState(false);

  return (
    <section
      aria-labelledby="home-sail-path-heading"
      className="border-b border-mit-line bg-background"
    >
      <div className="mx-auto grid w-full max-w-7xl items-start gap-8 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-12 lg:py-14">
        <div className="max-w-xl min-w-0">
          <SailPathSwitch knowsHow={knowsHow} onChange={setKnowsHow} />
          <div className="mt-6">
            {knowsHow ? (
              <ExperiencedSailorPanel
                scheduleSummary={props.scheduleSummary}
                sessions={props.experiencedSessions}
              />
            ) : (
              <NewSailorPanel
                joinWaitlistAction={props.joinWaitlistAction}
                waitlist={props.waitlist}
              />
            )}
          </div>
        </div>
        <HomeSailPathCollage />
      </div>
    </section>
  );
}
