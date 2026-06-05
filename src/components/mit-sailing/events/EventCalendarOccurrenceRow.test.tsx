import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import { EventCalendarOccurrenceRow } from './EventCalendarOccurrenceRow';

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

const row = {
  category: {
    accentClassName: 'bg-mit-red',
    id: 'cat-1',
    name: 'Clinic',
  },
  displayDayKey: '2026-04-07',
  end: new Date('2026-04-07T20:00:00.000Z'),
  event: {
    category: {
      accentClassName: 'bg-mit-red',
      id: 'cat-1',
      name: 'Clinic',
    },
    eventCategoryId: 'cat-1',
    id: 'event-1',
    learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
    name: 'A very long event name that must remain visible in the calendar cell',
    shortName: 'Long event',
    slug: 'long-event',
  },
  eventDate: {
    endDateTime: new Date('2026-04-07T20:00:00.000Z'),
    event: {
      category: {
        accentClassName: 'bg-mit-red',
        id: 'cat-1',
        name: 'Clinic',
      },
      eventCategoryId: 'cat-1',
      id: 'event-1',
      learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
      name: 'A very long event name that must remain visible in the calendar cell',
      shortName: 'Long event',
      slug: 'long-event',
    },
    id: 'date-1',
    startDateTime: new Date('2026-04-07T14:00:00.000Z'),
  },
  listSegment: 'single' as const,
  rowKey: 'date-1-2026-04-07-single',
  start: new Date('2026-04-07T14:00:00.000Z'),
};

function expectElementBefore(first: HTMLElement, second: HTMLElement) {
  const elements = [...first.ownerDocument.body.querySelectorAll('*')];

  expect(elements.indexOf(first)).toBeLessThan(elements.indexOf(second));
}

describe('EventCalendarOccurrenceRow', () => {
  it('uses the event short name in dense calendar cells', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    const link = screen.getByRole('link', { name: 'Long event' });

    expect(link).not.toHaveAttribute('title');
    expect(
      screen.queryByText(
        'A very long event name that must remain visible in the calendar cell'
      )
    ).not.toBeInTheDocument();
  });

  it('links to event detail pages without a trailing slash redirect', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    expect(screen.getByRole('link', { name: 'Long event' })).toHaveAttribute(
      'href',
      '/events/long-event'
    );
  });

  it('shows the category next to the calendar occurrence', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    expect(screen.getByText('Clinic')).toBeVisible();
  });

  it('shows the event time before the event title for quick scanning', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    const time = screen.getByText(/10:00 AM.*4:00 PM/u);
    const title = screen.getByRole('link', { name: 'Long event' });
    const category = screen.getByText('Clinic');

    expectElementBefore(time, title);
    expectElementBefore(title, category);
  });

  it('shows a translated waitlist-number cue for managed classes', () => {
    render(
      <EventCalendarOccurrenceRow
        learnToSailWaitlistLabel="Waitlist number decides"
        row={{
          ...row,
          event: {
            ...row.event,
            learnToSailManagedClassKind:
              LearnToSailManagedClassKind.beginner_mid_week_123,
          },
        }}
        showBottomBorder
        wrapTitle
      />
    );

    expect(screen.getByText('Waitlist number decides')).toBeVisible();
  });
});
