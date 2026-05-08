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

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.signUp.email.mockResolvedValue({});
});

async function fillSignUpForm(props: {
  email: string;
  name?: string;
  password: string;
  passwordConfirmation?: string;
}) {
  const user = userEvent.setup();

  if (props.name) {
    await user.type(screen.getByLabelText('Name (optional)'), props.name);
  }
  await user.type(screen.getByLabelText('Email'), props.email);
  await user.type(screen.getByLabelText('Password'), props.password);
  await user.type(
    screen.getByLabelText('Confirm password'),
    props.passwordConfirmation ?? props.password
  );

  return user;
}

describe('SignUpForm', () => {
  it('visitor creates an account and continues to email verification', async () => {
    render(<SignUpForm callbackUrl="/fleet/" />);

    const user = await fillSignUpForm({
      email: 'new-sailor@mit.edu',
      name: 'New Sailor',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      callbackURL: '/fleet/',
      email: 'new-sailor@mit.edu',
      name: 'New Sailor',
      password: 'correct-password',
    });
    expect(
      await screen.findByText('Check your email for a verification code.')
    ).toBeVisible();
    expect(componentTestRouter().push).toHaveBeenCalledWith(
      '/verify-email?email=new-sailor%40mit.edu&codeSent=1&callbackUrl=%2Ffleet%2F'
    );
  });

  it('visitor creates an account with the email name when name is blank', async () => {
    render(<SignUpForm callbackUrl="/fleet/" />);

    const user = await fillSignUpForm({
      email: 'deckhand@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      callbackURL: '/fleet/',
      email: 'deckhand@mit.edu',
      name: 'deckhand',
      password: 'correct-password',
    });
  });

  it('visitor sees sign-in recovery links for an existing email', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'EMAIL_EXISTS' },
    });
    render(<SignUpForm callbackUrl="/fleet/" />);

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
      '/login?callbackUrl=%2Ffleet%2F'
    );
    expect(
      screen.getByRole('link', { name: 'Reset password' })
    ).toHaveAttribute('href', '/forgot-password?callbackUrl=%2Ffleet%2F');
  });

  it('visitor keeps the form when password confirmation does not match', async () => {
    render(<SignUpForm callbackUrl="/fleet/" />);

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

  it('visitor sees a safe error before submitting an invalid sign-up email', async () => {
    render(<SignUpForm callbackUrl="/fleet/" />);

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

  it('visitor sees breached-password message from sign-up', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'PASSWORD_COMPROMISED' },
    });
    render(<SignUpForm callbackUrl="/fleet/" />);

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

  it('visitor sees rate-limit message from sign-up', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { message: 'TOO_MANY_REQUESTS' },
    });
    render(<SignUpForm callbackUrl="/fleet/" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-up attempts.'
    );
  });

  it('visitor sees rate-limit message from sign-up error code', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });
    render(<SignUpForm callbackUrl="/fleet/" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-up attempts.'
    );
  });

  it('visitor sees provider message from an unexpected sign-up error', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      error: { message: 'Invite is required.' },
    });
    render(<SignUpForm callbackUrl="/fleet/" />);

    const user = await fillSignUpForm({
      email: 'member@mit.edu',
      password: 'correct-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invite is required.'
    );
  });
});
