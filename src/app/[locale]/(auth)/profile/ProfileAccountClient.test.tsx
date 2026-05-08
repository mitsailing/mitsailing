import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/components/shell/AppThemeProvider';
import { componentTestRouter } from '@/test/component';
import { ProfileAccountClient } from './ProfileAccountClient';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    changeEmail: vi.fn(),
    requestEmailChange: vi.fn(),
  },
  updateUser: vi.fn(),
}));

const updateThemePreferenceActionMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/themePreferenceActions', () => ({
  updateThemePreferenceAction: updateThemePreferenceActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.changeEmail.mockResolvedValue({});
  authClientMock.emailOtp.requestEmailChange.mockResolvedValue({});
  authClientMock.updateUser.mockResolvedValue({});
  updateThemePreferenceActionMock.mockResolvedValue({ ok: true });
  document.documentElement.className = '';
});

afterEach(() => {
  vi.useRealTimers();
});

function renderAccountClient(
  props?: Partial<React.ComponentProps<typeof ProfileAccountClient>>
) {
  render(
    <AppThemeProvider defaultTheme="light">
      <ProfileAccountClient
        initialEmail="owner@mit.edu"
        initialName="Old Name"
        initialThemePreference="LIGHT"
        initialUnconfirmedEmail={null}
        {...props}
      />
    </AppThemeProvider>
  );
}

async function requestConfirmationCode(
  user: ReturnType<typeof userEvent.setup>,
  email: string
) {
  await user.clear(screen.getByLabelText('New email'));
  await user.type(screen.getByLabelText('New email'), email);
  await user.click(
    screen.getByRole('button', { name: 'Send confirmation code' })
  );
}

function requestConfirmationCodeWithFireEvent(email: string) {
  fireEvent.change(screen.getByLabelText('New email'), {
    target: { value: email },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Send confirmation code' })
  );
}

describe('ProfileAccountClient', () => {
  it('profile owner updates their display name', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(authClientMock.updateUser).toHaveBeenCalledWith({
      name: 'New Name',
    });
    expect(await screen.findByText('Your name was updated.')).toBeVisible();
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('profile owner adds a display name when the profile has none', async () => {
    const user = userEvent.setup();
    renderAccountClient({ initialName: null });

    await user.type(screen.getByLabelText('Name'), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(authClientMock.updateUser).toHaveBeenCalledWith({
      name: 'New Name',
    });
    expect(await screen.findByText('Your name was updated.')).toBeVisible();
  });

  it('profile owner sees a clear error when the name is unchanged', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a different name before saving.'
    );
    expect(authClientMock.updateUser).not.toHaveBeenCalled();
  });

  it('profile owner sees provider message when a name update fails', async () => {
    const user = userEvent.setup();
    authClientMock.updateUser.mockResolvedValue({
      error: { message: 'Name contains unsupported characters.' },
    });
    renderAccountClient();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name contains unsupported characters.'
    );
  });

  it('profile owner sees fallback message when a name update fails without provider message', async () => {
    const user = userEvent.setup();
    authClientMock.updateUser.mockResolvedValue({
      error: {},
    });
    renderAccountClient();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update your name.'
    );
  });

  it('email-change persona requests confirmation for a new address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationCode(user, 'next@mit.edu');

    expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledWith({
      newEmail: 'next@mit.edu',
    });
    expect(
      await screen.findByText(
        'Confirmation code sent. Enter it below to finish changing your email.'
      )
    ).toBeVisible();
    expect(screen.getByText('next@mit.edu')).toBeVisible();
  });

  it('email-change persona normalizes a new address before requesting confirmation', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationCode(user, '  Next@MIT.EDU  ');

    expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledWith({
      newEmail: 'next@mit.edu',
    });
    expect(await screen.findByText('next@mit.edu')).toBeVisible();
  });

  it('email-change persona sees a clear error for the current address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationCode(user, '  Owner@MIT.EDU  ');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That is already your login email.'
    );
    expect(authClientMock.emailOtp.requestEmailChange).not.toHaveBeenCalled();
  });

  it('email-change persona sees a clear error for an invalid address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationCode(user, 'next@mit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check the email address and try again.'
    );
    expect(authClientMock.emailOtp.requestEmailChange).not.toHaveBeenCalled();
  });

  it('email-change persona sees mapped message when a new address is unavailable', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestEmailChange.mockResolvedValue({
      error: { code: 'EMAIL_EXISTS' },
    });
    renderAccountClient();

    await requestConfirmationCode(user, 'taken@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email is already in the system.'
    );
  });

  it('email-change persona confirms the pending email code', async () => {
    const user = userEvent.setup();
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.type(screen.getByLabelText('Confirmation code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));

    expect(authClientMock.emailOtp.changeEmail).toHaveBeenCalledWith({
      newEmail: 'next@mit.edu',
      otp: '123456',
    });
    expect(
      await screen.findByText('Your email address has been updated.')
    ).toBeVisible();
    expect(screen.getByText('next@mit.edu')).toBeVisible();
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('email-change persona sees invalid-code message when confirmation fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.changeEmail.mockResolvedValue({
      error: { code: 'INVALID_OTP' },
    });
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.type(screen.getByLabelText('Confirmation code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is invalid.'
    );
    expect(screen.getByText('next@mit.edu')).toBeVisible();
  });

  it('email-change persona sees request failed when confirmation throws', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.changeEmail.mockRejectedValue(new Error('network'));
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.type(screen.getByLabelText('Confirmation code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(screen.getByRole('button', { name: 'Confirm email' })).toBeEnabled();
  });

  it('email-change persona resends a pending confirmation code', async () => {
    const user = userEvent.setup();
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledWith({
      newEmail: 'next@mit.edu',
    });
    expect(
      await screen.findByText(
        (_content, element) =>
          element?.textContent === 'New confirmation code sent to next@mit.edu.'
      )
    ).toBeVisible();
  });

  it('email-change persona sees resend unlock after the cooldown', async () => {
    vi.useFakeTimers();
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await vi.waitFor(() => {
      expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledTimes(
        1
      );
    });

    expect(
      screen.getByRole('button', {
        name: 'You can request a new code in 30 seconds',
      })
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('email-change persona keeps resend cooldown anchored to the latest change request', async () => {
    vi.useFakeTimers();
    renderAccountClient();

    act(() => {
      requestConfirmationCodeWithFireEvent('first@mit.edu');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await vi.waitFor(() => {
      expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledTimes(
        1
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    act(() => {
      requestConfirmationCodeWithFireEvent('second@mit.edu');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await vi.waitFor(() => {
      expect(authClientMock.emailOtp.requestEmailChange).toHaveBeenCalledTimes(
        2
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });

    expect(
      screen.getByRole('button', {
        name: 'You can request a new code in 30 seconds',
      })
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('email-change persona sees resend message when delivery fails', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestEmailChange.mockResolvedValue({
      error: { code: 'TOO_MANY_REQUESTS' },
    });
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not resend the confirmation code.'
    );
  });

  it('email-change persona sees request failed when resend throws', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestEmailChange.mockRejectedValue(
      new Error('network')
    );
    renderAccountClient({ initialUnconfirmedEmail: 'next@mit.edu' });

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('profile owner saves a dark appearance preference', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(updateThemePreferenceActionMock).toHaveBeenCalledWith('en', 'dark');
    expect(await screen.findByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(document.documentElement).toHaveClass('dark');
  });

  it('profile owner sees an appearance error when saving fails', async () => {
    const user = userEvent.setup();
    updateThemePreferenceActionMock.mockResolvedValue({ ok: false });
    renderAccountClient();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save appearance.'
    );
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });
  });
});
