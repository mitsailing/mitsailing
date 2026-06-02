import { setRequestLocale } from 'next-intl/server';
import type * as React from 'react';
import { SailingCardOnboardingDraftProvider } from '@/components/mit-sailing/onboarding/SailingCardOnboardingDraftProvider';

/**
 * Focused onboarding chrome. Sailing-card onboarding is a task flow, so it
 * intentionally skips the public marketing header and footer.
 *
 * @param props - Layout props
 * @param props.children - Nested onboarding routes
 * @param props.params - Dynamic locale params
 * @returns Onboarding task shell with draft persistence
 */
export default async function OnboardingSegmentLayout(props: {
  readonly children: React.ReactNode;
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <SailingCardOnboardingDraftProvider>
      {props.children}
    </SailingCardOnboardingDraftProvider>
  );
}
