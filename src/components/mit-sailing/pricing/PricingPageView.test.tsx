import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('renders pricing columns and included classes', async () => {
    const user = userEvent.setup();

    renderPricingPage();

    expect(
      screen.getByRole('heading', { name: 'Choose your sailing card' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT students and people with an MIT Gym membership choose Normal. Need a gym membership? Plans start at $528/year. See MIT Gym pricing before you request your card.'
      )
    ).toBeInTheDocument();
    const pricingChart = screen.getByRole('table', { name: 'Pricing chart' });
    expect(
      within(pricingChart).getByRole('columnheader', {
        name: /Normal/u,
      })
    ).toBeInTheDocument();
    expect(
      within(pricingChart).getByRole('columnheader', {
        name: /Spring racing card/u,
      })
    ).toBeInTheDocument();
    expect(
      within(pricingChart).getByRole('columnheader', {
        name: /Full-year racing card/u,
      })
    ).toBeInTheDocument();
    expect(
      within(pricingChart).getByRole('columnheader', {
        name: /Thursday team racing/u,
      })
    ).toBeInTheDocument();
    expect(within(pricingChart).getAllByText('Free').length).toBeGreaterThan(0);
    expect(
      within(pricingChart).getAllByText(
        'Pavilion, classes, ratings, racing, Mashnee.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('table', { name: 'Paid-card prices' })
    ).not.toBeInTheDocument();
    expect(
      within(pricingChart).getByRole('row', {
        name: /Intro Sailing 101 Included - - -/u,
      })
    ).toBeInTheDocument();
    expect(
      within(pricingChart).getByRole('row', {
        name: /Intro to Racing Included Included Included -/u,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Annual membership rates' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Sailing cards renew each July 15. After renewal, request your next card before picking up a new card number.'
      )
    ).toBeInTheDocument();
    const gymRateButtons = screen.getAllByRole('button', {
      name: 'See MIT Gym pricing',
    });
    const [gymRateButton] = gymRateButtons;
    if (!gymRateButton) {
      throw new Error('Missing MIT Gym rates button');
    }
    await user.click(gymRateButton);
    const ratesDialog = screen.getByRole('dialog', {
      name: 'Annual membership rates',
    });
    expect(
      within(ratesDialog).getAllByText('MIT student').length
    ).toBeGreaterThan(0);
    const ratesDialogText = ratesDialog.textContent ?? '';
    expect(ratesDialogText.indexOf('MIT student family')).toBeGreaterThan(
      ratesDialogText.indexOf('MIT student')
    );
    expect(within(ratesDialog).getAllByText('Included').length).toBeGreaterThan(
      0
    );
    expect(
      within(ratesDialog).getAllByText('$1,968/year').length
    ).toBeGreaterThan(0);
    expect(
      within(ratesDialog).getAllByText('$264/year').length
    ).toBeGreaterThan(0);
    expect(
      within(ratesDialog).getAllByText('Spouse/partner + eligible children.')
        .length
    ).toBeGreaterThan(0);
    expect(within(ratesDialog).getAllByText(/Takeda/u).length).toBeGreaterThan(
      0
    );
    expect(
      within(ratesDialog).getAllByText('General public (Friends of MIT)').length
    ).toBeGreaterThan(0);
    expect(
      within(ratesDialog).queryByText(/General public memberships use Friends/u)
    ).not.toBeInTheDocument();
    expect(
      within(ratesDialog).queryByText(/Family covers a spouse or partner/u)
    ).not.toBeInTheDocument();
    expect(
      within(ratesDialog).queryByText(
        /Review MIT Recreation membership policies/u
      )
    ).not.toBeInTheDocument();
    expect(
      within(ratesDialog).queryByRole('link', { name: 'Membership policies' })
    ).not.toBeInTheDocument();
    expect(
      within(ratesDialog).getByRole('link', {
        name: 'MIT Gym rates and access hours are subject to change.',
      })
    ).toHaveAttribute('href', 'https://www.mitrecsports.com/join/memberships/');
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
