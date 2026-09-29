import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  HomeSailPathExperiencedSession,
  HomeSailPathScheduleSummary,
  HomeSailPathWaitlistState,
} from '@/libs/mit-sailing/homeSailPathSchedule';
import { HomeSailPath } from './HomeSailPath';

const sampleSessions: HomeSailPathExperiencedSession[] = [
  {
    dateLabel: 'Tue, Sep 29',
    href: '/events/intro-experienced-sep-29',
    id: 'date-1',
  },
  {
    dateLabel: 'Tue, Oct 6',
    href: '/events/intro-experienced-oct-6',
    id: 'date-2',
  },
  {
    dateLabel: 'Tue, Oct 13',
    href: '/events/intro-experienced-oct-13',
    id: 'date-3',
  },
  {
    dateLabel: 'Tue, Oct 20',
    href: '/events/intro-experienced-oct-20',
    id: 'date-4',
  },
];

const sampleSchedule: HomeSailPathScheduleSummary = {
  durationMinutes: 90,
  time: '5:00 PM',
  weekdayPlural: 'Tuesdays',
};

async function noopJoinWaitlistAction(): Promise<void> {
  await Promise.resolve();
}

function renderSailPath(options?: {
  readonly joinWaitlistAction?: () => Promise<void>;
  readonly sessions?: readonly HomeSailPathExperiencedSession[];
  readonly scheduleSummary?: HomeSailPathScheduleSummary | null;
  readonly waitlist?: HomeSailPathWaitlistState;
}) {
  render(
    <HomeSailPath
      experiencedSessions={options?.sessions ?? sampleSessions}
      joinWaitlistAction={options?.joinWaitlistAction ?? noopJoinWaitlistAction}
      scheduleSummary={
        options?.scheduleSummary === undefined
          ? sampleSchedule
          : options.scheduleSummary
      }
      waitlist={options?.waitlist ?? { kind: 'anonymous' }}
    />
  );
}

describe('HomeSailPath', () => {
  it('shows the new sailor waitlist signup link when logged out', () => {
    renderSailPath();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sail the Charles River.' })
    ).toBeInTheDocument();
    const waitlist = screen.getByRole('link', { name: 'Join the waitlist' });
    expect(waitlist).toHaveAttribute('href', '/signup?callbackUrl=%2F');
    expect(waitlist).toHaveAttribute('data-variant', 'mit');
    expect(screen.getByText('Learn-to-Sail Waitlist')).toBeInTheDocument();
    expect(screen.queryByText('PE Beginner Sailing')).not.toBeInTheDocument();
    expect(screen.queryByText('Mid-Week 1-2-3')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Take the Intro orientation/ })
    ).not.toBeInTheDocument();
  });

  it('submits the join waitlist action when logged in and eligible', async () => {
    const user = userEvent.setup();
    const joinWaitlistAction = vi.fn(noopJoinWaitlistAction);
    renderSailPath({
      joinWaitlistAction,
      waitlist: { kind: 'join' },
    });

    await user.click(screen.getByRole('button', { name: 'Join the waitlist' }));

    expect(joinWaitlistAction).toHaveBeenCalledTimes(1);
  });

  it('shows the closed message before April 1', () => {
    renderSailPath({ waitlist: { kind: 'closed' } });

    expect(
      screen.getByText('The annual waitlist opens April 1.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Join the waitlist' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Join the waitlist' })
    ).not.toBeInTheDocument();
  });

  it('shows waitlist place instead of a join control when already listed', () => {
    renderSailPath({ waitlist: { kind: 'position', position: 42 } });

    expect(
      screen.getByText("You're #42 on this season's Learn-to-Sail Waitlist")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Join the waitlist' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Join the waitlist' })
    ).not.toBeInTheDocument();
  });

  it('switches to the experienced orientation with linked session dates', async () => {
    const user = userEvent.setup();
    renderSailPath();

    await user.click(
      screen.getByRole('radio', { name: 'Experienced Sailors' })
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Know how to sail? Take the Intro orientation.',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Introduction for Experienced Sailors',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Tuesdays, 5:00 PM')).toBeInTheDocument();
    expect(screen.getByText(/about 90 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tue, Sep 29' })).toHaveAttribute(
      'href',
      '/events/intro-experienced-sep-29'
    );
    expect(screen.getByRole('link', { name: 'Tue, Oct 20' })).toHaveAttribute(
      'href',
      '/events/intro-experienced-oct-20'
    );
    expect(
      screen.queryByRole('link', { name: 'Join the waitlist' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Request a spot' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/before publishing/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Experienced Sailors' })
    ).toBeChecked();
  });

  it('links to the events list when no upcoming orientations exist', async () => {
    const user = userEvent.setup();
    renderSailPath({ sessions: [], scheduleSummary: null });

    await user.click(
      screen.getByRole('radio', { name: 'Experienced Sailors' })
    );

    expect(
      screen.getByRole('link', { name: 'See upcoming orientations' })
    ).toHaveAttribute('href', '/events');
    expect(screen.queryByText('Tuesdays, 5:00 PM')).not.toBeInTheDocument();
  });

  it('moves the path with the arrow keys', async () => {
    const user = userEvent.setup();
    renderSailPath();

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(
      screen.getByRole('radio', { name: 'Experienced Sailors' })
    ).toHaveFocus();
    expect(screen.getByText('No waitlist.')).toBeInTheDocument();
  });
});
