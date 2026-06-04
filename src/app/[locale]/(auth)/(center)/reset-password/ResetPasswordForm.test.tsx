import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { ResetPasswordForm } from './ResetPasswordForm';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    checkVerificationOtp: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
  signIn: {
    email: vi.fn(),
  },
}));

const sentryMock = vi.hoisted(() => ({
  captureMessage: vi.fn(),
}));
const supportActionMock = vi.hoisted(() => ({
  reportPasswordResetIssueAction: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/passwordResetSupportActions', () => ({
  reportPasswordResetIssueAction:
    supportActionMock.reportPasswordResetIssueAction,
}));

vi.mock('@sentry/nextjs', () => sentryMock);

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({});
  authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({});
  authClientMock.emailOtp.resetPassword.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
  supportActionMock.reportPasswordResetIssueAction.mockResolvedValue({
    ok: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderResetPasswordForm(
  props?: Partial<React.ComponentProps<typeof ResetPasswordForm>>
) {
  return render(
    <ResetPasswordForm
      callbackUrl="/fleet"
      initialEmail="reset@mit.edu"
      passwordHeading="Create a new password"
      {...props}
    />
  );
}

async function continueWithResetCode(code = '123456') {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Reset code'), code);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  return user;
}

async function fillNewPassword(props: {
  password: string;
  passwordConfirmation?: string;
}) {
  const user = userEvent.setup();

  await user.type(
    await screen.findByLabelText('New password', { exact: true }),
    props.password
  );
  await user.type(
    screen.getByLabelText('Confirm new password'),
    props.passwordConfirmation ?? props.password
  );
  await user.click(screen.getByRole('button', { name: 'Update password' }));

  return user;
}

describe('ResetPasswordForm', () => {
  it('report reset email delivery trouble for current email', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm();

    await user.click(
      screen.getByRole('button', { name: 'Not getting email?' })
    );

    expect(
      supportActionMock.reportPasswordResetIssueAction
    ).toHaveBeenCalledWith({ email: 'reset@mit.edu' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'We sent a message to support.'
    );
  });

  it('uses create-password copy for legacy users', () => {
    renderResetPasswordForm({ mode: 'create-password' });

    expect(screen.getByText(/create your MIT Sailing password/i)).toBeVisible();
  });

  describe('Code verification', () => {
    it('verify reset code before choosing new password', async () => {
      renderResetPasswordForm();

      await continueWithResetCode();

      expect(authClientMock.emailOtp.checkVerificationOtp).toHaveBeenCalledWith(
        {
          email: 'reset@mit.edu',
          otp: '123456',
          type: 'forget-password',
        }
      );
      expect(
        await screen.findByLabelText('New password', { exact: true })
      ).toBeVisible();
    });

    it('show invalid-code message before password step', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
        error: { code: 'INVALID_OTP' },
      });
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code is invalid.'
      );
      expect(
        screen.queryByLabelText('New password', { exact: true })
      ).not.toBeInTheDocument();
    });

    it('show expired-code message before password step', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
        error: { code: 'OTP_EXPIRED' },
      });
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code expired.'
      );
      expect(
        screen.queryByLabelText('New password', { exact: true })
      ).not.toBeInTheDocument();
    });

    it('show too-many-attempts message before password step', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
        error: { code: 'TOO_MANY_ATTEMPTS' },
      });
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many code attempts.'
      );
    });

    it('show rate-limit message before password step', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
        error: { code: 'TOO_MANY_REQUESTS' },
      });
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many requests. Wait a few minutes.'
      );
    });

    it('show validation message before password step for unknown provider errors', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
        error: { message: 'Reset code was already used.' },
      });
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Check your reset code.'
      );
      expect(sentryMock.captureMessage).toHaveBeenCalledWith(
        'Unknown auth client error',
        {
          level: 'warning',
          tags: {
            authAction: 'reset-password.check-code',
            authErrorCode: 'missing',
          },
          contexts: {
            authClientError: {
              code: undefined,
              message: 'Reset code was already used.',
            },
          },
        }
      );
      expect(
        screen.queryByLabelText('New password', { exact: true })
      ).not.toBeInTheDocument();
    });

    it('show request error when code verification fails', async () => {
      authClientMock.emailOtp.checkVerificationOtp.mockRejectedValue(
        new Error('network')
      );
      renderResetPasswordForm();

      await continueWithResetCode('111111');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not complete that request right now.'
      );
      expect(
        screen.queryByLabelText('New password', { exact: true })
      ).not.toBeInTheDocument();
    });

    it('enter email when reset link has none', async () => {
      const user = userEvent.setup();
      renderResetPasswordForm({ initialEmail: '' });

      expect(screen.getByText(/that email/)).toBeVisible();
      await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
      await user.type(screen.getByLabelText('Reset code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(authClientMock.emailOtp.checkVerificationOtp).toHaveBeenCalledWith(
        {
          email: 'reset@mit.edu',
          otp: '123456',
          type: 'forget-password',
        }
      );
    });

    it('show safe error before checking invalid reset email', async () => {
      const user = userEvent.setup();
      renderResetPasswordForm({ initialEmail: '' });

      await user.type(screen.getByLabelText('Email'), 'reset@mit');
      await user.type(screen.getByLabelText('Reset code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address with a domain'
      );
      expect(
        authClientMock.emailOtp.checkVerificationOtp
      ).not.toHaveBeenCalled();
    });
  });

  describe('Resend cooldown', () => {
    it('wait through initial reset-code cooldown', async () => {
      vi.useFakeTimers();
      renderResetPasswordForm({ initialResendLocked: true });

      const resendButton = screen.getByRole('button', {
        name: 'You can request a new code in 30 seconds',
      });

      expect(resendButton).toBeDisabled();
      expect(
        authClientMock.emailOtp.requestPasswordReset
      ).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
    });

    it('leave before initial reset-code cooldown ends', () => {
      vi.useFakeTimers();
      const { unmount } = renderResetPasswordForm({
        initialResendLocked: true,
      });

      unmount();

      expect(
        screen.queryByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).not.toBeInTheDocument();
    });

    it('wait before requesting another reset code after resending', async () => {
      vi.useFakeTimers();
      renderResetPasswordForm();
      fireEvent.change(screen.getByLabelText('Reset code'), {
        target: { value: '123456' },
      });

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith(
        {
          email: 'reset@mit.edu',
        }
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'We sent a new reset code.'
      );
      expect(screen.getByLabelText('Reset code')).toHaveValue('');
      expect(
        screen.getByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
    });

    it('keep latest reset resend cooldown', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
      const resend = Promise.withResolvers<object>();
      authClientMock.emailOtp.requestPasswordReset.mockImplementation(
        async () => {
          const value = await resend.promise;
          return value;
        }
      );
      const { unmount } = renderResetPasswordForm();

      const resendButton = screen.getByRole('button', { name: 'Resend code' });
      act(() => {
        fireEvent.click(resendButton);
        fireEvent.click(resendButton);
      });

      expect(
        authClientMock.emailOtp.requestPasswordReset
      ).toHaveBeenCalledTimes(1);

      await act(async () => {
        resend.resolve({});
        await Promise.resolve();
      });

      expect(
        screen.getByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).toBeDisabled();

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('show reset resend message when delivery is blocked', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
        error: { code: 'TOO_MANY_REQUESTS' },
      });
      renderResetPasswordForm();

      await user.click(screen.getByRole('button', { name: 'Resend code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many requests. Wait a few minutes.'
      );
    });

    it('show reset resend message when delivery fails', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
        new Error('network')
      );
      renderResetPasswordForm();

      await user.click(screen.getByRole('button', { name: 'Resend code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not send a reset code.'
      );
    });

    it('show safe error before resending without email', async () => {
      const user = userEvent.setup();
      renderResetPasswordForm({ initialEmail: '' });

      await user.click(screen.getByRole('button', { name: 'Resend code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address with a domain'
      );
      expect(
        authClientMock.emailOtp.requestPasswordReset
      ).not.toHaveBeenCalled();
    });
  });

  describe('Password update', () => {
    it('keep valid reset code after password mismatch', async () => {
      renderResetPasswordForm();

      const user = await continueWithResetCode();
      await user.type(
        await screen.findByLabelText('New password', { exact: true }),
        'new-password'
      );
      await user.type(
        screen.getByLabelText('Confirm new password'),
        'different-password'
      );
      await user.click(screen.getByRole('button', { name: 'Update password' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Passwords do not match.'
      );
      expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument();
      expect(authClientMock.emailOtp.resetPassword).not.toHaveBeenCalled();
    });

    it('return to code entry when reset code expires during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'OTP_EXPIRED' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code expired. Request a new reset code.'
      );
      expect(screen.getByLabelText('Reset code')).toHaveValue('');
    });

    it('return to code entry when reset code is invalid during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'INVALID_OTP' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code is invalid.'
      );
      expect(screen.getByLabelText('Reset code')).toHaveValue('123456');
    });

    it('return to code entry after too many reset attempts', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'TOO_MANY_ATTEMPTS' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many code attempts.'
      );
      expect(screen.getByLabelText('Reset code')).toBeVisible();
    });

    it('show rate-limit message during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'TOO_MANY_REQUESTS' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many requests. Wait a few minutes.'
      );
    });

    it('show breached-password message during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'PASSWORD_COMPROMISED' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That password has appeared in a known data breach.'
      );
      expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument();
    });

    it('show short-password message during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'PASSWORD_TOO_SHORT' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Use at least 8 characters.'
      );
    });

    it('show long-password message during password update', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { code: 'PASSWORD_TOO_LONG' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Use 128 characters or fewer.'
      );
    });

    it('show validation message during password update for unknown provider errors', async () => {
      authClientMock.emailOtp.resetPassword.mockResolvedValue({
        error: { message: 'Password cannot include your email.' },
      });
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Check your password.'
      );
      expect(sentryMock.captureMessage).toHaveBeenCalledWith(
        'Unknown auth client error',
        expect.objectContaining({
          tags: expect.objectContaining({
            authAction: 'reset-password.update-password',
          }),
        })
      );
    });

    it('show request error when password update fails', async () => {
      authClientMock.emailOtp.resetPassword.mockRejectedValue(
        new Error('network')
      );
      renderResetPasswordForm();

      await continueWithResetCode();
      await fillNewPassword({ password: 'new-password' });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not complete that request right now.'
      );
      expect(componentTestRouter().push).not.toHaveBeenCalled();
    });

    describe('Auto sign-in', () => {
      it('reset password and sign in to callback', async () => {
        renderResetPasswordForm();

        const user = await continueWithResetCode();
        await user.type(
          await screen.findByLabelText('New password', { exact: true }),
          'new-password'
        );
        await user.type(
          screen.getByLabelText('Confirm new password'),
          'new-password'
        );
        await user.click(
          screen.getByRole('button', { name: 'Update password' })
        );

        expect(authClientMock.emailOtp.resetPassword).toHaveBeenCalledWith({
          email: 'reset@mit.edu',
          otp: '123456',
          password: 'new-password',
        });
        expect(authClientMock.signIn.email).toHaveBeenCalledWith({
          callbackURL: '/fleet',
          email: 'reset@mit.edu',
          password: 'new-password',
        });
        expect(componentTestRouter().push).toHaveBeenCalledWith('/fleet');
      });

      it('use fallback after reset with unsafe callback', async () => {
        renderResetPasswordForm({ callbackUrl: 'https://attacker.com' });

        await continueWithResetCode();
        await fillNewPassword({ password: 'new-password' });

        expect(authClientMock.signIn.email).toHaveBeenCalledWith({
          callbackURL: '/',
          email: 'reset@mit.edu',
          password: 'new-password',
        });
        expect(componentTestRouter().push).toHaveBeenCalledWith('/');
      });

      it('continue when automatic sign-in fails after reset', async () => {
        authClientMock.signIn.email.mockResolvedValue({
          error: {
            code: 'INVALID_EMAIL_OR_PASSWORD',
            message: 'Invalid credentials',
          },
        });
        renderResetPasswordForm();

        await continueWithResetCode();
        await fillNewPassword({ password: 'new-password' });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(sentryMock.captureMessage).toHaveBeenCalledWith(
          'Unknown auth client error',
          expect.objectContaining({
            tags: expect.objectContaining({
              authAction: 'reset-password.auto-sign-in',
            }),
          })
        );
        expect(componentTestRouter().push).not.toHaveBeenCalled();
        expect(
          screen.getByRole('link', { name: 'Back to sign in' })
        ).toBeInTheDocument();
      });

      it('continue when automatic sign-in throws after reset', async () => {
        authClientMock.signIn.email.mockRejectedValue(new Error('network'));
        renderResetPasswordForm();

        await continueWithResetCode();
        await fillNewPassword({ password: 'new-password' });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(sentryMock.captureMessage).toHaveBeenCalledWith(
          'Unknown auth client error',
          expect.objectContaining({
            tags: expect.objectContaining({
              authAction: 'reset-password.auto-sign-in',
            }),
          })
        );
        expect(componentTestRouter().push).not.toHaveBeenCalled();
        expect(
          screen.getByRole('link', { name: 'Back to sign in' })
        ).toBeInTheDocument();
      });
    });
  });
});
