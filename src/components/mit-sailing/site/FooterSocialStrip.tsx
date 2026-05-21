import { footerSocialIconPaths } from '@/data/mit-sailing/footerSocialIcons';
import type { SocialNetwork } from '@/data/mit-sailing/footerSocialSeed';
import {
  footerHorizontalRuleClassName,
  footerSocialGroupLabelClassName,
  footerSocialIconButtonClassName,
} from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';

export type FooterSocialStripGroup = {
  id: string;
  label: string;
  links: {
    id: string;
    label: string;
    href: string;
    network?: string;
  }[];
};

function isSocialNetwork(
  network: string | undefined
): network is SocialNetwork {
  return network !== undefined && Object.hasOwn(footerSocialIconPaths, network);
}

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
 * Social links strip shown at the top of the site footer.
 *
 * @param props - CMS social groups and localized aria suffix
 * @returns Group-labeled social icon row
 */
export function FooterSocialStrip(props: {
  groups: FooterSocialStripGroup[];
  socialLinksLabel: string;
}) {
  if (props.groups.length === 0) {
    return null;
  }
  return (
    <div className="mb-12 flex items-center gap-4 md:gap-6">
      <div aria-hidden="true" className={footerHorizontalRuleClassName} />
      <div className="w-full max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-6">
          {props.groups.map((group) => (
            <div
              className="flex min-w-0 items-center gap-4 whitespace-nowrap sm:gap-3"
              key={group.id}
            >
              <span
                className={`${footerSocialGroupLabelClassName} leading-snug`}
              >
                {group.label}
              </span>
              <ul
                aria-label={`${group.label} ${props.socialLinksLabel}`}
                className="m-0 flex list-none flex-nowrap items-center gap-2 p-0 sm:gap-3"
              >
                {group.links.map((link) => {
                  const href = safeCmsHref(link.href);
                  if (!href) {
                    return null;
                  }
                  const label = link.label.trim() || href;
                  const icon = isSocialNetwork(link.network) ? (
                    <SocialIcon network={link.network} />
                  ) : (
                    <span className="text-xs font-bold">
                      {label.slice(0, 1)}
                    </span>
                  );
                  if (isAppRelativeCmsHref(href)) {
                    return (
                      <li className="m-0" key={link.id}>
                        <Link
                          aria-label={label}
                          className={footerSocialIconButtonClassName}
                          href={href}
                        >
                          {icon}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li className="m-0" key={link.id}>
                      <a
                        aria-label={label}
                        className={footerSocialIconButtonClassName}
                        href={href}
                        {...externalCmsLinkProps(href)}
                      >
                        {icon}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={footerHorizontalRuleClassName} />
    </div>
  );
}
