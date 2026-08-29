import * as Sentry from '@sentry/nextjs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { SignOutForm } from './SignOutForm';

const authClientMock = vi.hoisted(() => ({
  signOut: vi.fn(),
}));
const reportUnknownAuthClientErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/reportAuthClientError', () => ({
  reportUnknownAuthClientError: reportUnknownAuthClientErrorMock,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.signOut.mockResolvedValue({});
});

describe('SignOutForm', () => {
  it('sailor signs out and returns to the localized sign-in page', async () => {
    const user = userEvent.setup();
    const onSignOutStart = vi.fn();

    render(
      <SignOutForm
        label="Sign out"
        locale="en"
        onSignOutStart={onSignOutStart}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onSignOutStart).toHaveBeenCalledTimes(1);
    expect(authClientMock.signOut).toHaveBeenCalledTimes(1);
    expect(componentTestRouter().push).toHaveBeenCalledWith('/login');
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('sailor can retry sign-out when the network fails', async () => {
    const user = userEvent.setup();
    authClientMock.signOut.mockRejectedValue(new Error('offline'));

    render(<SignOutForm label="Sign out" locale="en" />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { authAction: 'sign_out' },
    });
    expect(
      await screen.findByRole('button', { name: 'Sign out' })
    ).toBeEnabled();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });

  it('sailor can retry sign-out when auth client returns an error', async () => {
    const user = userEvent.setup();
    authClientMock.signOut.mockResolvedValue({
      error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
    });

    render(<SignOutForm label="Sign out" locale="en" />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(reportUnknownAuthClientErrorMock).toHaveBeenCalledWith({
      action: 'sign_out',
      code: 'SESSION_EXPIRED',
      message: 'Session expired',
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: 'Sign out' })
    ).toBeEnabled();
    expect(componentTestRouter().push).not.toHaveBeenCalled();
  });
});
