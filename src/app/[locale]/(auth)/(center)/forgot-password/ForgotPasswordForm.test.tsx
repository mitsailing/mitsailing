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
  it('prefills initial reset email', () => {
    render(
      <ForgotPasswordForm
        callbackUrl="/fleet"
        initialEmail=" Sailor@MIT.EDU "
      />
    );

    expect(screen.getByLabelText('Email')).toHaveValue('sailor@mit.edu');
  });

  it('request reset code and move to code form', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    await waitFor(() => {
      expect(componentTestRouter().replace).toHaveBeenCalledWith(
        '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
      );
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Send reset code' })
      ).toBeEnabled()
    );
  });

  it('show safe error for invalid reset email', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('continue when reset delivery returns opaque error', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(
      <ForgotPasswordForm callbackUrl="/fleet" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    await waitFor(() => {
      expect(componentTestRouter().replace).toHaveBeenCalledWith(
        '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('continue when reset delivery rejects', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
      new Error('network')
    );

    render(
      <ForgotPasswordForm callbackUrl="/fleet" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    await waitFor(() => {
      expect(componentTestRouter().replace).toHaveBeenCalledWith(
        '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('omit unsafe external callbackUrl from reset redirect', async () => {
    const user = userEvent.setup();

    render(
      <ForgotPasswordForm callbackUrl="https://attacker.com" initialEmail="" />
    );

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    await waitFor(() => {
      const call = componentTestRouter().replace.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      const url = new URL(String(call), 'https://example.test');
      expect(url.pathname).toBe('/reset-password');
      expect(url.searchParams.get('email')).toBe('reset@mit.edu');
      expect(url.searchParams.get('codeSent')).toBe('1');
      expect(url.searchParams.has('callbackUrl')).toBe(false);
    });
  });
});
