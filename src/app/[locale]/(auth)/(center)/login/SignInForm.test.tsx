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

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
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

describe('SignInForm', () => {
  it('starts with email only and reveals password for active users', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    expect(screen.queryByLabelText('Password')).toBeNull();

    await user.type(screen.getByLabelText('Email'), ' Sailor@MIT.EDU ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(signInEmailActionMock.resolveSignInEmailAction).toHaveBeenCalledWith(
      {
        email: 'sailor@mit.edu',
      }
    );
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
  });

  it('sends reset-required users to create a password', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      email: 'legacy@mit.edu',
      state: 'reset_required',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'legacy@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/reset-password?email=legacy%40mit.edu&codeSent=1&mode=create-password&callbackUrl=%2Ffleet'
    );
  });

  it('shows reset delivery failure when create-password email cannot be sent', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      email: 'legacy@mit.edu',
      state: 'reset_failed',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'legacy@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code.'
    );
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('sends unknown emails to sign up', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      email: 'new@mit.edu',
      state: 'sign_up',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'new@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/signup?email=new%40mit.edu&callbackUrl=%2Ffleet'
    );
  });

  it('shows invalid email message when server rejects submitted email', async () => {
    const user = userEvent.setup();
    signInEmailActionMock.resolveSignInEmailAction.mockResolvedValue({
      state: 'invalid_email',
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

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

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
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

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
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

    await revealPasswordFor(user, ' Sailor@MIT.EDU ');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

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

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.signIn.email).not.toHaveBeenCalled();
  });

  it('Locked-out sailor sees the lockout recovery message', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'ACCOUNT_LOCKED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'locked@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account is temporarily locked'
    );
  });

  it('Banned sailor sees the disabled-account message', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'BANNED_USER' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'banned@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account has been disabled. Contact support.'
    );
  });

  it('Visitor sees credentials message after a failed sign-in', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Visitor sees rate-limit message after too many sign-in attempts', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts.'
    );
  });

  it('Visitor sees credentials message after an unexpected sign-in error', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { message: 'Account requires staff approval.' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Visitor sees credentials message when sign-in fails without details', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: {},
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Visitor sees request-failed message when sign-in throws', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockRejectedValue(new Error('network'));

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });

  it('Unverified sailor uses normalized email for OTP and verify-email redirect', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, ' Sailor@MIT.EDU ');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
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
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'new-sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(authClientMock.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'new-sailor@mit.edu',
      type: 'email-verification',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=new-sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
  });

  it('Unverified sailor sees delivery message when verification resend is blocked', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'new-sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts.'
    );
  });

  it('Unverified sailor sees delivery message when verification resend fails', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });
    authClientMock.emailOtp.sendVerificationOtp.mockRejectedValue(
      new Error('network')
    );

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'new-sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
  });

  it('Unverified sailor sees fallback message when verification resend has no details', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'new-sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Unverified sailor does not see backend text when resend returns EMAIL_NOT_VERIFIED', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });
    authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'DO_NOT_SHOW_RAW_BACKEND_COPY',
      },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await revealPasswordFor(user, 'new-sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send verification code' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
    expect(screen.queryByText(/DO_NOT_SHOW_RAW_BACKEND_COPY/)).toBeNull();
  });

  it('Visitor requests a password reset from the entered email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), ' Reset@MIT.EDU ');
    const resetButton = screen.getByRole('button', {
      name: 'Forgot password?',
    });
    await user.click(resetButton);

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet'
    );
    expect(
      screen.getByRole('button', { name: 'Forgot password?' })
    ).not.toBeDisabled();
  });

  it('Visitor retries inline reset after successful navigation stays mounted', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledTimes(
      2
    );
  });

  it('Visitor cannot start two inline reset requests at once', async () => {
    const user = userEvent.setup();
    // eslint-disable-next-line promise/avoid-new -- pending promise keeps the first reset request in flight
    const pendingReset = new Promise<never>(() => {});
    authClientMock.emailOtp.requestPasswordReset.mockReturnValue(pendingReset);

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    const resetButton = screen.getByRole('button', {
      name: 'Forgot password?',
    });
    fireEvent.click(resetButton);
    fireEvent.click(resetButton);

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledTimes(
      1
    );
  });

  it('Visitor follows the forgot-password link without an entered email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('Visitor sees invalid email message when forgot password is clicked with malformed email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('Visitor sees reset message when inline reset returns an error', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code.'
    );
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('Visitor sees reset message when inline reset delivery fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
      new Error('network')
    );

    render(<SignInForm callbackUrl="/fleet" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code.'
    );
  });
});
