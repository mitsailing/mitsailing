import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/components/shell/AppThemeProvider';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import { componentTestRouter } from '@/test/component';
import { ProfileAccountClient } from './ProfileAccountClient';

const LOCALE = 'en';

const authClientMock = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  updateUser: vi.fn(),
}));

const updateThemePreferenceActionMock = vi.hoisted(() => vi.fn());
const updateProfileDetailsActionMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

vi.mock('@/libs/auth/themePreferenceActions', () => ({
  updateThemePreferenceAction: updateThemePreferenceActionMock,
}));

vi.mock('@/libs/auth/profileIdentityActions', () => ({
  updateProfileDetailsAction: updateProfileDetailsActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.changeEmail.mockResolvedValue({});
  updateProfileDetailsActionMock.mockResolvedValue({
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
        locale={LOCALE}
        {...props}
      />
    </AppThemeProvider>
  );
}

async function requestConfirmationLink(
  user: ReturnType<typeof userEvent.setup>,
  email: string
) {
  await user.clear(screen.getByLabelText('New email'));
  await user.type(screen.getByLabelText('New email'), email);
  await user.click(
    screen.getByRole('button', { name: 'Send confirmation link' })
  );
}

async function expectContactUpdateError(options: {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  error: string;
  message: string;
}) {
  const user = userEvent.setup();
  updateProfileDetailsActionMock.mockResolvedValue({
    ok: false,
    error: options.error,
  });
  renderAccountClient({
    initialEmergencyContactName: 'Jane Sailor',
    initialEmergencyContactPhone: '+16175550100',
  });

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
  await user.click(
    screen.getByRole('button', { name: 'Save profile details' })
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(options.message);
}

describe('ProfileAccountClient', () => {
  it('shows profile details before sailing card section', () => {
    renderAccountClient();

    const detailsSection = screen
      .getByRole('heading', { name: 'Profile details' })
      .closest('section');
    const sailingCardSection = screen
      .getByRole('heading', { name: 'Sailing card' })
      .closest('section');

    if (detailsSection === null || sailingCardSection === null) {
      throw new Error('Expected profile details and sailing card sections.');
    }
    const parent = detailsSection.parentElement;
    if (parent === null || parent !== sailingCardSection.parentElement) {
      throw new Error('Expected profile sections to share a parent.');
    }

    const siblings = [...parent.children];
    expect(siblings.indexOf(detailsSection)).toBeLessThan(
      siblings.indexOf(sailingCardSection)
    );
    expect(
      screen.queryByRole('heading', { name: 'Old Name' })
    ).not.toBeInTheDocument();
  });

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
      screen.getByRole('button', { name: 'Send confirmation link' })
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

  it('profile owner saves profile details with name, phone, and emergency contact', async () => {
    const user = userEvent.setup();
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+442079460958',
      initialPhone: '+16175550100',
    });

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'New');
    await user.clear(screen.getByLabelText('Last name'));
    await user.type(screen.getByLabelText('Last name'), 'Name');
    await user.selectOptions(screen.getByLabelText('Affiliation'), [
      SailingAffiliation.WELLESLEY,
    ]);
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '(617) 555-0111');
    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(updateProfileDetailsActionMock).toHaveBeenCalledWith('en', {
      affiliation: SailingAffiliation.WELLESLEY,
      emergencyContactName: 'Jane Sailor',
      emergencyContactPhone: '+44 20 7946 0958',
      firstName: 'New',
      lastName: 'Name',
      mitId: '',
      phone: '(617) 555-0111',
    });
    expect(await screen.findByText('Profile details saved.')).toBeVisible();
    expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
  });

  it('requires emergency contact details on profile updates', () => {
    renderAccountClient();

    expect(
      screen.getByText('Emergency contact name and phone are required.')
    ).toBeVisible();
    expect(screen.getByLabelText('Emergency contact name')).toBeRequired();
    expect(screen.getByLabelText('Emergency contact phone')).toBeRequired();
  });

  it('profile owner adds member names when the profile has none', async () => {
    const user = userEvent.setup();
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+16175550100',
      initialFirstName: '',
      initialLastName: '',
      initialPhone: '+16175550100',
    });

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'Name');
    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(updateProfileDetailsActionMock).toHaveBeenCalledWith('en', {
      affiliation: SailingAffiliation.OTHER_NON_STUDENT,
      emergencyContactName: 'Jane Sailor',
      emergencyContactPhone: '(617) 555-0100',
      firstName: 'New',
      lastName: 'Name',
      mitId: '',
      phone: '(617) 555-0100',
    });
    expect(await screen.findByText('Profile details saved.')).toBeVisible();
  });

  it('profile owner can update contact fields when MIT identity is locked', () => {
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
      screen.getByRole('button', { name: 'Save profile details' })
    ).toBeEnabled();
    expect(
      screen.getByText(
        'Your name and MIT affiliation are verified from your linked MIT ID. You can still update phone and emergency contact.'
      )
    ).toBeVisible();
  });

  it('profile owner sees member information validation errors', async () => {
    const user = userEvent.setup();
    updateProfileDetailsActionMock.mockResolvedValue({
      ok: false,
      error: 'first_name_required',
    });
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+16175550100',
      initialPhone: '+16175550100',
    });

    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your first name.'
    );
  });

  it('profile owner sees request failed when member information update throws', async () => {
    const user = userEvent.setup();
    updateProfileDetailsActionMock.mockRejectedValue(new Error('network'));
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+16175550100',
      initialPhone: '+16175550100',
    });

    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
  });

  it('profile owner updates contact phones in profile details', async () => {
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
    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(updateProfileDetailsActionMock).toHaveBeenCalledWith('en', {
      affiliation: SailingAffiliation.OTHER_NON_STUDENT,
      emergencyContactName: 'Jane Sailor',
      emergencyContactPhone: '+44 20 7946 0958',
      firstName: 'Old',
      lastName: 'Name',
      mitId: '',
      phone: '(617) 555-0111',
    });
    expect(await screen.findByText('Profile details saved.')).toBeVisible();
  });

  it('profile owner sees phone validation errors', async () => {
    const user = userEvent.setup();
    updateProfileDetailsActionMock.mockResolvedValue({
      ok: false,
      error: 'invalid_phone',
    });
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+16175550100',
    });

    await user.type(screen.getByLabelText('Phone'), '+44 20 7946 0958');
    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

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
      message: 'Could not update profile details.',
    });
  });

  it('profile owner sees fallback when contact update throws', async () => {
    const user = userEvent.setup();
    updateProfileDetailsActionMock.mockRejectedValue(new Error('network'));
    renderAccountClient({
      initialEmergencyContactName: 'Jane Sailor',
      initialEmergencyContactPhone: '+16175550100',
    });

    await user.type(screen.getByLabelText('Phone'), '(617) 555-0100');
    await user.click(
      screen.getByRole('button', { name: 'Save profile details' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
  });

  it('email-change persona requests confirmation for a new address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationLink(user, 'next@mit.edu');

    expect(authClientMock.changeEmail).toHaveBeenCalledWith({
      callbackURL: '/profile',
      newEmail: 'next@mit.edu',
    });
    expect(
      await screen.findByText(
        'Confirmation link sent. Open it from your current address to approve the change.'
      )
    ).toBeVisible();
  });

  it('email-change persona normalizes a new address before requesting confirmation', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationLink(user, '  Next@MIT.EDU  ');

    expect(authClientMock.changeEmail).toHaveBeenCalledWith({
      callbackURL: '/profile',
      newEmail: 'next@mit.edu',
    });
  });

  it('email-change persona sees a clear error for the current address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationLink(user, '  Owner@MIT.EDU  ');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That is already your login email.'
    );
    expect(authClientMock.changeEmail).not.toHaveBeenCalled();
  });

  it('email-change persona sees a clear error for an invalid address', async () => {
    const user = userEvent.setup();
    renderAccountClient();

    await requestConfirmationLink(user, 'next@mit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check the email address and try again.'
    );
    expect(authClientMock.changeEmail).not.toHaveBeenCalled();
  });

  it('email-change persona sees mapped message when a new address is unavailable', async () => {
    const user = userEvent.setup();
    authClientMock.changeEmail.mockResolvedValue({
      error: { code: 'EMAIL_EXISTS' },
    });
    renderAccountClient();

    await requestConfirmationLink(user, 'taken@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email is already in the system.'
    );
  });

  it('email-change persona sees request failed when change request throws', async () => {
    const user = userEvent.setup();
    authClientMock.changeEmail.mockRejectedValue(new Error('network'));
    renderAccountClient();

    await requestConfirmationLink(user, 'next@mit.edu');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete that request right now.'
    );
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
