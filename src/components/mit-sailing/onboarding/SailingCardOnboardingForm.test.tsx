import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import { submitSailingCardOnboardingAction } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import type { SailingCardOnboardingFormState } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import {
  SailingCardOnboardingForm,
  defaultSailingCardOnboardingAction,
} from './SailingCardOnboardingForm';

const emptyValues = {
  affiliation: '',
  cardType: 'normal',
  dateOfBirth: '',
  emergencyContactEmail: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  firstName: '',
  lastName: '',
  mitId: '',
  phone: '',
  swimAgreementAccepted: false,
};

const actionStateMock = vi.hoisted(() => ({
  formAction: vi.fn(),
  state: {
    fieldErrors: {},
    status: 'idle',
    values: {
      affiliation: '',
      cardType: 'normal',
      dateOfBirth: '',
      emergencyContactEmail: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      firstName: '',
      lastName: '',
      mitId: '',
      phone: '',
      swimAgreementAccepted: false,
    },
  } as SailingCardOnboardingFormState,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useActionState: vi.fn(() => [
      actionStateMock.state,
      actionStateMock.formAction,
    ]),
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      affiliation_label: 'Affiliation',
      affiliation_mit_student: 'MIT student',
      affiliation_mit_faculty: 'MIT faculty',
      affiliation_mit_staff: 'MIT staff',
      affiliation_mit_alum: 'MIT alum',
      affiliation_mit_family: 'MIT family',
      affiliation_mit_affiliate: 'MIT affiliate',
      affiliation_wellesley: 'Wellesley',
      affiliation_brandeis: 'Brandeis',
      affiliation_northeastern: 'Northeastern',
      affiliation_winsor: 'Winsor',
      affiliation_brooks: 'Brooks',
      affiliation_nrotc: 'NROTC',
      affiliation_other_student: 'Other student',
      affiliation_other_non_student: 'Other non-student',
      affiliation_placeholder: 'Select an affiliation',
      agreement_checkbox_label:
        'I have read and agree to the swim agreement and liability release.',
      agreement_disclosure_summary:
        'Read the swim agreement and liability release',
      card_type_label: 'Type of sailing card requested',
      card_type_normal: 'Normal',
      card_type_racing: 'Racing',
      card_type_team_racing: 'Team racing',
      contact_details_heading: 'Contact details',
      date_of_birth_label: 'Date of birth',
      locked_name_help: 'Verified from MIT Data Warehouse.',
      emergency_contact_email_label: 'Emergency contact email, optional',
      emergency_contact_heading: 'Emergency contact',
      emergency_contact_name_label: 'Emergency contact name',
      emergency_contact_phone_label: 'Emergency contact phone',
      first_name_label: 'First name',
      last_name_label: 'Last name',
      mit_id_label: 'MIT ID',
      mit_class_year_label: 'MIT class/year',
      phone_label: 'Your phone number',
      required: 'Required',
      error_invalid_emergency_phone: 'Enter a valid phone number.',
      error_invalid_email: 'Enter a valid email address.',
      error_invalid_phone: 'Enter a valid US phone number.',
      error_mit_id_affiliation_mismatch: 'Choose the matching MIT affiliation.',
      error_mit_id_invalid_dw_identity:
        'Enter an MIT ID that matches your account.',
      error_mit_id_required_dw_identity: 'Enter your MIT ID.',
      error_required: 'Required.',
      submit: 'Submit',
    };
    return messages[key] ?? key;
  },
}));

vi.mock('@/libs/mit-sailing/sailingCardOnboardingActions', () => ({
  submitSailingCardOnboardingAction: vi.fn(),
}));

function renderForm() {
  render(<SailingCardOnboardingForm />);
}

const selectAffiliation = async (affiliation: SailingAffiliation) => {
  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Affiliation' }),
    affiliation
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  actionStateMock.state = {
    fieldErrors: {},
    status: 'idle',
    values: emptyValues,
  };
});

describe('SailingCardOnboardingForm', () => {
  it('starts the required affiliation combobox on the blank placeholder', () => {
    renderForm();

    const affiliation = screen.getByRole('combobox', { name: 'Affiliation' });

    expect(affiliation).toBeRequired();
    expect(affiliation).toHaveDisplayValue('Select an affiliation');
    expect(affiliation).toHaveValue('');
    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();
  });

  it('renders visible affiliation options in legacy order', () => {
    renderForm();

    const affiliation = screen.getByRole('combobox', { name: 'Affiliation' });
    const options = [...affiliation.querySelectorAll('option')].map(
      (option) => option.textContent
    );

    expect(options).toEqual([
      'Select an affiliation',
      'MIT student',
      'MIT faculty',
      'MIT staff',
      'MIT alum',
      'MIT family',
      'MIT affiliate',
      'Wellesley',
      'Brandeis',
      'Northeastern',
      'Winsor',
      'Brooks',
      'NROTC',
      'Other student',
      'Other non-student',
    ]);
  });

  it('shows required mit id and hides manual name for mit student', async () => {
    renderForm();

    await selectAffiliation(SailingAffiliation.MIT_STUDENT);

    expect(screen.getByLabelText('MIT ID')).toBeRequired();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();
  });

  it('hides mit id and shows required manual name for wellesley', async () => {
    renderForm();

    await selectAffiliation(SailingAffiliation.WELLESLEY);

    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
  });

  it('shows optional mit id and manual name for mit alum', async () => {
    renderForm();

    await selectAffiliation(SailingAffiliation.MIT_ALUM);

    expect(screen.getByLabelText('MIT ID')).toBeInTheDocument();
    expect(screen.getByLabelText('MIT ID')).not.toBeRequired();
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
  });

  it('does not require manual name when optional affiliation has mit id', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_ALUM
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');

    expect(screen.getByLabelText('First name')).not.toBeRequired();
    expect(screen.getByLabelText('Last name')).not.toBeRequired();
  });

  it('shows locked verified identity fields when a data warehouse identity is active', () => {
    render(
      <SailingCardOnboardingForm
        initialValues={{
          ...emptyValues,
          affiliation: SailingAffiliation.MIT_STUDENT,
          mitId: '123456789',
        }}
        lockedIdentity={{
          firstName: 'Ada',
          lastName: 'Lovelace',
          mitClassYear: '2027',
        }}
      />
    );

    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('First name')).toHaveAttribute('readOnly');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('readOnly');
    expect(screen.getByLabelText('MIT class/year')).toHaveValue('2027');
    expect(screen.getByLabelText('MIT class/year')).toHaveAttribute('readOnly');
    expect(
      screen.getAllByText('Verified from MIT Data Warehouse.')
    ).toHaveLength(3);
  });

  it('shows phone and emergency contact controls before affiliation selection', () => {
    renderForm();

    expect(
      screen.getByRole('heading', { name: 'Contact details' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth')).toBeRequired();
    expect(screen.getByLabelText('Your phone number')).toBeRequired();
    expect(
      screen.getByRole('heading', { name: 'Emergency contact' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency contact name')).toBeRequired();
    expect(screen.getByLabelText('Emergency contact phone')).toBeRequired();
    expect(
      screen.getByLabelText('Emergency contact email, optional')
    ).not.toBeRequired();
    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
  });

  it('renders sailing card type options without virtual card', () => {
    renderForm();

    const cardType = screen.getByRole('combobox', {
      name: 'Type of sailing card requested',
    });
    const options = [...cardType.querySelectorAll('option')].map((option) => ({
      label: option.textContent,
      value: option.value,
    }));

    expect(cardType).toHaveDisplayValue('Normal');
    expect(options).toEqual([
      { label: 'Normal', value: 'normal' },
      { label: 'Racing', value: 'racing' },
      { label: 'Team racing', value: 'team_racing' },
    ]);
  });

  it('includes required swim agreement checkbox', () => {
    renderForm();

    const agreement = screen.getByRole('checkbox', {
      name: 'I have read and agree to the swim agreement and liability release.',
    });

    expect(agreement).toBeRequired();
    expect(agreement).toHaveAttribute('name', 'swimAgreementAccepted');
  });

  it('renders agreement and liability release text in a native disclosure', () => {
    renderForm();

    const disclosure = screen.getByText(
      'Read the swim agreement and liability release'
    );

    expect(disclosure.tagName).toBe('SUMMARY');
    for (const paragraph of sailingCardAgreement.text.split('\n\n')) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it('marks mit id invalid when server validation fails', async () => {
    actionStateMock.state = {
      fieldErrors: { mitId: 'required_dw_identity' },
      status: 'error',
      values: emptyValues,
    };

    renderForm();

    await selectAffiliation(SailingAffiliation.MIT_STUDENT);

    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-describedby',
      'sailing-card-onboarding-mitId-error'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your MIT ID.');
  });

  it('renders card type date of birth and emergency email server errors', () => {
    actionStateMock.state = {
      fieldErrors: {
        cardType: 'required',
        dateOfBirth: 'required',
        emergencyContactEmail: 'invalid',
      },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
      },
    };

    renderForm();

    expect(
      screen.getByRole('combobox', { name: 'Type of sailing card requested' })
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByLabelText('Emergency contact email, optional')
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Required.')).toHaveLength(2);
    expect(
      screen.getByText('Enter a valid email address.')
    ).toBeInTheDocument();
  });

  it('uses submit onboarding action by default', () => {
    expect(defaultSailingCardOnboardingAction).toBe(
      submitSailingCardOnboardingAction
    );
  });
});
