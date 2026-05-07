'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/libs/I18nNavigation';

/**
 * MITNA vertical links (client): used inside {@link MitnaSubNavLayout} and Storybook.
 *
 * @returns Localized sidebar nav
 */
export function MitnaSubNavColumn() {
  const t = useTranslations('MitSailingRoutes');
  return (
    <nav
      className="flex flex-col gap-1 border-border md:border-r md:pe-6"
      aria-label={t('mitna_subnav_aria')}
    >
      <Link
        className="rounded-md px-2 py-1.5 text-foreground hover:bg-muted"
        href="/about/mitna/"
      >
        {t('mitna_nav_root')}
      </Link>
      <Link
        className="rounded-md px-2 py-1.5 text-foreground hover:bg-muted"
        href="/about/mitna/constitution/"
      >
        {t('mitna_nav_constitution')}
      </Link>
      <Link
        className="rounded-md px-2 py-1.5 text-foreground hover:bg-muted"
        href="/about/mitna/meetings/"
      >
        {t('mitna_nav_meetings')}
      </Link>
      <Link
        className="rounded-md px-2 py-1.5 text-foreground hover:bg-muted"
        href="/about/mitna/hatch-award/"
      >
        {t('mitna_nav_hatch')}
      </Link>
    </nav>
  );
}
