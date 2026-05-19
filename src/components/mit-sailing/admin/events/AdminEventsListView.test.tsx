import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/locales/en.json';
import { AdminEventsListView } from './AdminEventsListView';

vi.mock('server-only', () => ({}));

vi.mock('@/libs/admin/events/eventAdminQueries', () => ({
  adminEventListScopeFromValue: (value: string | undefined) =>
    value === 'all' ? 'all' : 'my',
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

describe('AdminEventsListView', () => {
  it('uses the event name as the canonical show page link without row action buttons', () => {
    render(
      <AdminEventsListView
        categories={[]}
        filterAction="/admin/events"
        filters={{}}
        rows={[
          {
            accessMode: 'editable',
            category: { id: 'category-1', name: 'Clinic' },
            dates: [],
            detailPageKind: 'standard',
            id: 'event-1',
            isPublished: true,
            isSpecial: false,
            maxParticipants: 12,
            name: 'Intro Sail',
            registrationCounts: {
              approved: 3,
              cancelled: 0,
              pending: 2,
            },
            requiresApproval: true,
            requiresPhone: false,
            shortName: 'Intro',
            slug: 'intro-sail',
          },
        ]}
        t={t}
      />
    );

    const table = screen.getByRole('table');

    expect(
      within(table).getByRole('link', { name: 'Intro Sail' })
    ).toHaveAttribute('href', '/admin/events/intro-sail');
    expect(within(table).queryByRole('link', { name: /view/i })).toBeNull();
    expect(within(table).queryByRole('link', { name: /edit/i })).toBeNull();
    expect(
      within(table).queryByRole('link', { name: /registrations/i })
    ).toBeNull();
    expect(within(table).queryByRole('link', { name: /delete/i })).toBeNull();
  });
});
