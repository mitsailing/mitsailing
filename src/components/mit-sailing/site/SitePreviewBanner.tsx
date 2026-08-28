import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';

function previewBannerLink(chunks: React.ReactNode) {
  return (
    <a
      className={`font-semibold text-mit-red underline underline-offset-2 hover:text-mit-red-hover ${textFocusRingClassName} dark:text-mit-red-ink`}
      href="https://sailing.mit.edu"
    >
      {chunks}
    </a>
  );
}

/**
 * Async preview banner copy. Render via `SitePreviewBannerSlot` so layouts
 * can stream this work inside Suspense.
 *
 * @returns Preview banner markup
 */
export async function SitePreviewBanner() {
  const t = await getTranslations('MitSailingSite');

  return (
    <aside className="block border-b border-mit-red/20 bg-mit-red-highlight px-4 py-2 text-center text-xs font-medium text-mit-text sm:text-sm dark:border-mit-red/30 dark:bg-mit-red-950/45">
      <p className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="inline-flex shrink-0 rounded-sm bg-mit-red px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white uppercase">
          {t('preview_banner_tag')}
        </span>
        <span>
          {t.rich('preview_banner', {
            link: previewBannerLink,
          })}
        </span>
      </p>
    </aside>
  );
}
