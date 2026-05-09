import { render, screen } from '@testing-library/react';
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

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({});
  authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({});
  authClientMock.signIn.email.mockResolvedValue({});
});

describe('SignInForm', () => {
  it('Visitor signs in and returns to the requested page', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), ' Sailor@MIT.EDU ');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      callbackURL: '/fleet/',
      email: 'sailor@mit.edu',
      password: 'correct-password',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith('/fleet/');
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('Visitor sees a safe error before submitting an invalid email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'locked@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'banned@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account has been disabled. Contact support if you believe this is an error.'
    );
  });

  it('Visitor sees credentials message after a failed sign-in', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('Visitor sees request-failed message when sign-in throws', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockRejectedValue(new Error('network'));

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), ' Sailor@MIT.EDU ');
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
      '/verify-email?email=sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
    );
  });

  it('Unverified sailor requests a verification code from sign-in', async () => {
    const user = userEvent.setup();
    authClientMock.signIn.email.mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED' },
    });

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'new-sailor@mit.edu');
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
      '/verify-email?email=new-sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'new-sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'new-sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'new-sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'new-sailor@mit.edu');
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

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
    );
  });

  it('Visitor cannot start two inline reset requests at once', async () => {
    const user = userEvent.setup();
    const pendingReset = Promise.withResolvers<never>().promise;
    authClientMock.emailOtp.requestPasswordReset.mockReturnValue(pendingReset);

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.dblClick(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledTimes(
      1
    );
  });

  it('Visitor follows the forgot-password link without an entered email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('Visitor sees invalid email message when forgot password is clicked with malformed email', async () => {
    const user = userEvent.setup();

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'sailor@mit');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address with a domain'
    );
    expect(authClientMock.emailOtp.requestPasswordReset).not.toHaveBeenCalled();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('Visitor continues when inline reset returns an opaque error', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(authClientMock.emailOtp.requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@mit.edu',
    });
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/reset-password?email=reset%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Visitor sees reset message when inline reset delivery fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestPasswordReset.mockRejectedValue(
      new Error('network')
    );

    render(<SignInForm callbackUrl="/fleet/" />);

    await user.type(screen.getByLabelText('Email'), 'reset@mit.edu');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send a reset code right now.'
    );
  });
});
