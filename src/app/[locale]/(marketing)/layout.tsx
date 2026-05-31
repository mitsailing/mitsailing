import { setRequestLocale } from 'next-intl/server';
import { SailingCardOnboardingDraftProvider } from '@/components/mit-sailing/onboarding/SailingCardOnboardingDraftProvider';
import { SiteShell } from '@/components/mit-sailing/SiteShell';

/**
 * Marketing segment: locale plus shared pavilion chrome. Nested route groups
 * keep their page organization without remounting the shell:
 * - `(home)` — landing (`/`)
 * - `(site)` — standard public site pages
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 * @param props - Layout props
 * @param props.children - Nested route segments
 * @param props.params - Dynamic `[locale]` params
 * @returns Marketing tree with request locale configured and shared chrome
 */
export default async function MarketingSegmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <SailingCardOnboardingDraftProvider>
      <SiteShell>{props.children}</SiteShell>
    </SailingCardOnboardingDraftProvider>
  );
}
