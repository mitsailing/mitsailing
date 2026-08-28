import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { SignInForm } from './SignInForm';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    requestPasswordReset: vi.fn(),
    sendVerificationOtp: vi.fn(),
  },
  signIn: {
    email: vi.fn(),
  },
}));
const signInEmailActionMock = vi.hoisted(() => ({
  resolveSignInEmailAction: vi.fn(),
}));
const reportUnknownAuthClientErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/reportAuthClientError', () => ({
  reportUnknownAuthClientError: reportUnknownAuthClientErrorMock,
}));

vi.mock('@/libs/auth/signInEmailActions', () => ({
  resolveSignInEmailAction: signInEmailActionMock.resolveSignInEmailAction,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({});
  authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
  signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
    email: 'sailor@mit.edu',
    state: 'password',
  });
});

async function revealPasswordFor(
  user: ReturnType<typeof userEvent.setup>,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  signInEmailActionMock.resolveSignInEmailAction.mockResolvedValueOnce({
    email: normalizedEmail,
    state: 'password',
  });
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Password');
}

async function submitEmailStep(
  user: ReturnType<typeof userEvent.setup>,
  email: string
) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

async function expectEmailStepRedirect(props: {
  readonly expectedPath: string;
  readonly resolvedEmail: string;
  readonly state: 'reset_required' | 'sign_up';
  readonly submittedEmail?: string;
}) {
  const user = userEvent.setup();
  signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
    email: props.resolvedEmail,
    state: props.state,
  });

  render(<SignInForm callbackUrl="/fleet" />);

  await submitEmailStep(user, props.submittedEmail ?? props.resolvedEmail);

  expect(componentTestRouter().push).toHaveBeenCalledWith(props.expectedPath);
}

async function submitPasswordStep(props: {
  readonly email: string;
  readonly password: string;
  readonly user: ReturnType<typeof userEvent.setup>;
}) {
  await revealPasswordFor(props.user, props.email);
  await props.user.type(screen.getByLabelText('Password'), props.password);
  await props.user.click(screen.getByRole('button', { name: 'Sign in' }));
}

async function expectPasswordSignInAlert(props: {
  readonly alertText: string;
  readonly email?: string;
  readonly password?: string;
}) {
  const user = userEvent.setup();
  render(<SignInForm callbackUrl="/fleet" />);

  await submitPasswordStep({
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

  await submitPasswordStep({
    email: 'new-sailor@mit.edu',
    password: 'correct-password',
    user,
  });
  await user.click(
    await screen.findByRole('button', { name: 'Send verification code' })
  );
}

describe('SignInForm', () => {
  it('starts with email only and reveals password for active users', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    expect(screen.queryByLabelText('Password')).toBeNull();

    await submitEmailStep(user, ' Sailor@MIT.EDU ');

    expect(signInEmailActionMock.resolveSignInEmailAction).toHaveBeenCalledWith(
      {
        email: 'sailor@mit.edu',
      }
    );
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
  });

  it('sends reset-required users to create a password', async () => {
    await expectEmailStepRedirect({
      expectedPath:
        '/reset-password?email=legacy%40mit.edu&codeSent=1&mode=create-password&callbackUrl=%2Ffleet',
      resolvedEmail: 'legacy@mit.edu',
      state: 'reset_required',
    });
  });

  it('shows reset delivery failure when create-password email cannot be sent', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      email: 'legacy@mit.edu',
      state: 'reset_failed',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await submitEmailStep(user, 'legacy@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code.'
    );
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('sends unknown emails to sign up', async () => {
    await expectEmailStepRedirect({
      expectedPath: '/signup?email=new%40mit.edu&callbackUrl=%2Ffleet',
      resolvedEmail: 'new@mit.edu',
      state: 'sign_up',
    });
  });

  it('shows invalid email message when server rejects submitted email', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      state: 'invalid_email',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await submitEmailStep(user, 'sailor@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('shows request failure when email lookup fails', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockRejectedValue(
      new Error('network')
    );

    render(<SignInForm callbackUrl="/fleet" />);

    await submitEmailStep(user, 'sailor@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.email_lookup.thrown',
      code: undefined,
      message: 'network',
    });
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('clears password and returns to email step when email changes', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'other@mit.edu');

    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Continue' })
    ).toBeInTheDocument();
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
  });

  it('does not sign in when password step has an invalid email', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      email: 'sailor@mit',
      state: 'password',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await submitEmailStep(user, 'sailor@mit.edu');
    await screen.findByLabelText('Password');
    const form = screen.getByLabelText('Email').closest('form');
    if (!form) {
      throw new Error('Expected sign-in form.');
    }
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
  });

  it('Visitor signs in and returns to the requested page', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await submitPasswordStep({
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

    await submitEmailStep(user, 'sailor@mit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
  });

  it('Locked-out sailor sees the lockout recovery message', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'ACCOUNT_LOCKED' },
    });

    await expectPasswordSignInAlert({
      alertText: 'Your account is temporarily locked',
      email: 'locked@mit.edu',
    });
  });

  it('Banned sailor sees the disabled-account message', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'BANNED_USER' },
    });

    await expectPasswordSignInAlert({
      alertText: 'Your account has been disabled. Contact support.',
      email: 'banned@mit.edu',
      password: 'correct-password',
    });
  });

  it('Visitor sees credentials message after a failed sign-in', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    await expectPasswordSignInAlert({
      alertText: 'Invalid email or password.',
    });
  });

  it('Visitor sees rate-limit message after too many sign-in attempts', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    await expectPasswordSignInAlert({ alertText: 'Too many attempts.' });
  });

  it('Visitor sees credentials message after an unexpected sign-in error', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      error: { message: 'Account requires staff approval.' },
    });

    await expectPasswordSignInAlert({
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

    await expectPasswordSignInAlert({
      alertText: 'Invalid email or password.',
    });

    expect(reportUnknownAuthClientErrorMock).not.toHaveBeenCalled();
  });

  it('Visitor sees request-failed message when sign-in throws', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockRejectedValue(new Error('network'));

    render(<SignInForm callbackUrl="/fleet" />);

    await submitPasswordStep({
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

  it('Unverified sailor uses normalized email for OTP and verify-email redirect', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await submitPasswordStep({
      email: ' Sailor@MIT.EDU ',
      password: 'correct-password',
      user,
    });
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(authClientMock.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'sailor@mit.edu',
      type: 'email-verification',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
  });

  it('Unverified sailor requests a verification code from sign-in', async () => {
    await submitUnverifiedResend();

    expect(authClientMock.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'new-sailor@mit.edu',
      type: 'email-verification',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=new-sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
  });

  it('Unverified sailor sees delivery message when verification resend is blocked', async () => {
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts.'
    );
  });

  it('Unverified sailor sees delivery message when verification resend fails', async () => {
    authClientMock.emailOtp.sendVerificationOtp.mockRejectedValue(
      new Error('network')
    );

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_in.send_verification_otp.thrown',
      code: undefined,
      message: 'network',
    });
  });

  it('Unverified sailor sees fallback message when verification resend has no details', async () => {
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    await submitUnverifiedResend();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Unverified sailor does not see backend text when resend returns EMAIL_NOT_VERIFIED', async () => {
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
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

    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('Visitor follows forgot-password link without malformed email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toHaveAttribute('href', '/forgot-password?callbackUrl=%2Ffleet');
  });

  it('Visitor does not request reset from the login page', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
    expect(componentTestRouter().push).not.toHaveBeenCalledWith(
      '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
  });
});
