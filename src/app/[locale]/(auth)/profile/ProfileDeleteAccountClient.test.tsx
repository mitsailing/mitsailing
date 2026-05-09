import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { ProfileDeleteAccountClient } from './ProfileDeleteAccountClient';

const authClientMock = vi.hoisted(() => ({
  deleteUser: vi.fn(),
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.deleteUser.mockResolvedValue({});
});

async function fillDeleteForm(props: {
  confirmation: string;
  password: string;
}) {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Current password'), props.password);
  await user.type(
    screen.getByLabelText('Type DELETE to confirm'),
    props.confirmation
  );

  return user;
}

describe('ProfileDeleteAccountClient', () => {
  it('profile owner requests account deletion with explicit confirmation', async () => {
    render(<ProfileDeleteAccountClient signInHref="/login" />);

    const user = await fillDeleteForm({
      confirmation: 'DELETE',
      password: 'current-password',
    });
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(authClientMock.deleteUser).toHaveBeenCalledWith({
      password: 'current-password',
    });
    expect(
      await screen.findByText('Check your email to confirm account deletion.')
    ).toBeVisible();
    expect(componentTestRouter().push).toHaveBeenCalledWith('/login');
  });

  it('profile owner must type DELETE before account deletion is submitted', async () => {
    render(<ProfileDeleteAccountClient signInHref="/login" />);

    const user = await fillDeleteForm({
      confirmation: 'delete',
      password: 'current-password',
    });
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check the confirmation field and try again.'
    );
    expect(authClientMock.deleteUser).not.toHaveBeenCalled();
  });

  it('profile owner sees password guidance when deletion is rejected', async () => {
    authClientMock.deleteUser.mockResolvedValue({
      error: { code: 'INVALID_PASSWORD' },
    });
    render(<ProfileDeleteAccountClient signInHref="/login" />);

    const user = await fillDeleteForm({
      confirmation: 'DELETE',
      password: 'wrong-password',
    });
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The password you entered is incorrect.'
    );
  });
});
