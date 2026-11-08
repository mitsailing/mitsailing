import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as CallbackUrlModule from '@/libs/auth/callbackUrl';
import { componentTestRouter } from '@/test/component';
import { SignInForm } from './SignInForm';

const authClientMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
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
  authClientMock.sendVerificationEmail.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
});

async function submitSignIn(props: {
  readonly email: string;
  readonly password: string;
  readonly user: ReturnType<typeof userEvent.setup>;
}) {
  await props.user.type(screen.getByLabelText('Email'), props.email);
  await props.user.type(screen.getByLabelText('Password'), props.password);
  await props.user.click(screen.getByRole('button', { name: 'Sign in' }));
}

async function expectSignInAlert(props: {
  readonly alertText: string;
  readonly email?: string;
  readonly password?: string;
}) {
  const user = userEvent.setup();
  render(<SignInForm callbackUrl="/fleet" />);

  await submitSignIn({
    email: props.email ?? 'sailor@mit.edu',
    password: props.password ?? 'wrong-password',
    user,
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(props.alertText);
}

async function submitUnverifiedResend() {
  const user = userEvent.setup();
  authClientMock.signIn.email.mockResolvedValue({
    error: { code: 'EMAIL_NOT_VERIFIED' },
  });

  render(<SignInForm callbackUrl="/fleet" />);

  await submitSignIn({
    email: 'new-sailor@mit.edu',
    password: 'correct-password',
    user,
  });
  await user.click(
    await screen.findByRole('button', { name: 'Send verification link' })
  );
}

describe('SignInForm', () => {
  it('shows email and password together on first render', () => {
    render(<SignInForm callbackUrl="/fleet" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('Visitor signs in and returns to the requested page', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await submitSignIn({
      email: ' Sailor@MIT.EDU ',
      password: 'correct-password',
      user,
    });

    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      callbackURL: '/login/continue?callbackUrl=%2Ffleet',
      email: 'sailor@mit.edu',
      password: 'correct-password',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/login/continue?callbackUrl=%2Ffleet'
    );
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });

  it('Visitor sees a safe error before submitting an invalid email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await submitSignIn({
      email: 'sailor@mit',
      password: 'correct-password',
      user,
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
  });

  it('Legacy sailor sees must-set-password copy when no credential password exists', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'MUST_SET_PASSWORD' },
    });

    await expectSignInAlert({
      alertText:
        'MIT Sailing has updated its security. A password reset email has been sent to you. This link is valid for 1 hour.',
      email: 'legacy@mit.edu',
      password: 'old',
    });
    expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
      email: 'legacy@mit.edu',
      redirectTo:
        'https://example.test/reset-password?email=legacy%40mit.edu&callbackUrl=%2Ffleet',
    });
  });

  it('Legacy sailor sees a rate-limit message when the reset request is limited', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'MUST_SET_PASSWORD' },
    });
    authClientMock.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    await expectSignInAlert({
      alertText: 'Too many attempts.',
      email: 'legacy@mit.edu',
      password: 'old',
    });
    expect(
      screen.queryByText(/password reset email has been sent/i)
    ).not.toBeInTheDocument();
  });

  it('Legacy sailor sees a request-failed message when the reset request errors', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'MUST_SET_PASSWORD' },
    });
    authClientMock.requestPasswordReset.mockResolvedValue({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'mail down' },
    });

    await expectSignInAlert({
      alertText: 'We could not complete that request right now.',
      email: 'legacy@mit.edu',
      password: 'old',
    });
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.must_set_password.request-reset',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'mail down',
    });
  });

  it('Locked-out sailor sees the lockout recovery message', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'ACCOUNT_LOCKED' },
    });

    await expectSignInAlert({
      alertText: 'Your account is temporarily locked',
      email: 'locked@mit.edu',
    });
  });

  it('Banned sailor sees the disabled-account message', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'BANNED_USER' },
    });

    await expectSignInAlert({
      alertText: 'Your account has been disabled. Contact support.',
      email: 'banned@mit.edu',
      password: 'correct-password',
    });
    expect(authClientMock.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('Visitor sees credentials message after a failed sign-in', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    await expectSignInAlert({
      alertText: 'Invalid email or password.',
    });
  });

  it('Visitor sees rate-limit message after too many sign-in attempts', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    await expectSignInAlert({ alertText: 'Too many attempts.' });
  });

  it('Visitor sees credentials message after an unexpected sign-in error', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { message: 'Account requires staff approval.' },
    });

    await expectSignInAlert({
      alertText: 'Invalid email or password.',
      password: 'correct-password',
    });

    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.email',
      code: undefined,
      message: 'Account requires staff approval.',
    });
  });

  it('Visitor sees credentials message when sign-in fails without details', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: {},
    });

    await expectSignInAlert({
      alertText: 'Invalid email or password.',
    });

    expect(reportUnknownAuthClientErrorMock).not.toHaveBeenCalled();
  });

  it('Visitor sees request-failed message when sign-in throws', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockRejectedValue(new Error('network'));

    render(<SignInForm callbackUrl="/fleet" />);

    await submitSignIn({
      email: 'sailor@mit.edu',
      password: 'correct-password',
      user,
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.email.thrown',
      code: undefined,
      message: 'network',
    });
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });

  it('Unverified sailor uses normalized email for verification link resend', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await submitSignIn({
      email: ' Sailor@MIT.EDU ',
      password: 'correct-password',
      user,
    });
    await user.click(
      await screen.findByRole('button', { name: 'Send verification link' })
    );

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: '/login/continue?callbackUrl=%2Ffleet',
      email: 'sailor@mit.edu',
    });
    expect(
      await screen.findByText('We sent a verification link to that email.')
    ).toBeVisible();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('Unverified sailor requests a verification link from sign-in', async () => {
    await submitUnverifiedResend();

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: '/login/continue?callbackUrl=%2Ffleet',
      email: 'new-sailor@mit.edu',
    });
    expect(
      await screen.findByText('We sent a verification link to that email.')
    ).toBeVisible();
  });

  it('Unverified sailor sees delivery message when verification resend is blocked', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts.'
    );
  });

  it('Unverified sailor sees delivery message when verification resend fails', async () => {
    authClientMock.sendVerificationEmail.mockRejectedValue(
      new Error('network')
    );

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.send_verification_email.thrown',
      code: undefined,
      message: 'network',
    });
  });

  it('Unverified sailor sees fallback message when verification resend has no details', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Unverified sailor does not see backend text when resend returns EMAIL_NOT_VERIFIED', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'DO_NOT_SHOW_RAW_BACKEND_COPY',
      },
    });

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
    expect(screen.queryByText(/DO_NOT_SHOW_RAW_BACKEND_COPY/)).toBeNull();
  });

  it('Visitor follows forgot-password link with the entered email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toHaveAttribute(
      'href',
      '/forgot-password?email=reset%40mit.edu&callbackUrl=%2Ffleet'
    );
  });

  it('Visitor follows the forgot-password link without an entered email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('Visitor follows forgot-password link without malformed email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toHaveAttribute('href', '/forgot-password?callbackUrl=%2Ffleet');
  });
});
