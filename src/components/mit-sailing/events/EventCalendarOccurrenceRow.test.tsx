import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    name: 'A very long event name that must remain visible in the calendar cell',
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
      name: 'A very long event name that must remain visible in the calendar cell',
      slug: 'long-event',
    },
    id: 'date-1',
    startDateTime: new Date('2026-04-07T14:00:00.000Z'),
  },
  listSegment: 'single' as const,
  rowKey: 'date-1-2026-04-07-single',
  start: new Date('2026-04-07T14:00:00.000Z'),
};

describe('EventCalendarOccurrenceRow', () => {
  it('does not depend on native title hover for full event names', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    const link = screen.getByRole('link', {
      name: 'A very long event name that must remain visible in the calendar cell',
    });

    expect(link).not.toHaveAttribute('title');
    expect(link).toHaveClass('whitespace-normal');
  });

  it('shows the category next to the calendar occurrence', () => {
    render(<EventCalendarOccurrenceRow row={row} showBottomBorder wrapTitle />);

    expect(screen.getByText('Clinic')).toBeVisible();
  });
});
