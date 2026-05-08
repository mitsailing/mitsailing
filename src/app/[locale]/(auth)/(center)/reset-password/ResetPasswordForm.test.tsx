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

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({});
  authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({});
  authClientMock.emailOtp.resetPassword.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

function renderResetPasswordForm(
  props?: Partial<React.ComponentProps<typeof ResetPasswordForm>>
) {
  return render(
    <ResetPasswordForm
      callbackUrl="/fleet/"
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
  it('visitor verifies a reset code before choosing a new password', async () => {
    renderResetPasswordForm();

    await continueWithResetCode();

    expect(authClientMock.emailOtp.checkVerificationOtp).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
      otp: '123456',
      type: 'forget-password',
    });
    expect(
      await screen.findByLabelText('New password', { exact: true })
    ).toBeVisible();
  });

  it('visitor sees invalid-code message before the password step', async () => {
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

  it('visitor sees expired-code message before the password step', async () => {
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

  it('visitor sees too-many-attempts message before the password step', async () => {
    authClientMock.emailOtp.checkVerificationOtp.mockResolvedValue({
      error: { code: 'TOO_MANY_ATTEMPTS' },
    });
    renderResetPasswordForm();

    await continueWithResetCode('111111');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many code attempts.'
    );
  });

  it('visitor enters an email when the reset link has none', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm({ initialEmail: '' });

    expect(screen.getByText(/that email/)).toBeVisible();
    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    await user.type(screen.getByLabelText('Reset code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(authClientMock.emailOtp.checkVerificationOtp).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
      otp: '123456',
      type: 'forget-password',
    });
  });

  it('visitor sees a safe error before checking an invalid reset email', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm({ initialEmail: '' });

    await user.type(screen.getByLabelText('Email'), 'reset@mit');
    await user.type(screen.getByLabelText('Reset code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.checkVerificationOtp).not.toHaveBeenCalled();
  });

  it('visitor waits through the initial reset-code cooldown', async () => {
    vi.useFakeTimers();
    renderResetPasswordForm({ initialResendLocked: true });

    const resendButton = screen.getByRole('button', {
      name: 'You can request a new code in 30 seconds',
    });

    expect(resendButton).toBeDisabled();
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('visitor leaves before the initial reset-code cooldown ends', () => {
    vi.useFakeTimers();
    const { unmount } = renderResetPasswordForm({ initialResendLocked: true });

    unmount();

    expect(
      screen.queryByRole('button', {
        name: 'You can request a new code in 30 seconds',
      })
    ).not.toBeInTheDocument();
  });

  it('visitor waits before requesting another reset code after resending', async () => {
    vi.useFakeTimers();
    renderResetPasswordForm();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'We sent a new reset code.'
    );
    expect(
      screen.getByRole('button', {
        name: 'You can request a new code in 30 seconds',
      })
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('visitor sees reset resend message when delivery is blocked', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });
    renderResetPasswordForm();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests.'
    );
  });

  it('visitor sees reset resend message when delivery fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
      new Error('network')
    );
    renderResetPasswordForm();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code right now.'
    );
  });

  it('visitor sees a safe error before resending without an email', async () => {
    const user = userEvent.setup();
    renderResetPasswordForm({ initialEmail: '' });

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('visitor resets password and signs in to the callback', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(authClientMock.emailOtp.resetPassword).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
      otp: '123456',
      password: 'new-password',
    });
    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      callbackURL: '/fleet/',
      email: 'reset@mit.edu',
      password: 'new-password',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith('/fleet/');
  });

  it('visitor keeps a valid reset code after password mismatch', async () => {
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

  it('visitor returns to code entry when a reset code expires during password update', async () => {
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

  it('visitor returns to code entry when a reset code is invalid during password update', async () => {
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

  it('visitor returns to code entry after too many reset attempts', async () => {
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

  it('visitor sees breached-password message during password update', async () => {
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

  it('visitor sees short-password message during password update', async () => {
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

  it('visitor sees long-password message during password update', async () => {
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

  it('visitor sees provider message during password update', async () => {
    authClientMock.emailOtp.resetPassword.mockResolvedValue({
      error: { message: 'Password cannot include your email.' },
    });
    renderResetPasswordForm();

    await continueWithResetCode();
    await fillNewPassword({ password: 'new-password' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password cannot include your email.'
    );
  });

  it('visitor sees sign-in message when automatic sign-in fails after reset', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });
    renderResetPasswordForm();

    await continueWithResetCode();
    await fillNewPassword({ password: 'new-password' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your password and try again.'
    );
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });
});
