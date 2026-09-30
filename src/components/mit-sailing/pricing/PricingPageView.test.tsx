import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mitRecreationMembershipHref } from '@/data/mit-sailing/mitRecreationMembership';
import { PricingPageView } from './PricingPageView';

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

vi.mock('next-intl', async () => {
  const importedMessages = await import('@/locales/en.json');
  const messages: Record<string, unknown> = importedMessages.default;

  return {
    useTranslations: (namespace: string) => (key: string) => {
      const namespaceMessages = messages[namespace];
      if (!isStringRecord(namespaceMessages)) {
        return key;
      }

      return namespaceMessages[key] ?? key;
    },
  };
});

function renderPricingPage(options?: { readonly isSignedIn?: boolean }) {
  render(<PricingPageView isSignedIn={options?.isSignedIn ?? false} />);
}

function pricingChart() {
  return screen.getByRole('table', { name: 'Pricing chart' });
}

function expectPricingColumn(name: RegExp) {
  expect(
    within(pricingChart()).getByRole('columnheader', { name })
  ).toBeInTheDocument();
}

function mitRecreationRateLinks() {
  return screen.getAllByRole('link', {
    name: /See MIT Recreation rates/u,
  });
}

describe('PricingPageView', () => {
  it('sends guests to sign up before onboarding', () => {
    renderPricingPage();

    expect(
      screen.getAllByRole('link', { name: 'Sign up' }).at(0)
    ).toHaveAttribute('href', '/signup?callbackUrl=%2Fonboarding');
  });

  it('sends signed-in users directly to onboarding', () => {
    renderPricingPage({ isSignedIn: true });

    expect(
      screen.getAllByRole('link', { name: 'Request card' }).at(0)
    ).toHaveAttribute('href', '/onboarding');
  });

  it('renders pricing columns and included classes', () => {
    renderPricingPage();

    expect(
      screen.getByRole('heading', { name: 'Choose your sailing card' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT students and MIT Recreation members choose Normal. Need MIT Recreation? Review MIT Recreation rates before you request your card.'
      )
    ).toBeInTheDocument();
    expectPricingColumn(/Normal/u);
    expectPricingColumn(/Full-year racing card/u);
    expectPricingColumn(/Thursday team racing/u);
    expect(within(pricingChart()).getAllByText('Free').length).toBeGreaterThan(
      0
    );
    expect(
      within(pricingChart()).getAllByText(
        'Pavilion, classes, ratings, racing, Mashnee.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('table', { name: 'Paid-card prices' })
    ).not.toBeInTheDocument();
    expect(
      within(pricingChart()).getByRole('row', {
        name: /Intro Sailing 101 Included - -/u,
      })
    ).toBeInTheDocument();
    expect(
      within(pricingChart()).getByRole('row', {
        name: /Intro to Racing Included Included -/u,
      })
    ).toBeInTheDocument();
  });

  it('summarizes annual onboarding timing on the page', () => {
    renderPricingPage();

    expect(
      screen.getByText(
        'Sailing-card pricing resets each July 15. Complete onboarding and pay again before picking up a new card number.'
      )
    ).toBeInTheDocument();
  });

  it('links MIT Recreation rates from the Normal plan only', () => {
    renderPricingPage();

    const rateLinks = mitRecreationRateLinks();
    expect(rateLinks).toHaveLength(2);
    for (const link of rateLinks) {
      expect(link).toHaveAttribute('href', mitRecreationMembershipHref);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    const normalCard = screen.getByRole('region', { name: 'Normal' });
    expect(
      within(normalCard).getByRole('link', {
        name: /See MIT Recreation rates/u,
      })
    ).toBeInTheDocument();
    expect(normalCard).toHaveTextContent('opens in a new tab');
    expect(
      within(
        screen.getByRole('region', { name: 'Full-year racing card' })
      ).queryByRole('link', {
        name: /See MIT Recreation rates/u,
      })
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Thursday team racing' })
      ).queryByRole('link', {
        name: /See MIT Recreation rates/u,
      })
    ).not.toBeInTheDocument();
  });

  it('shows Mashnee in the Normal card', () => {
    renderPricingPage();

    expect(screen.getAllByText(/Mashnee/u).length).toBeGreaterThan(0);
  });

  it('keeps Thursday team racing separate from Pavilion classes', () => {
    renderPricingPage();

    expect(
      screen.queryByText('Races from sailing.mit.edu calendar')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Advanced, intermediate, and learn-to-race events')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Thursday team racing/u })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('For Thursday team racing on the Charles River.')
        .length
    ).toBeGreaterThan(0);
  });

  it('shows paid-card exact price categories without MIT student as paid category', () => {
    renderPricingPage();

    expect(screen.getAllByText('Non-MIT student').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Under 30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30+').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Non-student/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'MIT student' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Card prices are confirmed/u)
    ).not.toBeInTheDocument();
  });
});
