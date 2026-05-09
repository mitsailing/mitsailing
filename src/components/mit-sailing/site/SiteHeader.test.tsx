import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setComponentTestPathname,
  setComponentTestSearchParams,
} from '@/test/component';
import { SiteHeader } from './SiteHeader';

const authClientMock = vi.hoisted(() => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

const classesDropdownItems = [
  { label: 'Introduction', href: '/classes/#introduction' },
  { label: 'Windsurfing', href: '/classes/#windsurfing' },
];

const fleetDropdownItems = [
  { label: 'Tech Dinghy', href: '/fleet/tech-dinghy/' },
  { label: 'Laser Radial', href: '/fleet/laser-radial/' },
];

function renderHeader(
  props: {
    initialShowAdminLink?: boolean;
    initialSignedIn?: boolean;
  } = {}
) {
  return render(
    <SiteHeader
      classesDropdownItems={classesDropdownItems}
      fleetDropdownItems={fleetDropdownItems}
      initialShowAdminLink={props.initialShowAdminLink}
      initialSignedIn={props.initialSignedIn}
    />
  );
}

function setSessionState(options: { data: unknown; isPending?: boolean }) {
  authClientMock.useSession.mockReturnValue({
    data: options.data,
    isPending: options.isPending ?? false,
  });
}

describe('SiteHeader', () => {
  beforeEach(() => {
    authClientMock.signOut.mockResolvedValue({});
    authClientMock.useSession.mockReset();
    setSessionState({ data: null });
    setComponentTestPathname('/');
    setComponentTestSearchParams('');
    window.history.replaceState(null, '', '/');
  });

  it('renders guest desktop nav with safe auth callback URLs', () => {
    setComponentTestPathname('/fleet/');
    setComponentTestSearchParams('category=dinghy');

    renderHeader();

    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByRole('link', { name: 'MITSailing' })
    ).toHaveAttribute('href', '/');

    const primaryNav = within(banner).getByRole('navigation', {
      name: 'Main navigation',
    });
    expect(
      within(primaryNav).getByRole('button', { name: 'Classes' })
    ).toBeVisible();
    expect(
      within(primaryNav).getByRole('button', { name: 'Fleet' })
    ).toBeVisible();
    expect(
      within(primaryNav).getByRole('link', { name: 'Bluewater' })
    ).toHaveAttribute('href', '#');
    expect(
      within(primaryNav).getByRole('link', { name: 'Calendar' })
    ).toHaveAttribute('href', '/events/');
    expect(
      within(primaryNav).getByRole('link', { name: 'About' })
    ).toHaveAttribute('href', '/about/');

    expect(
      within(banner).getByRole('link', { name: 'Log in' })
    ).toHaveAttribute(
      'href',
      '/login/?callbackUrl=%2Ffleet%2F%3Fcategory%3Ddinghy'
    );
    expect(
      within(banner).getByRole('link', { name: 'Create account' })
    ).toHaveAttribute(
      'href',
      '/signup/?callbackUrl=%2Ffleet%2F%3Fcategory%3Ddinghy'
    );
  });

  it('renders profile and sign out for signed-in users', () => {
    setSessionState({
      data: { user: { id: 'user-1', role: 'user' }, session: {} },
    });

    renderHeader();

    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByRole('link', { name: 'Profile' })
    ).toHaveAttribute('href', '/profile/');
    expect(
      within(banner).getByRole('button', { name: 'Sign out' })
    ).toBeVisible();
    expect(
      within(banner).queryByRole('link', { name: 'Log in' })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByRole('link', { name: 'Create account' })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByRole('link', { name: 'Admin' })
    ).not.toBeInTheDocument();
  });

  it('renders admin link for signed-in admins', () => {
    setSessionState({
      data: { user: { id: 'admin-1', role: 'admin' }, session: {} },
    });

    renderHeader();

    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Admin' })
    ).toHaveAttribute('href', '/admin/');
  });

  it('uses server auth hints while the client session is pending', () => {
    setSessionState({ data: null, isPending: true });

    renderHeader({ initialShowAdminLink: true, initialSignedIn: true });

    const banner = screen.getByRole('banner');
    expect(within(banner).queryByRole('status')).not.toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/'
    );
    expect(within(banner).getByRole('link', { name: 'Profile' })).toBeVisible();
    expect(
      within(banner).getByRole('button', { name: 'Sign out' })
    ).toBeVisible();
  });

  it('treats malformed session user payload as signed out', () => {
    setSessionState({ data: { user: null } });

    renderHeader();

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'Log in' })).toBeVisible();
    expect(
      within(banner).queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument();
  });

  it('sets aria-current on active flat links and dropdown children', async () => {
    const user = userEvent.setup();
    setComponentTestPathname('/events/');
    const view = renderHeader();

    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByRole('link', { name: 'Calendar' })
    ).toHaveAttribute('aria-current', 'page');

    setComponentTestPathname('/classes/');
    window.history.replaceState(null, '', '/classes/#windsurfing');
    view.rerender(
      <SiteHeader
        classesDropdownItems={classesDropdownItems}
        fleetDropdownItems={fleetDropdownItems}
      />
    );

    await user.click(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Classes',
      })
    );
    expect(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'Windsurfing',
      })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('opens mobile dialog, closes on link activation, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup();
    renderHeader();

    const openButton = screen.getByRole('button', { name: 'Open menu' });
    await waitFor(() => {
      expect(openButton).toBeEnabled();
    });

    await user.click(openButton);
    const dialog = screen.getByRole('dialog', { name: 'Main navigation' });
    expect(
      within(dialog).getByRole('link', { name: 'Reserve Pavilion' })
    ).toBeVisible();
    expect(
      within(dialog).getByRole('link', { name: 'Directions' })
    ).toBeVisible();
    expect(within(dialog).getByRole('link', { name: 'Donate' })).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Classes' })
    ).toBeVisible();
    expect(
      within(dialog).getByRole('link', { name: 'Calendar' })
    ).toBeVisible();

    await user.click(within(dialog).getByRole('link', { name: 'Calendar' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Main navigation' })
      ).not.toBeInTheDocument();
    });
    expect(openButton).toHaveFocus();

    await user.click(openButton);
    expect(
      screen.getByRole('dialog', { name: 'Main navigation' })
    ).toBeVisible();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(
      screen.getByRole('dialog', { name: 'Main navigation' })
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Main navigation' })
      ).not.toBeInTheDocument();
    });
    expect(openButton).toHaveFocus();
  });

  it('skips mobile focus when the overlay unmounts before the animation frame', async () => {
    const user = userEvent.setup();
    let frameCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((nextFrame) => {
        frameCallback = nextFrame;
        return 1;
      });
    const cancelAnimationFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    try {
      renderHeader();

      const openButton = screen.getByRole('button', { name: 'Open menu' });
      await waitFor(() => {
        expect(openButton).toBeEnabled();
      });

      await user.click(openButton);
      const dialog = screen.getByRole('dialog', { name: 'Main navigation' });
      await user.click(within(dialog).getByRole('link', { name: 'Calendar' }));
      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: 'Main navigation' })
        ).not.toBeInTheDocument();
      });

      if (!frameCallback) {
        throw new Error(
          'Expected mobile focus animation frame to be captured.'
        );
      }

      frameCallback(performance.now());
      expect(requestAnimationFrame).toHaveBeenCalled();
    } finally {
      requestAnimationFrame.mockRestore();
      cancelAnimationFrame.mockRestore();
    }
  });

  it('renders signed-in mobile account links and restores inert shell state', async () => {
    const user = userEvent.setup();
    const hadInert = 'inert' in HTMLElement.prototype;
    const originalInert = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'inert'
    );

    Object.defineProperty(HTMLElement.prototype, 'inert', {
      configurable: true,
      value: false,
      writable: true,
    });

    setSessionState({
      data: { user: { id: 'admin-1', role: 'admin' }, session: {} },
    });

    try {
      render(
        <>
          <main id="site-shell-inert-scope">Page</main>
          <SiteHeader
            classesDropdownItems={classesDropdownItems}
            fleetDropdownItems={fleetDropdownItems}
          />
        </>
      );

      const shell = screen.getByRole('main');
      const openButton = screen.getByRole('button', { name: 'Open menu' });
      await waitFor(() => {
        expect(openButton).toBeEnabled();
      });

      await user.click(openButton);
      const dialog = screen.getByRole('dialog', { name: 'Main navigation' });
      expect(shell).toHaveProperty('inert', true);
      expect(within(dialog).getByRole('link', { name: 'Admin' })).toBeVisible();
      expect(
        within(dialog).getByRole('link', { name: 'Profile' })
      ).toBeVisible();
      expect(
        within(dialog).getByRole('button', { name: 'Sign out' })
      ).toBeVisible();
      expect(
        within(dialog).queryByRole('link', { name: 'Log in' })
      ).not.toBeInTheDocument();

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: 'Main navigation' })
        ).not.toBeInTheDocument();
      });
      expect(shell).toHaveProperty('inert', false);
    } finally {
      if (originalInert) {
        Object.defineProperty(HTMLElement.prototype, 'inert', originalInert);
      } else if (!hadInert) {
        Reflect.deleteProperty(HTMLElement.prototype, 'inert');
      }
    }
  });

  it('renders accessible pending auth state without guest or account links', async () => {
    const user = userEvent.setup();
    setSessionState({ data: null, isPending: true });

    renderHeader();

    const banner = screen.getByRole('banner');
    const status = within(banner).getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading account status');
    expect(
      within(banner).queryByRole('link', { name: 'Log in' })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByRole('link', { name: 'Create account' })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument();
    expect(
      within(banner).queryByRole('button', { name: 'Sign out' })
    ).not.toBeInTheDocument();

    const openButton = screen.getByRole('button', { name: 'Open menu' });
    await waitFor(() => {
      expect(openButton).toBeEnabled();
    });

    await user.click(openButton);
    const dialog = screen.getByRole('dialog', { name: 'Main navigation' });
    expect(within(dialog).getByRole('status')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(
      within(dialog).queryByRole('link', { name: 'Log in' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument();
  });
});
