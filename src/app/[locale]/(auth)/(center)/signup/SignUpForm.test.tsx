import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { SignUpForm } from './SignUpForm';

const authClientMock = vi.hoisted(() => ({
  signUp: {
    email: vi.fn(),
  },
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
  authClientMock.signUp.email.mockResolvedValue({});
});

async function fillSignUpForm(props: {
  email: string;
  password: string;
  passwordConfirmation?: string;
}) {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Email'), props.email);
  await user.type(screen.getByLabelText('Password'), props.password);
  await user.type(
    screen.getByLabelText('Confirm password'),
    props.passwordConfirmation ?? props.password
  );

  return user;
}

describe('SignUpForm', () => {
  it('create account and continue to email verification', async () => {
    render(<SignUpForm callbackUrl="/onboarding" />);

    const user = await fillSignUpForm({
      email: 'new-sailor@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      callbackURL: '/onboarding',
      email: 'new-sailor@mit.edu',
      name: 'new-sailor',
      password: 'correct-password',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Check your email for a verification code.'
    );
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=new-sailor%40mit.edu&codeSent=1&callbackUrl=%2Fonboarding'
    );
  });

  it('creates account with email local part as temporary display name', async () => {
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'deckhand@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      callbackURL: '/fleet',
      email: 'deckhand@mit.edu',
      name: 'deckhand',
      password: 'correct-password',
    });
  });

  it('submit trimmed lowercase email for sign-up and verify-email redirect', async () => {
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: '  Sailor@MIT.EDU ',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      callbackURL: '/fleet',
      email: 'sailor@mit.edu',
      name: 'sailor',
      password: 'correct-password',
    });
    expect(
      await screen.findByText('Check your email for a verification code.')
    ).toBeVisible();
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
  });

  it('show sign-in recovery links for existing email', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'EMAIL_EXISTS' },
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email is already in the system.'
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Ffleet'
    );
    expect(
      screen.getByRole('link', { name: 'Reset password' })
    ).toHaveAttribute('href', '/forgot-password?callbackUrl=%2Ffleet');
  });

  it('keep form when password confirmation does not match', async () => {
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
      passwordConfirmation: 'different-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match.'
    );
    expect(authClientMock.signUp.email).not.toHaveBeenCalled();
  });

  it('show safe error before submitting invalid sign-up email', async () => {
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.signUp.email).not.toHaveBeenCalled();
  });

  it('show breached-password message from sign-up', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'PASSWORD_COMPROMISED' },
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That password has appeared in a known data breach.'
    );
    expect(
      screen.queryByRole('link', { name: 'Reset password' })
    ).not.toBeInTheDocument();
  });

  it('show rate-limit message from sign-up', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { message: 'TOO_MANY_REQUESTS' },
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-up attempts.'
    );
  });

  it('show rate-limit message from sign-up error code', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-up attempts.'
    );
  });

  it('show generic copy from unexpected sign-up error', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { message: 'Invite is required.' },
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong.'
    );
    expect(sentryMock.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        contexts: {
          authClientError: {
            code: undefined,
            message: 'Invite is required.',
          },
        },
      })
    );
  });

  it('show fallback message from empty sign-up error', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: {},
    });
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong.'
    );
  });

  it('show generic error and re-enable submit when sign-up rejects', async () => {
    const rejection = new Error('empty message placeholder');
    rejection.message = '';
    authClientMock.signUp.email.mockRejectedValueOnce(rejection);
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong.'
    );
    expect(screen.getByRole('button', { name: 'Sign up' })).not.toBeDisabled();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('show generic copy when sign-up rejects with provider text', async () => {
    authClientMock.signUp.email.mockRejectedValueOnce(
      new Error('Invite is closed.')
    );
    render(<SignUpForm callbackUrl="/fleet" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong.'
    );
    expect(sentryMock.captureMessage).toHaveBeenCalledWith(
      'Unknown auth client error',
      expect.objectContaining({
        tags: expect.objectContaining({
          authAction: 'signup.email.thrown',
        }),
      })
    );
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });
});
