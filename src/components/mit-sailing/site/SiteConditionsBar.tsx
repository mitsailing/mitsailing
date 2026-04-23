import { Droplets, Sunset, Thermometer, Wind } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { conditionsBarUtilityLinks } from '@/data/mit-sailing/conditionsBarSeed';
import { Link } from '@/libs/I18nNavigation';

const utilityLinkClassName =
  'text-xs font-medium text-mit-red no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2';

const conditionsLineRows = [
  { lineKey: 'conditions_line_wind' as const, Icon: Wind },
  { lineKey: 'conditions_line_air' as const, Icon: Thermometer },
  { lineKey: 'conditions_line_water' as const, Icon: Droplets },
  { lineKey: 'conditions_line_sunset' as const, Icon: Sunset },
] as const;

/**
 * Top weather/conditions strip. Line copy: `en.json` (`MitSailingSite`); right-side link targets: `conditionsBarSeed`.
 *
 * @returns Conditions + utility row
 */
export async function SiteConditionsBar() {
  const t = await getTranslations('MitSailingSite');

  return (
    <div className="border-b border-mit-line bg-mit-surface pt-4 pb-2 sm:py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6">
        <a
          aria-label={t('conditions_weather_link_aria')}
          className="min-w-0 flex-1 cursor-pointer rounded-sm text-xs text-mit-text no-underline focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
          href="https://sailing.mit.edu/weather/"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-6">
            {conditionsLineRows.map((row) => {
              const { Icon, lineKey } = row;
              return (
                <div className="flex items-center gap-1.5" key={lineKey}>
                  <Icon aria-hidden="true" size={14} />
                  {t(lineKey)}
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
              {t(u.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
