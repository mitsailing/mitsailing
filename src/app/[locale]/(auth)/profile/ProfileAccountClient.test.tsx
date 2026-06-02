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
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import { componentTestRouter } from '@/test/component';
import { ProfileAccountClient } from './ProfileAccountClient';

const LOCALE = 'en';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    changeEmail: vi.fn(),
    requestEmailChange: vi.fn(),
  },
  updateUser: vi.fn(),
}));

const updateThemePreferenceActionMock = vi.hoisted(() => vi.fn());
const updateProfileContactActionMock = vi.hoisted(() => vi.fn());
const updateProfileIdentityActionMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/themePreferenceActions', () => ({
  updateThemePreferenceAction: updateThemePreferenceActionMock,
}));

vi.mock('@/libs/auth/profileContactActions', () => ({
  updateProfileContactAction: updateProfileContactActionMock,
}));

vi.mock('@/libs/auth/profileIdentityActions', () => ({
  updateProfileIdentityAction: updateProfileIdentityActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.changeEmail.mockResolvedValue({});
  authClientMock.emailOtp.requestEmailChange.mockResolvedValue({});
  updateProfileContactActionMock.mockResolvedValue({ ok: true });
  updateProfileIdentityActionMock.mockResolvedValue({
    ok: true,
    identity: {
      affiliation: SailingAffiliation.OTHER_NON_STUDENT,
      firstName: 'New',
      lastName: 'Name',
      lockedByMitId: false,
      mitClassYear: null,
      mitId: null,
      name: 'New Name',
    },
  });
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
        initialEmailDeliverabilityStatus="ok"
        initialEmergencyContactName=""
        initialEmergencyContactPhone=""
        initialFirstName="Old"
        initialLastName="Name"
        initialMitClassYear={null}
        initialMitId={null}
        initialMitIdentityLocked={false}
        initialName="Old Name"
        initialPhone=""
        initialSailingAffiliation={SailingAffiliation.OTHER_NON_STUDENT}
        initialSailingCardSummary={{
          assignment: 'none',
          cardNumber: null,
          cardType: null,
          cardYear: null,
          expiresOnIso: null,
          requestedAtIso: null,
          status: 'not_requested',
          swimAgreementInitialedAtIso: null,
          swimAgreementInitials: null,
        }}
        initialThemePreference="LIGHT"
        initialUnconfirmedEmail={null}
        locale={LOCALE}
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

async function expectContactUpdateError(options: {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  error: string;
  message: string;
}) {
  const user = userEvent.setup();
  updateProfileContactActionMock.mockResolvedValue({
    ok: false,
    error: options.error,
  });
  renderAccountClient();

  await user.type(screen.getByLabelText('Phone'), '(617) 555-0100');
  if (options.emergencyContactName) {
    await user.type(
      screen.getByLabelText('Emergency contact name'),
      options.emergencyContactName
    );
  }
  if (options.emergencyContactPhone) {
    await user.type(
      screen.getByLabelText('Emergency contact phone'),
      options.emergencyContactPhone
    );
  }
  await user.click(screen.getByRole('button', { name: 'Save contact' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(options.message);
}

describe('ProfileAccountClient', () => {
  it('profile owner sees pending sailing card request status', () => {
    renderAccountClient({
      initialSailingCardSummary: {
        assignment: 'pending',
        cardNumber: null,
        cardType: SailingCardType.normal,
        cardYear: 2027,
        expiresOnIso: null,
        requestedAtIso: '2026-05-21T16:00:00.000Z',
        status: 'requested',
        swimAgreementInitialedAtIso: '2026-05-21T16:00:00.000Z',
        swimAgreementInitials: 'AK',
      },
    });

    expect(screen.getByRole('heading', { name: 'Sailing card' })).toBeVisible();
    expect(screen.getAllByText('Requested').length).toBeGreaterThan(0);
    expect(screen.getByText('Card assignment')).toBeVisible();
    expect(screen.getByText('Normal')).toBeVisible();
    expect(
      screen.getByText(
        'Your card request is pending. Pavilion staff will assign and print cards at the Pavilion after review.'
      )
    ).toBeVisible();
    expect(screen.queryByText('Card number')).not.toBeInTheDocument();
  });

  it('profile owner sees active sailing card details', () => {
    renderAccountClient({
      initialSailingCardSummary: {
        assignment: 'issued',
        cardNumber: 61,
        cardType: SailingCardType.racing,
        cardYear: 2027,
        expiresOnIso: '2027-07-15T04:00:00.000Z',
        requestedAtIso: '2026-05-21T16:00:00.000Z',
        status: 'active',
        swimAgreementInitialedAtIso: '2026-05-21T16:00:00.000Z',
        swimAgreementInitials: 'AK',
      },
    });

    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Your sailing card is active for the current card year. Cards are printed by Pavilion staff at the Pavilion.'
      )
    ).toBeVisible();
    expect(screen.getByText('Card number')).toBeVisible();
    expect(screen.getByText('61')).toBeVisible();
  });

  it('profile owner sees non-blocking email deliverability notice', () => {
    renderAccountClient({ initialEmailDeliverabilityStatus: 'bounced' });

    expect(
      screen.getByText('Recent email to this address bounced.')
    ).toBeVisible();
    expect(
      screen.getByText(
        'You can keep using the site, but update your email to receive account notices.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Send confirmation code' })
    ).toBeEnabled();
  });

  it('profile owner sees suppressed email deliverability notice', () => {
    renderAccountClient({ initialEmailDeliverabilityStatus: 'suppressed' });

    expect(
      screen.getByText('Email to this address is suppressed.')
    ).toBeVisible();
    expect(
      screen.getByText(
        'You can keep using the site, but update your email to resume account notices.'
      )
    ).toBeVisible();
  });

  it('profile owner updates member information', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'New');
    await user.clear(screen.getByLabelText('Last name'));
    await user.type(screen.getByLabelText('Last name'), 'Name');
    await user.selectOptions(screen.getByLabelText('Affiliation'), [
      SailingAffiliation.WELLESLEY,
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Save member information' })
    );

    expect(updateProfileIdentityActionMock).toHaveBeenCalledWith('en', {
      affiliation: SailingAffiliation.WELLESLEY,
      firstName: 'New',
      lastName: 'Name',
      mitId: '',
    });
    expect(await screen.findByText('Member information saved.')).toBeVisible();
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('profile owner adds member names when the profile has none', async () => {
    const user = userEvent.setup();
    renderAccountClient({
      initialFirstName: '',
      initialLastName: '',
      initialName: null,
    });

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'Name');
    await user.click(
      screen.getByRole('button', { name: 'Save member information' })
    );

    expect(updateProfileIdentityActionMock).toHaveBeenCalledWith('en', {
      affiliation: SailingAffiliation.OTHER_NON_STUDENT,
      firstName: 'New',
      lastName: 'Name',
      mitId: '',
    });
    expect(await screen.findByText('Member information saved.')).toBeVisible();
  });

  it('profile owner sees locked member information for linked MIT identity', () => {
    renderAccountClient({
      initialFirstName: 'Ada',
      initialLastName: 'Lovelace',
      initialMitClassYear: '2027',
      initialMitId: '123456789',
      initialMitIdentityLocked: true,
      initialSailingAffiliation: SailingAffiliation.MIT_STUDENT,
    });

    expect(screen.getByLabelText('Affiliation')).toBeDisabled();
    expect(screen.getByLabelText('MIT ID')).toBeDisabled();
    expect(screen.getByLabelText('First name')).toBeDisabled();
    expect(screen.getByLabelText('Last name')).toBeDisabled();
    expect(screen.getByLabelText('MIT class/year')).toHaveValue('2027');
    expect(
      screen.getByRole('button', { name: 'Save member information' })
    ).toBeDisabled();
    expect(
      screen.getByText(
        'Your name and MIT affiliation are verified from your linked MIT ID. Contact Pavilion staff if they need to be corrected.'
      )
    ).toBeVisible();
  });

  it('profile owner sees member information validation errors', async () => {
    const user = userEvent.setup();
    updateProfileIdentityActionMock.mockResolvedValue({
      ok: false,
      error: 'first_name_required',
    });
    renderAccountClient();

    await user.click(
      screen.getByRole('button', { name: 'Save member information' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your first name.'
    );
  });

  it('profile owner sees request failed when member information update throws', async () => {
    const user = userEvent.setup();
    updateProfileIdentityActionMock.mockRejectedValue(new Error('network'));
    renderAccountClient();

    await user.click(
      screen.getByRole('button', { name: 'Save member information' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
  });

  it('profile owner updates contact phones', async () => {
    const user = userEvent.setup();
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+442079460958',
      initialPhone: '+16175550100',
    });

    expect(screen.getByLabelText('Phone')).toHaveValue('(617) 555-0100');
    expect(screen.getByLabelText('Emergency contact phone')).toHaveValue(
      '+44 20 7946 0958'
    );

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '(617) 555-0111');
    await user.click(screen.getByRole('button', { name: 'Save contact' }));

    expect(updateProfileContactActionMock).toHaveBeenCalledWith('en', {
      emergencyContactName: 'Jane Sailor',
      emergencyContactPhone: '+44 20 7946 0958',
      phone: '(617) 555-0111',
    });
    expect(await screen.findByText('Contact information saved.')).toBeVisible();
  });

  it('profile owner sees phone validation errors', async () => {
    const user = userEvent.setup();
    updateProfileContactActionMock.mockResolvedValue({
      ok: false,
      error: 'invalid_phone',
    });
    renderAccountClient();

    await user.type(screen.getByLabelText('Phone'), '+44 20 7946 0958');
    await user.click(screen.getByRole('button', { name: 'Save contact' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid US phone number.'
    );
  });

  it('profile owner sees emergency contact validation errors', async () => {
    await expectContactUpdateError({
      emergencyContactPhone: '555',
      error: 'invalid_emergency_phone',
      message: 'Enter a valid emergency phone number.',
    });
  });

  it('profile owner sees incomplete emergency contact errors', async () => {
    await expectContactUpdateError({
      emergencyContactName: 'Jane',
      error: 'incomplete_emergency_contact',
      message: 'Enter both emergency contact name and phone.',
    });
  });

  it('profile owner sees fallback when contact update is unauthorized', async () => {
    await expectContactUpdateError({
      error: 'unauthorized',
      message: 'Could not update contact information.',
    });
  });

  it('profile owner sees fallback when contact update throws', async () => {
    const user = userEvent.setup();
    updateProfileContactActionMock.mockRejectedValue(new Error('network'));
    renderAccountClient();

    await user.type(screen.getByLabelText('Phone'), '(617) 555-0100');
    await user.click(screen.getByRole('button', { name: 'Save contact' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
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

  it('email-change persona sees request failed when change request throws', async () => {
    const user = userEvent.setup();
    authClientMock.emailOtp.requestEmailChange.mockRejectedValue(
      new Error('network')
    );
    renderAccountClient();

    await requestConfirmationCode(user, 'next@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
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
    expect(screen.getAllByText('next@mit.edu').length).toBeGreaterThan(0);
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
      await vi.advanceTimersByTimeAsync(29_000);
    });

    expect(
      screen.getByRole('button', {
        name: 'You can request a new code in 1 second',
      })
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
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
        name: 'You can request a new code in 5 seconds',
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

    expect(updateThemePreferenceActionMock).toHaveBeenCalledWith(
      LOCALE,
      'dark'
    );
    expect(await screen.findByRole('radio', { name: 'Dark' })).toBeChecked();
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
      expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    });
  });
});
