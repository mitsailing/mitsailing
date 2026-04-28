import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

type AuthCenterBrandMarkProps = {
  locale: string;
};

/**
 * MIT Sailing wordmark for centered auth routes — placed above the page title,
 * visually aligned with the column (same typography as SiteHeader).
 *
 * @param props - Brand props
 * @param props.locale - Active UI locale
 * @returns Centered link to the home page
 */
export async function AuthCenterBrandMark(props: AuthCenterBrandMarkProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingSite',
  });

  return (
    <div className="flex justify-center">
      <Link
        className={`inline-flex cursor-pointer items-center gap-2 no-underline ${textFocusRingClassName}`}
        href="/"
      >
        <div className="font-mit-serif text-[22px] font-bold tracking-tight text-mit-red">
          {t('site_brand_mit')}
          <span className="ml-1 text-mit-text">{t('site_brand_sailing')}</span>
        </div>
      </Link>
    </div>
  );
}
