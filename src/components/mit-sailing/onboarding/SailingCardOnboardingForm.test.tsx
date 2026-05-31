import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import {
  emptyValues,
  expectDetailsHidden,
  renderForm,
  resetOnboardingFormTestState,
  selectAffiliation,
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

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expectDetailsHidden();
  });

  it('reveals final details only after continuing from complete mit id input', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Affiliation' }),
      SailingAffiliation.MIT_STUDENT
    );
    await user.type(screen.getByLabelText('MIT ID'), '123456789');

    expectDetailsHidden();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
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
      'Used for sailing card eligibility and safety records.'
    );
    expect(screen.getByLabelText('Your phone number')).toBeRequired();
    expect(screen.getByLabelText('Your phone number')).toHaveAttribute(
      'autocomplete',
      'section-user tel'
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

  it('formats typed date of birth and shows an inline invalid date error', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    await user.type(dateOfBirth, '03');

    expect(dateOfBirth).toHaveValue('03/');

    await user.type(dateOfBirth, '241988');

    expect(dateOfBirth).toHaveValue('03/24/1988');

    await user.clear(dateOfBirth);
    await user.type(dateOfBirth, '02302000');
    await user.tab();

    expect(dateOfBirth).toHaveValue('02/30/2000');
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter date of birth as MM/DD/YYYY.')
    ).toBeInTheDocument();
  });

  it('restores full draft details after browser back', async () => {
    const draftKey = 'sailing-card-onboarding:user-1:2026:v1';
    const { unmount } = renderForm({ draftKey });
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.type(screen.getByLabelText('Date of birth'), '03241988');
    await user.type(screen.getByLabelText('Your phone number'), '6175550100');

    unmount();
    renderForm({ draftKey });

    expect(
      screen.getByRole('heading', { name: 'Contact and safety' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Affiliation')).toHaveValue('WELLESLEY');
    expect(screen.getByLabelText('Date of birth')).toHaveValue('03/24/1988');
    expect(screen.getByLabelText('Your phone number')).toHaveValue(
      '(617) 555-0100'
    );
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
        'Normal is included for MIT Recreation members. Answer No if you do not have it yet.'
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
      within(
        screen.getByRole('group', {
          name: 'Choose your sailing card',
        })
      ).getByRole('radio', { name: /Normal/u })
    ).toBeEnabled();
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
    expect(screen.getByText('Required.')).toHaveAttribute(
      'id',
      'sailing-card-onboarding-hasFitnessMembership-error'
    );
  });

  it('renders sailing card options with clear comparison copy', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^Yes/u }));

    const cardType = screen.getByRole('group', {
      name: 'Choose your sailing card',
    });
    const cardTypeControls = within(cardType);

    expect(cardType).toBeInTheDocument();
    expect(
      cardTypeControls.getByRole('radio', { name: /Normal/u })
    ).toHaveAttribute('value', 'normal');
    expect(
      cardTypeControls.queryByRole('radio', {
        name: /Pavilion racing/u,
      })
    ).not.toBeInTheDocument();
    expect(
      cardTypeControls.queryByRole('radio', { name: /Thursday team racing/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Included for MIT students and MIT Recreation members. Pavilion sailing, classes, ratings, Charles River racing, and Mashnee, the 48-foot Boston Harbor blue-water sailboat, when approved.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Normal covers Pavilion sailing and Charles River racing. Prices use your affiliation and date of birth.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT students and MIT Recreation members usually choose Normal. The racing cards are already covered by Normal.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute(
      'href',
      '/pricing'
    );
    expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute(
      'target',
      '_blank'
    );
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
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.queryByRole('group', {
        name: 'Do you already have MIT Recreation membership?',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('MIT students get Normal included.')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', {
          name: 'Choose your sailing card',
        })
      ).getByRole('radio', { name: /Normal/u })
    ).toBeChecked();
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
