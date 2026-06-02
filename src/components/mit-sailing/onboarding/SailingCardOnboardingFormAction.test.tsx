import { describe, expect, it, vi } from 'vitest';
import { submitSailingCardOnboardingAction } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { defaultSailingCardOnboardingAction } from './SailingCardOnboardingForm';

vi.mock('@/libs/mit-sailing/sailingCardOnboardingActions', () => ({
  submitSailingCardOnboardingAction: vi.fn(),
  verifySailingCardOnboardingMitIdentityAction: vi.fn(),
}));

describe('SailingCardOnboardingForm default action', () => {
  it('uses submit onboarding action by default', () => {
    expect(defaultSailingCardOnboardingAction).toBe(
      submitSailingCardOnboardingAction
    );
  });
});
