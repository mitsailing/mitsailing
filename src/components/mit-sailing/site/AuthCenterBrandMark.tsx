'use client';

import { useTranslations } from 'next-intl';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import { SiteBrandWordmarkTypography } from './SiteBrandWordmarkTypography';

/**
 * MIT Sailing wordmark for centered auth routes — placed above the page title,
 * visually aligned with the column (same typography as SiteHeader).
 *
 * @returns Centered link to the home page
 */
export function AuthCenterBrandMark() {
  const t = useTranslations('MitSailingSite');

  return (
    <div className="flex justify-center">
      <Link
        className={`inline-flex cursor-pointer items-center gap-2 no-underline ${textFocusRingClassName}`}
        href="/"
      >
        <SiteBrandWordmarkTypography
          mitLabel={t('site_brand_mit')}
          sailingLabel={t('site_brand_sailing')}
          variant="auth"
        />
      </Link>
    </div>
  );
}
