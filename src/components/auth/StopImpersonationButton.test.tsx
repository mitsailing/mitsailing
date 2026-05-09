import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('StopImpersonationButton', () => {
  it('Impersonating admin exits back to admin users', async () => {
    const user = userEvent.setup();
    const router = componentTestRouter();

    render(<StopImpersonationButton label="Exit impersonation" locale="en" />);

    await user.click(
      screen.getByRole('button', { name: 'Exit impersonation' })
    );

    await waitFor(() => {
      expect(authClientMock.admin.stopImpersonating).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/admin/users');
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
