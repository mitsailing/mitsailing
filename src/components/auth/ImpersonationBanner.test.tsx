import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpersonationBanner } from './ImpersonationBanner';

const impersonationMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getTranslations: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: impersonationMocks.getTranslations,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: impersonationMocks.getSession,
}));

vi.mock('./StopImpersonationButton', () => ({
  StopImpersonationButton: (props: { label: string; locale: string }) => (
    <button data-locale={props.locale} type="button">
      {props.label}
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  impersonationMocks.getTranslations.mockImplementation(
    async (props: { namespace: string }) => {
      await Promise.resolve();
      return (key: string) => `${props.namespace}.${key}`;
    }
  );
});

describe('ImpersonationBanner', () => {
  it('visitor sees no impersonation banner', async () => {
    impersonationMocks.getSession.mockResolvedValue(null);

    const banner = await ImpersonationBanner({ locale: 'en' });

    expect(banner).toBeNull();
    expect(impersonationMocks.getTranslations).not.toHaveBeenCalled();
  });

  it('sailor sees no impersonation banner outside impersonation', async () => {
    impersonationMocks.getSession.mockResolvedValue({
      session: { impersonatedBy: null },
    });

    const banner = await ImpersonationBanner({ locale: 'en' });

    expect(banner).toBeNull();
  });

  it('impersonating admin sees a banner with exit control', async () => {
    impersonationMocks.getSession.mockResolvedValue({
      session: { impersonatedBy: 'admin-1' },
    });

    render(await ImpersonationBanner({ locale: 'en' }));

    expect(impersonationMocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'AccountLayout',
    });
    expect(screen.getByRole('region')).toHaveTextContent(
      'AccountLayout.impersonation_notice'
    );
    expect(
      screen.getByRole('button', { name: 'AccountLayout.impersonation_exit' })
    ).toHaveAttribute('data-locale', 'en');
  });
});
