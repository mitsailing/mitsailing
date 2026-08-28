import { Suspense } from 'react';
import { Env } from '@/libs/Env';
import { SitePreviewBanner } from './SitePreviewBanner';

/**
 * Sync preview gate with a Suspense boundary for the async banner body.
 * Matches Next.js layout guidance: stream runtime/i18n work without blocking
 * the rest of the shell.
 *
 * Delete this file (and `SitePreviewBanner`) at go-live.
 *
 * @returns Preview banner slot, or null when disabled
 */
export function SitePreviewBannerSlot() {
  if (Env.STAGING_BANNER !== 'yes') {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <SitePreviewBanner />
    </Suspense>
  );
}
