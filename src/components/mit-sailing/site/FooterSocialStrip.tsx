import { getTranslations } from 'next-intl/server';
import { footerSocialIconPaths } from '@/data/mit-sailing/footerSocialIcons';
import type { SocialNetwork } from '@/data/mit-sailing/footerSocialSeed';
import { footerSocialGroups } from '@/data/mit-sailing/footerSocialSeed';
import {
  footerHorizontalRuleClassName,
  footerSocialGroupLabelClassName,
  footerSocialIconButtonClassName,
} from '@/lib/mit-sailing/tokens';

function SocialIcon({ network }: { network: SocialNetwork }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 fill-current"
      viewBox="0 0 24 24"
    >
      <path d={footerSocialIconPaths[network]} />
    </svg>
  );
}

/**
 * Social links strip shown at the top of the site footer. Copy: `en.json` (`MitSailingSite`); data: `footerSocialSeed`.
 *
 * @returns Group-labeled social icon row
 */
export async function FooterSocialStrip() {
  const t = await getTranslations('MitSailingSite');

  return (
    <div className="mb-12 flex items-center gap-4 md:gap-6">
      <div aria-hidden="true" className={footerHorizontalRuleClassName} />
      <div className="w-full max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-6">
          {footerSocialGroups.map((group) => (
            <div
              className="flex min-w-0 items-center gap-4 whitespace-nowrap sm:gap-3"
              key={group.groupLabelKey}
            >
              <span
                className={`${footerSocialGroupLabelClassName} leading-snug`}
              >
                {t(group.groupLabelKey)}
              </span>
              <div
                aria-label={t(group.groupAriaLabelKey)}
                className="flex flex-nowrap items-center gap-2 sm:gap-3"
              >
                {group.links.map((link) => (
                  <a
                    aria-label={t(link.ariaLabelKey)}
                    className={footerSocialIconButtonClassName}
                    href={link.href}
                    key={`${group.groupLabelKey}-${link.network}-${link.href}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <SocialIcon network={link.network} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={footerHorizontalRuleClassName} />
    </div>
  );
}
