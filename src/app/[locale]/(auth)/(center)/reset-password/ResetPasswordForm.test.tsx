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
const reportUnknownAuthClientErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/reportAuthClientError', () => ({
  reportUnknownAuthClientError: reportUnknownAuthClientErrorMock,
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

async function submitMatchingPasswords() {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('New password'),
    'Correct-Horse-Battery'
  );
  await user.type(
    screen.getByLabelText('Confirm new password'),
    'Correct-Horse-Battery'
  );
  await user.click(screen.getByRole('button', { name: 'Update password' }));
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

  it.each([
    [
      'PASSWORD_COMPROMISED',
      undefined,
      'That password has appeared in a known data breach. Choose a different one.',
    ],
    ['PASSWORD_TOO_SHORT', undefined, 'Use at least 8 characters.'],
    ['PASSWORD_TOO_LONG', undefined, 'Use 128 characters or fewer.'],
    ['TOO_MANY_REQUESTS', undefined, 'Too many requests. Wait a few minutes.'],
    ['INVALID_TOKEN', undefined, 'That reset link is invalid or has expired.'],
    ['UNKNOWN', undefined, 'Check your password.'],
    [undefined, 'PASSWORD_TOO_SHORT', 'Use at least 8 characters.'],
  ] as const)(
    'map reset error code %s message %s to visible copy',
    async (code, message, expected) => {
      authClientMock.resetPassword.mockResolvedValue({
        error: { code, message },
      });
      renderResetPasswordForm();

      await submitMatchingPasswords();

      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(authClientMock.signIn.email).not.toHaveBeenCalled();
      expect(componentTestRouter().push).not.toHaveBeenCalled();
      if (code === 'UNKNOWN') {
        expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
          action: 'reset-password.update-password',
          code: 'UNKNOWN',
          message: undefined,
        });
      } else {
        expect(reportUnknownAuthClientErrorMock).not.toHaveBeenCalled();
      }
    }
  );

  it('ask the sailor to sign in when the reset email is blank', async () => {
    renderResetPasswordForm({ initialEmail: '   ' });

    await submitMatchingPasswords();

    expect(
      await screen.findByText(
        /Your password was reset\. Please sign in manually\./
      )
    ).toBeInTheDocument();
    expect(authClientMock.resetPassword).toHaveBeenCalled();
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('ask the sailor to sign in when auto sign-in throws an Error', async () => {
    authClientMock.signIn.email.mockRejectedValue(new Error('network'));
    renderResetPasswordForm();

    await submitMatchingPasswords();

    expect(
      await screen.findByText(
        /Your password was reset\. Please sign in manually\./
      )
    ).toBeInTheDocument();
    expect(authClientMock.resetPassword).toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'reset-password.auto-sign-in',
      code: undefined,
      message: 'network',
    });
  });

  it('ask the sailor to sign in when auto sign-in throws a non-Error', async () => {
    authClientMock.signIn.email.mockRejectedValue('offline');
    renderResetPasswordForm();

    await submitMatchingPasswords();

    expect(
      await screen.findByText(
        /Your password was reset\. Please sign in manually\./
      )
    ).toBeInTheDocument();
    expect(authClientMock.resetPassword).toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'reset-password.auto-sign-in',
      code: undefined,
      message: undefined,
    });
  });

  it('show a request failure when resetPassword throws', async () => {
    authClientMock.resetPassword.mockRejectedValue(new Error('network'));
    renderResetPasswordForm();

    await submitMatchingPasswords();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'reset-password.update-password.thrown',
      code: undefined,
      message: 'network',
    });
  });
});
