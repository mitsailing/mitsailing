import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePasswordClient } from './ProfilePasswordClient';

const authClientMock = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.changePassword.mockResolvedValue({});
});

async function fillPasswordForm(props: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation?: string;
}) {
  const user = userEvent.setup();

  await user.type(
    screen.getByLabelText('Current password'),
    props.currentPassword
  );
  await user.type(screen.getByLabelText('New password'), props.newPassword);
  await user.type(
    screen.getByLabelText('Confirm new password'),
    props.newPasswordConfirmation ?? props.newPassword
  );

  return user;
}

describe('ProfilePasswordClient', () => {
  it('profile owner changes password and revokes other sessions', async () => {
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(authClientMock.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'new-password',
      revokeOtherSessions: true,
    });
    expect(await screen.findByText('Your password was updated.')).toBeVisible();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('profile owner sees a mismatch before password submission', async () => {
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'new-password',
      newPasswordConfirmation: 'different-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'New passwords do not match.'
    );
    expect(authClientMock.changePassword).not.toHaveBeenCalled();
  });

  it('profile owner sees breach guidance for a compromised password', async () => {
    authClientMock.changePassword.mockResolvedValue({
      error: { code: 'PASSWORD_COMPROMISED' },
    });
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'breached-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That password has appeared in a known data breach.'
    );
  });
});
