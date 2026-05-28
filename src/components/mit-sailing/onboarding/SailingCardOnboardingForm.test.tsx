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
      screen.getByRole('heading', { name: 'Contact details' })
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
      'If you know your MIT ID, we can use it to match MIT records. If not, enter your name below.'
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

  it('reveals final details after manual identity is clear', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(
      screen.getByRole('heading', { name: 'Contact details' })
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

  it('shows emergency contact controls without emergency email', async () => {
    renderForm();

    await showWellesleyDetails();

    expect(
      screen.getByRole('heading', { name: 'Emergency contact' })
    ).toBeInTheDocument();
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
        name: 'Do you already have an MIT Fitness membership?',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Answer No if you still need to sign up. You can continue with Normal membership.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'open MIT Recreation' })
    ).toHaveAttribute('href', 'https://www.mitrecsports.com/join/memberships/');
    expect(
      screen.getByText(/Individual rates: student \$25\/mo/u)
    ).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Answer the MIT Fitness membership question to see the right options.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Yes/u }));

    expect(
      within(
        screen.getByRole('group', {
          name: 'Type of sailing card requested',
        })
      ).getByRole('radio', { name: /Normal membership/u })
    ).toBeEnabled();
  });

  it('renders sailing membership type options without virtual card', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^Yes/u }));

    const cardType = screen.getByRole('group', {
      name: 'Type of sailing card requested',
    });
    const cardTypeControls = within(cardType);

    expect(cardType).toBeInTheDocument();
    expect(
      cardTypeControls.getByRole('radio', { name: /Normal membership/u })
    ).toHaveAttribute('value', 'normal');
    expect(
      cardTypeControls.getByRole('radio', { name: /Racing membership/u })
    ).toHaveAttribute('value', 'racing');
    expect(
      cardTypeControls.getByRole('radio', { name: /Team racing/u })
    ).toHaveAttribute('value', 'team_racing');
    expect(
      screen.getByText(
        'For access to the Sailing Pavilion and Mashnee sails. If you need MIT Fitness, choose this and finish signup within 24 hours.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Racing membership is $25. It covers race classes and racing events. Mashnee sails are not included.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Virtual/u })
    ).not.toBeInTheDocument();
  });

  it('keeps normal membership available for non fitness members', async () => {
    renderForm();
    const user = userEvent.setup();

    await showWellesleyDetails();
    await user.click(screen.getByRole('radio', { name: /^No/u }));
    const cardType = screen.getByRole('group', {
      name: 'Type of sailing card requested',
    });
    const cardTypeControls = within(cardType);

    expect(
      cardTypeControls.getByRole('radio', { name: /Normal membership/u })
    ).toBeChecked();
    expect(
      cardTypeControls.getByRole('radio', { name: /Racing membership/u })
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
        name: 'Do you already have an MIT Fitness membership?',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'MIT students meet the MIT Fitness requirement for Normal membership.'
      )
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', {
          name: 'Type of sailing card requested',
        })
      ).getByRole('radio', { name: /Normal membership/u })
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
    expect(
      screen.getByRole('link', { name: 'Privacy policy' })
    ).toHaveAttribute('href', '/privacy');
  });
});
