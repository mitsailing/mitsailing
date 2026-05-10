import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavigationDropdown } from './NavigationDropdown';

const dropdownItems = [
  {
    label: 'Introduction',
    href: '/classes#introduction',
    description: 'Start here',
  },
  { label: 'Windsurfing', href: '/classes#windsurfing' },
  { label: 'External guide', externalHref: 'https://example.com/guide' },
];

function renderDropdown(props?: {
  onNavigate?: () => void;
  pathname?: string;
  routeHash?: string;
  variant?: 'desktop' | 'mobile';
}) {
  return render(
    <NavigationDropdown
      href="/classes"
      items={dropdownItems}
      label="Classes"
      pathname={props?.pathname ?? '/'}
      routeHash={props?.routeHash ?? ''}
      variant={props?.variant}
      onNavigate={props?.onNavigate}
    />
  );
}

describe('NavigationDropdown', () => {
  it('opens and closes disclosure on click', async () => {
    const user = userEvent.setup({ skipHover: true });
    renderDropdown();

    const trigger = screen.getByRole('button', { name: 'Classes' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Introduction/u })).toBeVisible();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('prepends overview link when href is present', async () => {
    const user = userEvent.setup({ skipHover: true });
    renderDropdown();

    await user.click(screen.getByRole('button', { name: 'Classes' }));

    const links = screen.getAllByRole('link');
    expect(screen.getByRole('link', { name: 'All Classes' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Introduction/u })).toBeVisible();
    expect(screen.getByText('Start here')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Windsurfing' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'External guide' })).toBeVisible();
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute('href', '/classes');
  });

  it('supports disclosure keyboard flow', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button', { name: 'Classes' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const overview = screen.getByRole('link', { name: 'All Classes' });
    const introduction = screen.getByRole('link', { name: /Introduction/u });
    const windsurfing = screen.getByRole('link', { name: 'Windsurfing' });
    const external = screen.getByRole('link', { name: 'External guide' });

    await waitFor(() => {
      expect(overview).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');
    expect(introduction).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(overview).toHaveFocus();

    await user.keyboard('{End}');
    expect(external).toHaveFocus();

    await user.keyboard('{Home}');
    expect(overview).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(external).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(overview).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowUp}');
    await waitFor(() => {
      expect(external).toHaveFocus();
    });

    await user.keyboard('{Tab}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(windsurfing).not.toHaveFocus();
  });

  it('keeps focus stable for closed Escape and unhandled keys', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button', { name: 'Classes' });
    trigger.focus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('x');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    const overview = screen.getByRole('link', { name: 'All Classes' });
    overview.focus();
    await user.keyboard('x');
    expect(overview).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens and closes desktop dropdown on hover delays', () => {
    vi.useFakeTimers();
    try {
      renderDropdown();

      const trigger = screen.getByRole('button', { name: 'Classes' });
      const wrapper = trigger.parentElement;
      if (!wrapper) {
        throw new Error('Expected dropdown trigger wrapper.');
      }

      fireEvent.mouseEnter(wrapper);
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseLeave(wrapper);
      act(() => {
        vi.advanceTimersByTime(140);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.mouseLeave(wrapper);
      act(() => {
        vi.advanceTimersByTime(140);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores arrow focus when no submenu items exist', async () => {
    const user = userEvent.setup();
    render(
      <NavigationDropdown
        items={[]}
        label="Resources"
        pathname="/"
        routeHash=""
      />
    );

    const trigger = screen.getByRole('button', { name: 'Resources' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
    expect(trigger).toHaveFocus();
  });

  it('dismisses desktop dropdown on outside pointer and focus', async () => {
    const user = userEvent.setup({ skipHover: true });
    render(
      <>
        <NavigationDropdown
          href="/classes"
          items={dropdownItems}
          label="Classes"
          pathname="/"
          routeHash=""
        />
        <button type="button">Outside</button>
      </>
    );

    const trigger = screen.getByRole('button', { name: 'Classes' });
    const outside = screen.getByRole('button', { name: 'Outside' });

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(outside);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.focusIn(outside);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks active dropdown children with aria-current', async () => {
    const user = userEvent.setup({ skipHover: true });
    renderDropdown({ pathname: '/classes', routeHash: 'windsurfing' });

    await user.click(screen.getByRole('button', { name: 'Classes' }));

    expect(screen.getByRole('link', { name: 'Windsurfing' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('link', { name: 'All Classes' })
    ).not.toHaveAttribute('aria-current');
  });

  it('keeps mobile disclosure independent from hover dismissal and calls onNavigate', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { container } = renderDropdown({ onNavigate, variant: 'mobile' });

    const trigger = screen.getByRole('button', { name: 'Classes' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const root = container.firstElementChild;
    if (!root) {
      throw new Error('Expected dropdown root.');
    }
    fireEvent.mouseLeave(root);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('link', { name: /Introduction/u }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders items without an overview link when href is absent', async () => {
    const user = userEvent.setup({ skipHover: true });
    render(
      <NavigationDropdown
        items={dropdownItems}
        label="Resources"
        pathname="/"
        routeHash=""
      />
    );

    await user.click(screen.getByRole('button', { name: 'Resources' }));

    const list = screen.getByRole('list');
    expect(
      within(list).queryByRole('link', { name: 'All Resources' })
    ).not.toBeInTheDocument();
    expect(within(list).getAllByRole('link')).toHaveLength(3);
  });

  it('uses label fallback for items without hrefs', async () => {
    const user = userEvent.setup({ skipHover: true });
    render(
      <NavigationDropdown
        items={[{ label: 'Placeholder' }]}
        label="Resources"
        pathname="/"
        routeHash=""
      />
    );

    await user.click(screen.getByRole('button', { name: 'Resources' }));

    expect(screen.getByRole('link', { name: 'Placeholder' })).toHaveAttribute(
      'href',
      '#'
    );
  });
});
