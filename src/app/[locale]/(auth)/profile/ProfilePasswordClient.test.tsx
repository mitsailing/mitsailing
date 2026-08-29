import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePasswordClient } from './ProfilePasswordClient';

type ProfilePasswordSession = {
  data: { user: { id: string } } | null;
  refetch: () => Promise<void>;
};

const authClientMock = vi.hoisted(() => {
  const refetchSession = vi.fn(async () => {});
  return {
    changePassword: vi.fn(),
    refetchSession,
    useSession: vi.fn<() => ProfilePasswordSession>(() => ({
      data: { user: { id: 'user_123' } },
      refetch: refetchSession,
    })),
  };
});

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@sentry/nextjs', () => sentryMock);

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.changePassword.mockResolvedValue({});
  authClientMock.refetchSession.mockImplementation(async () => {});
  authClientMock.useSession.mockReturnValue({
    data: { user: { id: 'user_123' } },
    refetch: authClientMock.refetchSession,
  });
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
    expect(authClientMock.refetchSession).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('reports refetch failure after password change', async () => {
    const error = new Error('refetch failed');
    authClientMock.refetchSession.mockRejectedValueOnce(error);
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Your password was updated.')).toBeVisible();
    expect(sentryMock.captureException).toHaveBeenCalledWith(error, {
      extra: {
        action: 'refetchSession after password change',
        userId: 'user_123',
      },
    });
    expect(sentryMock.captureException).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        extra: expect.objectContaining({
          currentPassword: expect.anything(),
          newPassword: expect.anything(),
        }),
      })
    );
  });

  it('reports refetch failure without session user', async () => {
    const error = new Error('refetch failed');
    authClientMock.useSession.mockReturnValue({
      data: null,
      refetch: authClientMock.refetchSession,
    });
    authClientMock.refetchSession.mockRejectedValueOnce(error);
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Your password was updated.')).toBeVisible();
    expect(sentryMock.captureException).toHaveBeenCalledWith(error, {
      extra: {
        action: 'refetchSession after password change',
        userId: undefined,
      },
    });
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

  it('profile owner sees request failed when password change throws', async () => {
    authClientMock.changePassword.mockRejectedValue(new Error('network'));
    render(<ProfilePasswordClient />);

    const user = await fillPasswordForm({
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
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
