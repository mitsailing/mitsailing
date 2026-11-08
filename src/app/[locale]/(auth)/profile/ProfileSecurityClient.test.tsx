import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSecurityClient } from './ProfileSecurityClient';

const authClientMock = vi.hoisted(() => ({
  auditLog: {
    list: vi.fn(),
  },
  revokeOtherSessions: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.revokeOtherSessions.mockResolvedValue({});
  authClientMock.auditLog.list.mockResolvedValue({
    data: {
      entries: [
        {
          action: 'sign-in:email',
          createdAt: '2026-05-08T16:30:00.000Z',
          id: 'log-1',
          severity: 'medium',
          status: 'success',
        },
      ],
      total: 1,
    },
  });
});

describe('ProfileSecurityClient', () => {
  it('profile owner signs out other devices', async () => {
    const user = userEvent.setup();

    render(<ProfileSecurityClient />);

    await user.click(
      screen.getByRole('button', { name: 'Sign out of other devices' })
    );

    expect(authClientMock.revokeOtherSessions).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Other sessions have been signed out.')
    ).toBeVisible();
  });

  it('profile owner sees a recovery error when session revocation fails', async () => {
    const user = userEvent.setup();
    authClientMock.revokeOtherSessions.mockResolvedValue({
      error: { message: 'Could not revoke sessions.' },
    });

    render(<ProfileSecurityClient />);

    await user.click(
      screen.getByRole('button', { name: 'Sign out of other devices' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not revoke sessions.'
    );
  });

  it('profile owner sees default recovery message when revocation lacks a message', async () => {
    const user = userEvent.setup();
    authClientMock.revokeOtherSessions.mockResolvedValue({
      error: {},
    });

    render(<ProfileSecurityClient />);

    await user.click(
      screen.getByRole('button', { name: 'Sign out of other devices' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not revoke other sessions. Try again.'
    );
  });

  it('profile owner sees recovery message when revocation throws', async () => {
    const user = userEvent.setup();
    authClientMock.revokeOtherSessions.mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    render(<ProfileSecurityClient />);

    const button = screen.getByRole('button', {
      name: 'Sign out of other devices',
    });
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not revoke other sessions. Try again.'
    );
    expect(button).toBeEnabled();
  });

  it('profile owner sees their own security activity from auditLog.list', async () => {
    render(<ProfileSecurityClient />);

    expect(authClientMock.auditLog.list).toHaveBeenCalledWith({
      query: { limit: 25, offset: 0 },
    });
    expect(await screen.findByText('sign-in:email')).toBeVisible();
    expect(screen.getByText('success')).toBeVisible();
    expect(screen.getByText('medium')).toBeVisible();
  });

  it('profile owner sees an empty state when there is no security activity', async () => {
    authClientMock.auditLog.list.mockResolvedValue({
      data: { entries: [], total: 0 },
    });

    render(<ProfileSecurityClient />);

    expect(await screen.findByText('No security activity yet.')).toBeVisible();
  });

  it('profile owner sees a recovery message when security activity fails to load', async () => {
    authClientMock.auditLog.list.mockResolvedValue({
      error: { message: 'forbidden' },
    });

    render(<ProfileSecurityClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load security activity.'
    );
  });
});
