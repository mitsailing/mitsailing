import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSecurityClient } from './ProfileSecurityClient';

const authClientMock = vi.hoisted(() => ({
  revokeOtherSessions: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.revokeOtherSessions.mockResolvedValue({});
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
});
