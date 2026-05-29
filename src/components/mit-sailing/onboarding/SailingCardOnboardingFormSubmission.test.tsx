import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import {
  emptyValues,
  renderForm,
  resetOnboardingFormTestState,
  selectAffiliation,
  setOnboardingFormActionState,
  submittedFormData,
} from './SailingCardOnboardingForm.testHelpers';

beforeEach(() => {
  resetOnboardingFormTestState();
});

describe('SailingCardOnboardingForm submission and errors', () => {
  it('preserves callback url in submitted form data', async () => {
    renderForm({ callbackUrl: '/events/regatta/register' });
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.WELLESLEY
    );
    await user.type(screen.getByLabelText('First name'), 'Grace');
    await user.type(screen.getByLabelText('Last name'), 'Hopper');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Date of birth'), '01/02/2000');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');
    await user.type(
      screen.getByLabelText('Emergency contact name'),
      'Ada Lovelace'
    );
    await user.type(
      screen.getByLabelText('Emergency contact phone'),
      '6175550101'
    );
    await user.click(screen.getByRole('radio', { name: /^Yes/u }));
    await user.click(
      screen.getByLabelText(
        'I have read and agree to the swim agreement and liability release.'
      )
    );
    await user.click(
      screen.getByRole('button', { name: 'Request sailing card' })
    );

    const formData = submittedFormData();

    expect(formData.get('callbackUrl')).toBe('/events/regatta/register');
    expect(formData.get('cardType')).toBe('normal');
    expect(formData.get('emergencyContactName')).toBe('Ada Lovelace');
    expect(formData.get('emergencyContactPhone')).toBe('6175550101');
    expect(formData.get('phone')).toBe('6175550100');
  });

  it('submits only mit identity data when manual names and callback are hidden', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Date of birth'), '01/02/2000');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');
    await user.type(
      screen.getByLabelText('Emergency contact name'),
      'Ada Lovelace'
    );
    await user.type(
      screen.getByLabelText('Emergency contact phone'),
      '6175550101'
    );
    await user.click(
      screen.getByLabelText(
        'I have read and agree to the swim agreement and liability release.'
      )
    );
    await user.click(
      screen.getByRole('button', { name: 'Request sailing card' })
    );

    const formData = submittedFormData();

    expect(formData.get('callbackUrl')).toBeNull();
    expect(formData.get('firstName')).toBe('');
    expect(formData.get('lastName')).toBe('');
    expect(formData.get('mitId')).toBe('123456789');
    expect(formData.get('swimAgreementAccepted')).toBe('on');
  });

  it('marks mit id invalid when server validation fails', async () => {
    setOnboardingFormActionState({
      fieldErrors: { mitId: 'required_dw_identity' },
      status: 'error',
      values: emptyValues,
    });

    renderForm();

    await selectAffiliation(SailingAffiliation.MIT_STUDENT);

    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-describedby',
      'sailing-card-onboarding-mitId-help sailing-card-onboarding-mitId-error'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your MIT ID.');
  });

  it('renders affiliation and contact field server errors', () => {
    setOnboardingFormActionState({
      fieldErrors: {
        affiliation: 'required',
        emergencyContactName: 'required',
        emergencyContactPhone: 'invalid',
        phone: 'invalid',
        swimAgreementAccepted: 'required',
      },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
      },
    });

    renderForm();

    expect(
      screen.getByRole('combobox', { name: 'Affiliation' })
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your phone number')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Emergency contact name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Emergency contact phone')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByLabelText(
        'I have read and agree to the swim agreement and liability release.'
      )
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a valid US phone number.')
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
  });

  it('focuses the first invalid field after server validation fails', async () => {
    setOnboardingFormActionState({
      fieldErrors: {
        affiliation: 'required',
        phone: 'required',
      },
      status: 'error',
      values: emptyValues,
    });

    renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText('Affiliation')).toHaveFocus();
    });
  });

  it('renders manual-name and mit identity server errors', () => {
    setOnboardingFormActionState({
      fieldErrors: {
        firstName: 'required',
        lastName: 'required',
        mitId: 'affiliation_mismatch',
      },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_ALUM,
      },
    });

    renderForm();

    expect(screen.getByLabelText('First name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Last name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByText('Choose the matching MIT affiliation.')
    ).toBeInTheDocument();
  });

  it('renders invalid data warehouse identity errors', () => {
    setOnboardingFormActionState({
      fieldErrors: { mitId: 'invalid_dw_identity' },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_STUDENT,
      },
    });

    renderForm();

    expect(
      screen.getByText('Enter an MIT ID that matches your account.')
    ).toBeInTheDocument();
  });

  it('falls back to the blank affiliation when the saved value is hidden', () => {
    setOnboardingFormActionState({
      fieldErrors: {},
      status: 'idle',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.NON_MIT,
      },
    });

    renderForm();

    expect(screen.getByRole('combobox', { name: 'Affiliation' })).toHaveValue(
      ''
    );
  });

  it('renders card type and date of birth server errors', () => {
    setOnboardingFormActionState({
      fieldErrors: {
        cardType: 'required',
        dateOfBirth: 'required',
      },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
      },
    });

    renderForm();

    expect(
      screen.getByRole('group', { name: 'Choose your sailing card' })
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getAllByText('Required.')).toHaveLength(2);
  });
});
