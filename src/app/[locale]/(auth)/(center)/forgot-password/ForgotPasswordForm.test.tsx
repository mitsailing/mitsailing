import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { ForgotPasswordForm } from './ForgotPasswordForm';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    requestPasswordReset: vi.fn(),
  },
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({});
});

describe('ForgotPasswordForm', () => {
  it('visitor requests a reset code and moves to the code form', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet/" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    await waitFor(() => {
      expect(componentTestRouter().replace).toHaveBeenCalledWith(
        '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
      );
    });
  });

  it('visitor sees a safe error for an invalid reset email', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet/" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('visitor sees recovery message when reset delivery fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(
      <ForgotPasswordForm callbackUrl="/fleet/" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code right now.'
    );
  });

  it('visitor sees recovery message when reset delivery rejects', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
      new Error('network')
    );

    render(
      <ForgotPasswordForm callbackUrl="/fleet/" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code right now.'
    );
  });
});
