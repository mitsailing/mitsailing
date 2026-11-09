import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as CallbackUrlModule from '@/libs/auth/callbackUrl';
import { ForgotPasswordForm } from './ForgotPasswordForm';

const authClientMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/callbackUrl', async () => {
  const actual = await vi.importActual<typeof CallbackUrlModule>(
    '@/libs/auth/callbackUrl'
  );
  return {
    ...actual,
    absolutePasswordResetRedirectTo: vi.fn(
      (options: { callbackUrl?: string | null; email: string }) =>
        `https://example.test/reset-password?email=${encodeURIComponent(options.email)}&callbackUrl=${encodeURIComponent(options.callbackUrl ?? '/')}`
    ),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.requestPasswordReset.mockResolvedValue({});
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

  it('requests a reset link and stays on the same page', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
      redirectTo:
        'https://example.test/reset-password?email=reset%40mit.edu&callbackUrl=%2Ffleet',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for this email, you will receive a reset link shortly.'
    );
  });

  it('show safe error for invalid reset email', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm callbackUrl="/fleet" initialEmail="" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('continue when reset delivery returns opaque error', async () => {
    const user = userEvent.setup();
    authClientMock.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(
      <ForgotPasswordForm callbackUrl="/fleet" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(authClientMock.requestPasswordReset).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'If an account exists for this email, you will receive a reset link shortly.'
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('continue when reset delivery rejects', async () => {
    const user = userEvent.setup();
    authClientMock.requestPasswordReset.mockRejectedValue(new Error('network'));

    render(
      <ForgotPasswordForm callbackUrl="/fleet" initialEmail="reset@mit.edu" />
    );

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for this email, you will receive a reset link shortly.'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
