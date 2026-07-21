import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import {
  emptyValues,
  expectDetailsHidden,
  expectMitIdentityVerificationCalledWith,
  renderForm,
  renderFormWithPersistentDraftProvider,
  resetOnboardingFormTestState,
  selectAffiliation,
  setOnboardingMitIdentityResult,
  setOnboardingFormActionState,
  showWellesleyDetails,
} from './SailingCardOnboardingForm.testHelpers';

beforeEach(() => {
  resetOnboardingFormTestState();
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
    expect(
      screen.getByText('This decides which identity fields you need next.')
    ).toBeInTheDocument();
    expectDetailsHidden();
  });

  it('shows a Stripe resume link without hiding onboarding choices', () => {
    renderForm({
      initialMembershipCheckoutUrl: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    expect(
      screen.getByRole('heading', { name: 'Pay for your sailing card' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue to Stripe' })
    ).toHaveAttribute('href', 'https://checkout.stripe.com/c/pay/cs_test');
    expect(
      screen.getByRole('combobox', { name: 'Affiliation' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Affiliation' }).closest('form')
    ).toHaveAttribute('autocomplete', 'on');
  });

  it('shows a translated error when paid checkout cannot be started', () => {
    setOnboardingFormActionState({
      fieldErrors: {},
      formError: 'membership_checkout_unavailable',
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
        firstName: 'Grace',
        lastName: 'Hopper',
      },
    });

    renderForm();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'We could not start Stripe Checkout. Your sailing card request is not complete until payment is finished.'
    );
    expect(alert).toHaveClass(
      'border-destructive/40',
      'text-red-900',
      'motion-reduce:animate-none'
    );
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
    expect(screen.getByLabelText('MIT ID')).toHaveAccessibleDescription(
      'Required for current MIT students, faculty, and staff. We use it to verify your name with MIT records.'
    );
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();
    expectDetailsHidden();
  });

  it('keeps final details hidden for incomplete mit id input', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '34343343');

    expect(
      screen.getByRole('button', { name: 'Validate MIT ID' })
    ).toBeDisabled();
    expectDetailsHidden();
  });

  it('verifies required mit id before revealing final details', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');

    expectDetailsHidden();
    expect(
      screen.getByRole('button', { name: 'Validate MIT ID' })
    ).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Validate MIT ID' }));

    expectMitIdentityVerificationCalledWith({
      affiliation: SailingAffiliation.MIT_STUDENT,
      mitId: '123456789',
    });
    expect(await screen.findByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('First name')).toHaveAttribute('readOnly');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('readOnly');
    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
  });

  it('keeps required mit id users on identity step when verification fails', async () => {
    setOnboardingMitIdentityResult({
      ok: false,
      fieldError: 'invalid_dw_identity',
    });
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Validate MIT ID' }));

    expect(
      await screen.findByText('Enter an MIT ID that matches your account.')
    ).toBeInTheDocument();
    expectDetailsHidden();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('hides mit id and shows required manual name for wellesley', async () => {
    renderForm();

    await selectAffiliation(SailingAffiliation.WELLESLEY);

    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expectDetailsHidden();
  });

  it('keeps final details hidden until manual identity continues', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.WELLESLEY
    );
    await user.type(screen.getByLabelText('First name'), 'Grace');
    await user.type(screen.getByLabelText('Last name'), 'Hopper');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expectDetailsHidden();
  });

  it('shows optional mit id and manual name for mit alum', async () => {
    renderForm();

    await selectAffiliation(SailingAffiliation.MIT_ALUM);

    expect(screen.getByLabelText('MIT ID')).toBeInTheDocument();
    expect(screen.getByLabelText('MIT ID')).not.toBeRequired();
    expect(screen.getByLabelText('MIT ID')).toHaveAccessibleDescription(
      'Optional. Leave this blank and enter your name below to skip MIT ID lookup.'
    );
    expect(screen.getByLabelText('First name')).toBeRequired();
    expect(screen.getByLabelText('Last name')).toBeRequired();
  });

  it('validates optional mit id when a value is entered', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Affiliation'), 'MIT_ALUM');
    await user.type(screen.getByLabelText('MIT ID'), 'abc');
    await user.tab();

    expect(screen.getByLabelText('MIT ID')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByText('Enter a 9-digit MIT ID.')).toBeInTheDocument();
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

  it('lets mit family skip mit id validation and continue with manual name', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_FAMILY
    );
    await user.type(screen.getByLabelText('First name'), 'Grace');
    await user.type(screen.getByLabelText('Last name'), 'Hopper');

    expect(screen.getByRole('button', { name: 'Skip MIT ID' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Skip MIT ID' }));

    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).not.toHaveAttribute('readOnly');
  });

  it('validates optional mit id and locks verified mit family names', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_FAMILY
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');

    expect(
      screen.getByRole('button', { name: 'Validate MIT ID' })
    ).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Validate MIT ID' }));

    expectMitIdentityVerificationCalledWith({
      affiliation: SailingAffiliation.MIT_FAMILY,
      mitId: '123456789',
    });
    expect(await screen.findByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('First name')).toHaveAttribute('readOnly');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('readOnly');
    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
  });

  it('shows locked verified identity fields when a data warehouse identity is active', () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_STUDENT,
        mitId: '123456789',
      },
      lockedIdentity: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: '2027',
      },
    });

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

  it('hides the locked class year field when the verified identity has no class year', () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_STUDENT,
        mitId: '123456789',
      },
      lockedIdentity: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: null,
      },
    });

    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    expect(screen.queryByLabelText('MIT class/year')).not.toBeInTheDocument();
  });

  it('keeps optional mit affiliation names editable when mit identity exists', () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_FAMILY,
        firstName: 'Grace',
        lastName: 'Hopper',
        mitId: '123456789',
      },
      lockedIdentity: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: '2027',
      },
    });

    expect(screen.getByLabelText('MIT ID')).not.toBeRequired();
    expect(screen.getByLabelText('MIT ID')).toHaveAccessibleDescription(
      'Optional. Leave this blank and enter your name below to skip MIT ID lookup.'
    );
    expect(screen.getByLabelText('First name')).toHaveValue('Grace');
    expect(screen.getByLabelText('First name')).not.toHaveAttribute('readOnly');
    expect(screen.getByLabelText('Last name')).toHaveValue('Hopper');
    expect(screen.getByLabelText('Last name')).not.toHaveAttribute('readOnly');
    expect(screen.queryByLabelText('MIT class/year')).not.toBeInTheDocument();
  });

  it('reveals final details after manual identity is clear', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth')).toBeRequired();
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'type',
      'text'
    );
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'inputmode',
      'numeric'
    );
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'placeholder',
      'MM/DD/YYYY'
    );
    expect(screen.getByLabelText('Date of birth')).toHaveValue('');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'autocomplete',
      'bday'
    );
    expect(screen.getByLabelText('Date of birth')).toHaveAccessibleDescription(
      'Use MM/DD/YYYY, like 03/24/1988. Short years are accepted and expanded when possible.'
    );
    expect(screen.getByLabelText('Your phone number')).toBeRequired();
    expect(screen.getByLabelText('Your phone number')).toHaveAttribute(
      'autocomplete',
      'section-user tel'
    );
    expect(screen.getByLabelText('Your phone number')).toHaveAttribute(
      'inputmode',
      'tel'
    );
    expect(
      screen.getByText(
        'Required so staff can reach you about your sailing card request.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Your phone number')
    ).toHaveAccessibleDescription(
      'Required so staff can reach you about your sailing card request.'
    );
  });

  it('lets backspace clear a completed date of birth', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    await user.type(dateOfBirth, '03241988');
    expect(dateOfBirth).toHaveValue('03/24/1988');

    await user.type(dateOfBirth, '{Backspace}'.repeat(10));

    expect(dateOfBirth).toHaveValue('');
  });

  it('clears a sticky server date-of-birth error after the field is fixed', async () => {
    setOnboardingFormActionState({
      fieldErrors: { dateOfBirth: 'invalid' },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
        dateOfBirth: '02/30/2000',
        firstName: 'Grace',
        lastName: 'Hopper',
      },
    });

    renderForm({
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
        dateOfBirth: '02/30/2000',
        firstName: 'Grace',
        lastName: 'Hopper',
      },
    });
    const user = userEvent.setup();

    const dateOfBirth = screen.getByLabelText('Date of birth');
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a valid date of birth as MM/DD/YYYY.')
    ).toBeInTheDocument();

    await user.clear(dateOfBirth);
    await user.type(dateOfBirth, '03241988');
    await user.tab();

    expect(dateOfBirth).toHaveValue('03/24/1988');
    expect(dateOfBirth).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText('Enter a valid date of birth as MM/DD/YYYY.')
    ).not.toBeInTheDocument();
  });

  it('shows accessible required field errors on submit without native bubbles', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();

    const form = screen.getByLabelText('Date of birth').closest('form');
    expect(form).toHaveAttribute('novalidate');

    await user.click(
      screen.getByRole('button', { name: 'Request sailing card' })
    );

    const dateOfBirth = screen.getByLabelText('Date of birth');
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
    expect(dateOfBirth).toHaveAccessibleDescription(/required/i);
    expect(screen.getAllByText('Required.').length).toBeGreaterThan(0);

    const phone = screen.getByLabelText('Your phone number');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
  });

  it('formats typed date of birth and shows an inline invalid date error', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    await user.type(dateOfBirth, '03');

    expect(dateOfBirth).toHaveValue('03');

    await user.type(dateOfBirth, '24');

    expect(dateOfBirth).toHaveValue('03/24');

    await user.type(dateOfBirth, '1988');

    expect(dateOfBirth).toHaveValue('03/24/1988');

    await user.clear(dateOfBirth);
    await user.type(dateOfBirth, '02302000');
    await user.tab();

    expect(dateOfBirth).toHaveValue('02/30/2000');
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a valid date of birth as MM/DD/YYYY.')
    ).toBeInTheDocument();

    await user.clear(dateOfBirth);
    await user.type(dateOfBirth, '03241988');

    expect(dateOfBirth).toHaveValue('03/24/1988');
    expect(dateOfBirth).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText('Enter a valid date of birth as MM/DD/YYYY.')
    ).not.toBeInTheDocument();
  });

  it('normalizes short date of birth years when leaving the field', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    await user.type(dateOfBirth, '032488');

    expect(dateOfBirth).toHaveValue('03/24/88');

    await user.tab();

    expect(dateOfBirth).toHaveValue('03/24/1988');
    expect(dateOfBirth).not.toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['Chrome or Android native date autofill', '1988-03-24', '03/24/1988'],
    ['Windows or Chrome US slash autofill', '3/24/1988', '03/24/1988'],
    ['iPhone short-year slash autofill', '3/24/88', '03/24/1988'],
  ])('normalizes %s', async (_name, value, expected) => {
    renderForm();

    await showWellesleyDetails();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    fireEvent.change(dateOfBirth, { target: { value } });
    fireEvent.blur(dateOfBirth);

    expect(dateOfBirth).toHaveValue(expected);
  });

  it('restores full draft progress after remount without storing contact details', async () => {
    const draftKey = 'sailing-card-onboarding:user-1:2026:v1';
    const { remount } = renderFormWithPersistentDraftProvider({ draftKey });
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.type(screen.getByLabelText('Date of birth'), '03241988');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');

    remount();

    expect(screen.getByLabelText('Affiliation')).toHaveValue('WELLESLEY');
    expect(
      screen.getByRole('heading', { name: 'Confirm your identity' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Grace');
    expect(screen.getByLabelText('Last name')).toHaveValue('Hopper');
    expect(screen.getByLabelText('Date of birth')).toHaveValue('03/24/1988');
    expect(screen.getByLabelText('Your phone number')).toHaveValue(
      '(617) 555-0100'
    );
  });

  it('does not write onboarding drafts to session storage', async () => {
    const draftKey = 'sailing-card-onboarding:user-1:2026:pii-test';
    renderForm({ draftKey });
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.type(screen.getByLabelText('Date of birth'), '03241988');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');
    await user.type(screen.getByLabelText('Emergency contact name'), 'Marie');
    await user.type(
      screen.getByLabelText('Emergency contact phone'),
      '6175550101'
    );

    const rawDraft = globalThis.sessionStorage.getItem(draftKey);

    expect(rawDraft).toBeNull();
  });

  it('does not write onboarding drafts to history state', async () => {
    const draftKey = 'sailing-card-onboarding:user-1:2026:history-pii-test';
    renderForm({ draftKey });
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.type(screen.getByLabelText('Date of birth'), '03241988');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');
    await user.type(screen.getByLabelText('Emergency contact name'), 'Marie');

    const historyText = JSON.stringify(globalThis.history.state);

    expect(historyText).not.toContain(draftKey);
    expect(historyText).not.toContain('WELLESLEY');
    expect(historyText).not.toContain('03/24/1988');
    expect(historyText).not.toContain('(617) 555-0100');
    expect(historyText).not.toContain('Marie');
  });

  it('shows emergency contact controls', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(screen.getByLabelText('Emergency contact name')).toBeRequired();
    expect(screen.getByLabelText('Emergency contact name')).toHaveAttribute(
      'autocomplete',
      'section-emergency name'
    );
    expect(screen.getByLabelText('Emergency contact phone')).toBeRequired();
    expect(screen.getByLabelText('Emergency contact phone')).toHaveAttribute(
      'autocomplete',
      'section-emergency tel'
    );
    expect(screen.getByLabelText('Emergency contact phone')).toHaveAttribute(
      'inputmode',
      'tel'
    );
    expect(screen.queryByLabelText('MIT ID')).not.toBeInTheDocument();
  });

  it('asks non mit students about fitness membership before membership type', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();

    expect(
      screen.getByRole('group', {
        name: 'Do you already have MIT Recreation membership?',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tell us whether MIT Recreation already covers your sailing access.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /MIT Recreation/u })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Answer the MIT Recreation membership question to see the right options.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Yes/u }));

    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Yes/u })).toBeChecked();
  });

  it('shows server errors for missing mit recreation answer', () => {
    setOnboardingFormActionState({
      fieldErrors: { hasFitnessMembership: 'required' },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
        cardType: 'normal',
        dateOfBirth: '01/02/2000',
        emergencyContactName: 'Ada Lovelace',
        emergencyContactPhone: '(617) 555-0102',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '(617) 555-0100',
        swimAgreementAccepted: true,
      },
    });

    renderForm();

    const fitnessQuestion = screen.getByRole('group', {
      name: 'Do you already have MIT Recreation membership?',
    });

    expect(fitnessQuestion).toHaveAccessibleDescription(/Required\./u);
    expect(fitnessQuestion).toHaveAttribute('aria-invalid', 'true');
    const requiredError = screen.getByText('Required.');
    expect(requiredError).toHaveAttribute(
      'id',
      'sailing-card-onboarding-hasFitnessMembership-error'
    );
    expect(requiredError).toHaveClass(
      'text-red-900',
      'motion-reduce:animate-none'
    );
  });

  it('keeps the final submit action touch safe on mobile', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(
      screen.getByRole('button', { name: 'Request sailing card' })
    ).toHaveClass('min-h-11', 'w-full');
  });

  it('hides sailing card plan choices when mit recreation membership is present', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^Yes/u }));

    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Yes/u })).toBeChecked();
    expect(
      screen.queryByRole('radio', { name: /Virtual/u })
    ).not.toBeInTheDocument();
  });

  it('shows paid racing paths for non fitness members', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^No/u }));
    const cardType = screen.getByRole('group', {
      name: 'Choose your sailing card',
    });
    const cardTypeControls = within(cardType);

    expect(
      screen.getByText(
        'No MIT Recreation yet? You can still request Normal, but your card number waits until MIT Recreation is active. Pavilion racing and Thursday team racing stay available.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Requires MIT Recreation before staff issue your sailing card number. Includes Pavilion sailing, classes, ratings, Charles River racing, and Mashnee, the 48-foot Boston Harbor blue-water sailboat, when approved.'
      )
    ).toBeInTheDocument();
    expect(
      cardTypeControls.getByRole('radio', { name: /Normal/u })
    ).toBeChecked();
    expect(
      cardTypeControls.getByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).toBeEnabled();
    expect(
      cardTypeControls.getByRole('radio', { name: /Thursday team racing/u })
    ).toBeEnabled();
  });

  it('does not ask mit students about fitness membership', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Validate MIT ID' }));

    expect(
      screen.queryByRole('group', {
        name: 'Do you already have MIT Recreation membership?',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT Recreation membership is included for MIT students.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Normal/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Thursday team racing/u })
    ).not.toBeInTheDocument();
  });

  it('hides plan choices for verified MIT Recreation members', async () => {
    renderForm({ hasVerifiedMitRecreationMembership: true });

    await showWellesleyDetails();

    expect(
      screen.queryByRole('group', {
        name: 'Do you already have MIT Recreation membership?',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('MIT Recreation membership is verified.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Normal/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Thursday team racing/u })
    ).not.toBeInTheDocument();
  });

  it('normalizes stale paid card type for verified MIT Recreation members', async () => {
    renderForm({
      hasVerifiedMitRecreationMembership: true,
      initialValues: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
        cardType: SailingCardType.racing,
        firstName: 'Grace',
        lastName: 'Hopper',
      },
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).not.toBeInTheDocument();
  });

  it('resets paid card type when affiliation changes to mit student', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^No/u }));
    await user.click(
      screen.getByRole('radio', {
        name: /Pavilion racing/u,
      })
    );
    expect(
      screen.getByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).toBeChecked();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Validate MIT ID' }));

    expect(
      screen.queryByRole('group', {
        name: 'Choose your sailing card',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).not.toBeInTheDocument();
  });

  it('includes required swim agreement checkbox', async () => {
    renderForm();

    await showWellesleyDetails();

    const agreement = screen.getByRole('checkbox', {
      name: 'I have read and agree to the swim agreement and liability release.',
    });

    expect(agreement).toBeRequired();
    expect(agreement).toHaveAttribute('name', 'swimAgreementAccepted');
  });

  it('renders agreement and liability release text in a native disclosure', async () => {
    renderForm();

    await showWellesleyDetails();

    const disclosure = screen.getByText(
      'Read the swim agreement and liability release'
    );

    expect(disclosure.tagName).toBe('SUMMARY');
    for (const paragraph of sailingCardAgreement.text.split('\n\n')) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it('links legal notice to terms and privacy pages', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute(
      'href',
      '/terms'
    );
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveClass(
      'text-mit-red',
      'dark:text-mit-red-ink'
    );
    expect(
      screen.getByRole('link', { name: 'Privacy policy' })
    ).toHaveAttribute('href', '/privacy');
    expect(
      screen.getByRole('link', { name: 'Privacy policy' })
    ).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveClass(
      'text-mit-red',
      'dark:text-mit-red-ink'
    );
  });
});
