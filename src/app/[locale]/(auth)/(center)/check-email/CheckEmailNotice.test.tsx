import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckEmailNotice } from './CheckEmailNotice';

const authClientMock = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
}));

const sentryMock = vi.hoisted(() => ({
  captureMessage: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@sentry/nextjs', () => sentryMock);

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.sendVerificationEmail.mockResolvedValue({});
});

describe('CheckEmailNotice', () => {
  it('show verification instructions with resend control', () => {
    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="sailor@mit.edu" />
    );

    expect(
      screen.getByText('We sent a verification link to sailor@mit.edu.')
    ).toBeVisible();
    expect(
      screen.getByText('Check your inbox and spam or junk folder.')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Resend verification link' })
    ).toBeEnabled();
    expect(authClientMock.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('resend verification link through Better Auth', async () => {
    const user = userEvent.setup();
    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="sailor@mit.edu" />
    );

    await user.click(
      screen.getByRole('button', { name: 'Resend verification link' })
    );

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: '/onboarding',
      email: 'sailor@mit.edu',
    });
    expect(
      await screen.findByText('We sent a new verification link.')
    ).toBeVisible();
  });

  it('normalize email before requesting a verification link', async () => {
    const user = userEvent.setup();
    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="  Sailor@MIT.EDU " />
    );

    await user.click(
      screen.getByRole('button', { name: 'Resend verification link' })
    );

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: '/onboarding',
      email: 'sailor@mit.edu',
    });
  });

  it('show rate-limit message when verification resend is blocked', async () => {
    const user = userEvent.setup();
    authClientMock.sendVerificationEmail.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="sailor@mit.edu" />
    );

    await user.click(
      screen.getByRole('button', { name: 'Resend verification link' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Wait a few minutes.'
    );
    expect(
      screen.queryByText('We sent a new verification link.')
    ).not.toBeInTheDocument();
  });

  it('show request message when verification resend returns an unknown error', async () => {
    const user = userEvent.setup();
    authClientMock.sendVerificationEmail.mockResolvedValue({
      error: { message: 'USER_ALREADY_EXISTS' },
    });

    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="sailor@mit.edu" />
    );

    await user.click(
      screen.getByRole('button', { name: 'Resend verification link' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(sentryMock.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authAction: 'check_email.send_verification_email',
        }),
      })
    );
    expect(
      screen.queryByText('We sent a new verification link.')
    ).not.toBeInTheDocument();
  });

  it('show request message when verification resend fails', async () => {
    const user = userEvent.setup();
    authClientMock.sendVerificationEmail.mockRejectedValue(
      new Error('network')
    );

    render(
      <CheckEmailNotice callbackUrl="/onboarding" email="sailor@mit.edu" />
    );

    await user.click(
      screen.getByRole('button', { name: 'Resend verification link' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(sentryMock.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authAction: 'check_email.send_verification_email.thrown',
        }),
      })
    );
    expect(
      screen.queryByText('We sent a new verification link.')
    ).not.toBeInTheDocument();
  });

  it('show signup fallback when email is missing', () => {
    render(<CheckEmailNotice callbackUrl="/onboarding" email="" />);

    expect(
      screen.getByText(
        'Enter your email on the sign-up page to request a verification link.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Back to sign up' })
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.queryByRole('button', { name: 'Resend verification link' })
    ).not.toBeInTheDocument();
    expect(authClientMock.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('show signup fallback when email is invalid', () => {
    render(<CheckEmailNotice callbackUrl="/fleet" email="not-an-email" />);

    expect(
      screen.getByRole('link', { name: 'Back to sign up' })
    ).toHaveAttribute('href', '/signup?callbackUrl=%2Ffleet');
    expect(authClientMock.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('avoid nesting onboarding callbacks on the signup fallback link', () => {
    render(
      <CheckEmailNotice
        callbackUrl="/onboarding?callbackUrl=%2Ffleet"
        email=""
      />
    );

    expect(
      screen.getByRole('link', { name: 'Back to sign up' })
    ).toHaveAttribute('href', '/signup');
  });
});
