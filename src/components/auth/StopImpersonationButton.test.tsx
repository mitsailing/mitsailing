import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { StopImpersonationButton } from './StopImpersonationButton';

const authClientMock = vi.hoisted(() => ({
  admin: {
    stopImpersonating: vi.fn(),
  },
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.admin.stopImpersonating.mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StopImpersonationButton', () => {
  it('exit impersonation and return to admin users', async () => {
    const user = userEvent.setup();
    const router = componentTestRouter();

    render(
      <StopImpersonationButton
        errorLabel="Could not exit impersonation."
        label="Exit impersonation"
        locale="en"
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Exit impersonation' })
    );

    await waitFor(() => {
      expect(authClientMock.admin.stopImpersonating).toHaveBeenCalledTimes(1);
    });
    expect(router.push).toHaveBeenCalledWith('/admin/users');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('show error when impersonation exit fails', async () => {
    const user = userEvent.setup();
    const router = componentTestRouter();
    authClientMock.admin.stopImpersonating.mockRejectedValue(
      new Error('network')
    );

    render(
      <StopImpersonationButton
        errorLabel="Could not exit impersonation."
        label="Exit impersonation"
        locale="en"
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Exit impersonation' })
    );

    await waitFor(() => {
      expect(authClientMock.admin.stopImpersonating).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not exit impersonation.'
    );
    expect(console.error).toHaveBeenCalledWith(
      'StopImpersonationButton stop impersonation failed.',
      expect.any(Error)
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
