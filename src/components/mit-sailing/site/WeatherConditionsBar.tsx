import { Droplets, Sunset, Thermometer, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import { conditionsBarUtilityLinks } from '@/data/mit-sailing/conditionsBarSeed';
import { fetchWeatherHeaderData } from '@/lib/weather';
import type { ParsedWeatherSegments } from '@/lib/weatherParse';
import { FIELD_PLACEHOLDER } from '@/lib/weatherParse';
import { Link } from '@/libs/I18nNavigation';

const utilityLinkClassName =
  'text-xs font-medium text-primary-ink no-underline rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-mit-text dark:hover:text-white';

const conditionsLineRows = [
  {
    lineKey: 'conditions_line_wind' as const,
    Icon: Wind,
    segmentKey: 'windText' as const,
  },
  {
    lineKey: 'conditions_line_air' as const,
    Icon: Thermometer,
    segmentKey: 'airText' as const,
  },
  {
    lineKey: 'conditions_line_water' as const,
    Icon: Droplets,
    segmentKey: 'waterText' as const,
  },
  {
    lineKey: 'conditions_line_sunset' as const,
    Icon: Sunset,
    segmentKey: 'sunsetText' as const,
  },
] as const satisfies readonly {
  lineKey:
    | 'conditions_line_wind'
    | 'conditions_line_air'
    | 'conditions_line_water'
    | 'conditions_line_sunset';
  Icon: LucideIcon;
  segmentKey: keyof ParsedWeatherSegments;
}[];

type MitSiteT = Awaited<ReturnType<typeof getTranslations>>;

export type WeatherConditionsBarProps = {
  tMitSite: MitSiteT;
};

type ChromeProps = {
  placeholders: string[];
  tMitSite: MitSiteT;
};

function displaySegmentText(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : FIELD_PLACEHOLDER;
}

function WeatherConditionsChrome(props: ChromeProps) {
  const { placeholders, tMitSite } = props;

  return (
    <div className="border-b border-mit-line bg-mit-surface pt-4 pb-2 sm:py-2 dark:bg-background dark:backdrop-blur-none">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 sm:px-8">
        <a
          aria-label={tMitSite('conditions_weather_link_aria')}
          className="min-w-0 flex-1 cursor-pointer rounded-sm text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:text-mit-text dark:hover:text-white"
          href="https://sailing.mit.edu/weather/"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-6">
            {conditionsLineRows.map((row, idx) => {
              const { Icon, lineKey } = row;
              const slotValue = placeholders[idx] ?? FIELD_PLACEHOLDER;

              return (
                <div className="flex items-center gap-1.5" key={lineKey}>
                  <Icon aria-hidden="true" size={14} />
                  {tMitSite(lineKey, { value: slotValue })}
                </div>
              );
            })}
          </div>
        </a>
        <div className="ml-auto hidden shrink-0 items-center gap-x-4 gap-y-2 lg:flex">
          {conditionsBarUtilityLinks.map((u) => (
            <Link
              className={utilityLinkClassName}
              href={u.href}
              key={u.labelKey}
            >
              {tMitSite(u.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Sync shell for Suspense: mirrors [`WeatherConditionsBar`] with placeholders.
 *
 * @param props - Passed-through copy for `MitSailingSite`
 * @returns Markup for the strip
 */
export function WeatherConditionsBarSkeleton(props: WeatherConditionsBarProps) {
  const placeholders = conditionsLineRows.map(() => FIELD_PLACEHOLDER);
  return (
    <WeatherConditionsChrome
      placeholders={placeholders}
      tMitSite={props.tMitSite}
    />
  );
}

/**
 * Top weather strip: MIT `weather.txt` via [`fetchWeatherHeaderData`].
 *
 * @param props - Passed-through copy for `MitSailingSite`
 * @returns Full conditions markup
 */
export async function WeatherConditionsBar(props: WeatherConditionsBarProps) {
  const data = await fetchWeatherHeaderData();
  const placeholders = conditionsLineRows.map((row) =>
    displaySegmentText(data[row.segmentKey])
  );

  return (
    <WeatherConditionsChrome
      placeholders={placeholders}
      tMitSite={props.tMitSite}
    />
  );
}
