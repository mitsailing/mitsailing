import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import { buildEventCalendarWeeks } from '@/libs/mit-sailing/eventCalendar';
import type { EventCalendarOccurrenceRow } from '@/libs/mit-sailing/eventCalendar';
import messages from '@/locales/en.json';
import { EventsListView } from './EventsListView';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async (options: { locale: string; namespace: keyof typeof messages }) => {
      await Promise.resolve();
      return createTranslator({
        locale: options.locale,
        messages,
        namespace: options.namespace,
      });
    }
  ),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

const category = {
  accentClassName: 'bg-mit-red',
  id: 'category-racing',
  name: 'Racing',
};

function occurrenceRow(): EventCalendarOccurrenceRow {
  const event = {
    category,
    eventCategoryId: category.id,
    id: 'event-1',
    learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
    name: 'Harbor tune-up',
    shortName: 'Tune-up',
    slug: 'harbor-tune-up',
  };
  const eventDate = {
    endDateTime: new Date('2026-04-07T20:00:00.000Z'),
    event,
    id: 'date-1',
    startDateTime: new Date('2026-04-07T14:00:00.000Z'),
  };
  return {
    category,
    displayDayKey: '2026-04-07',
    end: eventDate.endDateTime,
    event,
    eventDate,
    listSegment: 'single',
    rowKey: 'date-1-2026-04-07-single',
    start: eventDate.startDateTime,
  };
}

describe('EventsListView', () => {
  it('renders category filters, month navigation, and occurrence rows', async () => {
    render(
      await EventsListView({
        bounds: { maxMonth: 5, maxYear: 2026, minMonth: 3, minYear: 2026 },
        categories: [
          { displayOrder: 1, id: category.id, name: category.name },
          { displayOrder: 2, id: 'category-classes', name: 'Classes' },
        ],
        currentMonth: { month: 4, year: 2026 },
        locale: 'en',
        occurrenceRows: [occurrenceRow()],
        reference: new Date('2026-04-07T14:00:00.000Z'),
        selectedCategoryId: category.id,
        todayKey: '2026-04-07',
        visibleMonth: { month: 4, year: 2026 },
        weeks: buildEventCalendarWeeks({ month: 4, year: 2026 }),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Events calendar' })
    ).toBeVisible();

    const categoryFilters = screen.getByRole('navigation', {
      name: 'Event category filters',
    });
    expect(
      within(categoryFilters).getByRole('link', { name: 'All categories' })
    ).toHaveAttribute('href', '/events/?month=2026-04');
    expect(
      within(categoryFilters).getByRole('link', { name: 'Racing' })
    ).toHaveAttribute('aria-current', 'true');
    expect(
      within(categoryFilters).getByRole('link', { name: 'Classes' })
    ).toHaveAttribute(
      'href',
      '/events/?month=2026-04&category=category-classes'
    );

    const monthNavigation = screen.getByRole('navigation', {
      name: 'Month navigation',
    });
    expect(
      within(monthNavigation).getByRole('link', { name: 'Previous month' })
    ).toHaveAttribute(
      'href',
      '/events/?month=2026-03&category=category-racing'
    );
    expect(
      within(monthNavigation).getByRole('link', { name: 'Next month' })
    ).toHaveAttribute(
      'href',
      '/events/?month=2026-05&category=category-racing'
    );
    expect(within(monthNavigation).getByText('April 2026')).toBeVisible();

    const calendarGrid = screen.getByRole('region', {
      name: 'Calendar grid, April 2026',
    });
    expect(within(calendarGrid).getByText('7')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Tune-up' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  it('renders an empty mobile state when no rows match the filter', async () => {
    render(
      await EventsListView({
        bounds: { maxMonth: 4, maxYear: 2026, minMonth: 4, minYear: 2026 },
        categories: [{ displayOrder: 1, id: category.id, name: category.name }],
        currentMonth: { month: 4, year: 2026 },
        locale: 'en',
        occurrenceRows: [],
        reference: new Date('2026-04-07T14:00:00.000Z'),
        selectedCategoryId: undefined,
        todayKey: '2026-04-07',
        visibleMonth: { month: 4, year: 2026 },
        weeks: buildEventCalendarWeeks({ month: 4, year: 2026 }),
      })
    );

    expect(
      screen.getByText('No activities match this filter for April 2026.')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Previous month' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });
});
