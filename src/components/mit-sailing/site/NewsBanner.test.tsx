import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsBanner } from '@/components/mit-sailing/site/NewsBanner';
import { resetNewsBannerCollapseStateForTests } from '@/components/mit-sailing/site/useNewsBannerCollapsed';
import { buildNewsBannerCollapseAlerts } from '@/libs/mit-sailing/newsBannerCollapse';
import type { NewsBannerRow } from '@/libs/mit-sailing/newsTypes';
import enMessages from '@/locales/en.json';

const mitSite = enMessages.MitSailingSite;

const firstRow: NewsBannerRow = {
  bodyHtml: '<p>Limited boats available April 18.</p>',
  bodyPlainText: 'Limited boats available April 18.',
  dateIso: '2026-04-14',
  dateLabel: 'Apr 14, 2026',
  id: 'news-1',
};

const rows: NewsBannerRow[] = [
  firstRow,
  {
    bodyHtml: '<p>Priority queue for 2026 is now open.</p>',
    bodyPlainText: 'Priority queue for 2026 is now open.',
    dateIso: '2026-04-13',
    dateLabel: 'Apr 13, 2026',
    id: 'news-2',
  },
];

const collapseAlerts = buildNewsBannerCollapseAlerts(rows);

describe('NewsBanner', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => {
          store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
          return store.size;
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    resetNewsBannerCollapseStateForTests();
    vi.restoreAllMocks();
  });

  it('renders a collapsed summary and disclosure controls by default', () => {
    render(<NewsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.news_banner_heading })
    ).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: /2 news items/u,
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: mitSite.news_toggle_expand_aria,
      })
    ).toBeVisible();
  });

  it('returns null when there are no rows', () => {
    render(<NewsBanner collapseAlerts={[]} rows={[]} />);

    expect(
      screen.queryByRole('heading', { name: mitSite.news_banner_heading })
    ).not.toBeInTheDocument();
  });

  it('still toggles expand when persisting to localStorage throws', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };

    render(<NewsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    await user.click(
      screen.getByRole('button', {
        name: mitSite.news_toggle_expand_aria,
      })
    );

    expect(screen.getByText(firstRow.bodyPlainText)).toBeVisible();
  });

  it('survives localStorage.getItem throwing during hydration', () => {
    window.localStorage.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };

    render(<NewsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.news_banner_heading })
    ).toBeVisible();
  });

  it('keeps one link to news and shows unwrapped body link text', async () => {
    const user = userEvent.setup();
    const linkedRows: NewsBannerRow[] = [
      {
        id: 'news-linked',
        bodyHtml: '<p><strong>Bold</strong> linked text</p>',
        bodyPlainText: 'Bold linked text',
        dateIso: '2026-04-14',
        dateLabel: 'Apr 14, 2026',
      },
    ];

    render(
      <NewsBanner
        collapseAlerts={buildNewsBannerCollapseAlerts(linkedRows)}
        rows={linkedRows}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: mitSite.news_toggle_expand_aria,
      })
    );

    const stripLink = screen.getByRole('link', {
      name: mitSite.news_banner_link_expanded_aria,
    });
    expect(stripLink).toHaveAttribute('href', '/news');
    expect(stripLink.querySelector('a')).toBeNull();
    expect(screen.getByText('Bold')).toBeVisible();
    expect(screen.getByText(/linked text/u)).toBeVisible();
  });
});
