import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { ResetPasswordForm } from './ResetPasswordForm';

const authClientMock = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  signIn: {
    email: vi.fn(),
  },
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.resetPassword.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
});

function renderResetPasswordForm(
  props?: Partial<{
    callbackUrl: string;
    initialEmail: string;
    invalidToken: boolean;
    token: string;
  }>
) {
  return render(
    <ResetPasswordForm
      callbackUrl={props?.callbackUrl ?? '/fleet'}
      initialEmail={props?.initialEmail ?? 'reset@mit.edu'}
      invalidToken={props?.invalidToken ?? false}
      token={props?.token ?? 'reset-token'}
    />
  );
}

describe('ResetPasswordForm', () => {
  it('shows invalid token message without password fields', () => {
    renderResetPasswordForm({ invalidToken: true, token: '' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That reset link is invalid or has expired.'
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' })
    ).toBeInTheDocument();
  });

  it('does not call resetPassword when passwords mismatch', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.type(screen.getByLabelText('New password'), 'CorrectHorse1');
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'CorrectHorse2'
    );
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match.'
    );
    expect(authClientMock.resetPassword).not.toHaveBeenCalled();
  });

  it('resets password with token and signs in to callback', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.type(
      screen.getByLabelText('New password'),
      'Correct-Horse-Battery'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'Correct-Horse-Battery'
    );
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(authClientMock.resetPassword).toHaveBeenCalledWith({
        newPassword: 'Correct-Horse-Battery',
        token: 'reset-token',
      });
    });
    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      callbackURL: '/fleet',
      email: 'reset@mit.edu',
      password: 'Correct-Horse-Battery',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith('/fleet');
  });

  it('hides password fields after reset when auto sign-in fails', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'BANNED_USER', message: 'BANNED_USER' },
    });
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.type(
      screen.getByLabelText('New password'),
      'Correct-Horse-Battery'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'Correct-Horse-Battery'
    );
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(authClientMock.resetPassword).toHaveBeenCalled();
    });
    expect(
      screen.getByText(/Your password was reset\. Please sign in manually\./)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });
});
