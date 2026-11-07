'use client';

import { useTranslations } from 'next-intl';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import { SiteBrandLogo } from './SiteBrandLogo';

/**
 * Official logo for centered auth routes — placed above the page title.
 *
 * @returns Centered link to the home page
 */
export function AuthCenterBrandMark() {
  const t = useTranslations('MitSailingSite');

  return (
    <div className="flex justify-center">
      <Link
        aria-label={`${t('site_brand_mit')} ${t('site_brand_sailing')}`}
        className={`inline-flex cursor-pointer items-center gap-2 no-underline ${textFocusRingClassName}`}
        href="/"
      >
        <SiteBrandLogo />
      </Link>
    </div>
  );
}
