import { render, screen, within } from '@testing-library/react';
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
  hasFitnessMembership: '',
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
      hasFitnessMembership: '',
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

vi.mock('next-intl', async () => {
  const { useOnboardingTestTranslations } =
    await import('./SailingCardOnboardingForm.testIntl');

  return {
    useTranslations: useOnboardingTestTranslations,
  };
});

vi.mock('@/libs/mit-sailing/sailingCardOnboardingActions', () => ({
  submitSailingCardOnboardingAction: vi.fn(),
}));

function renderForm(
  props: {
    readonly callbackUrl?: string;
    readonly initialValues?: typeof emptyValues;
  } = {}
) {
  render(
    <SailingCardOnboardingForm
      callbackUrl={props.callbackUrl}
      initialValues={props.initialValues}
    />
  );
}

const selectAffiliation = async (affiliation: SailingAffiliation) => {
  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Affiliation' }),
    affiliation
  );
};

const showWellesleyDetails = async () => {
  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Affiliation' }),
    SailingAffiliation.WELLESLEY
  );
  await user.type(screen.getByLabelText('First name'), 'Grace');
  await user.type(screen.getByLabelText('Last name'), 'Hopper');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  return user;
};

const expectDetailsHidden = () => {
  expect(
    screen.queryByRole('heading', { name: 'Contact details' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Type of sailing card requested' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText(
      'I have read and agree to the swim agreement and liability release.'
    )
  ).not.toBeInTheDocument();
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

  it('hides the locked class year field when the verified identity has no class year', () => {
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
          mitClassYear: null,
        }}
      />
    );

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
    expect(
      screen.queryByLabelText('Emergency contact email, optional')
    ).not.toBeInTheDocument();
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

    const formData = actionStateMock.formAction.mock.calls[0]?.[0];

    if (!(formData instanceof FormData)) {
      throw new TypeError('Expected onboarding submit to send FormData.');
    }
    expect(formData.get('callbackUrl')).toBe('/events/regatta/register');
    expect(formData.get('cardType')).toBe('normal');
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

    const formData = actionStateMock.formAction.mock.calls[0]?.[0];

    if (!(formData instanceof FormData)) {
      throw new TypeError('Expected onboarding submit to send FormData.');
    }
    expect(formData.get('callbackUrl')).toBeNull();
    expect(formData.get('firstName')).toBe('');
    expect(formData.get('lastName')).toBe('');
    expect(formData.get('mitId')).toBe('123456789');
    expect(formData.get('swimAgreementAccepted')).toBe('on');
  });

  it('does not submit retained emergency contact email values', async () => {
    renderForm({
      initialValues: {
        ...emptyValues,
        emergencyContactEmail: 'retained@example.com',
      },
    });
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

    const formData = actionStateMock.formAction.mock.calls[0]?.[0];

    if (!(formData instanceof FormData)) {
      throw new TypeError('Expected onboarding submit to send FormData.');
    }
    expect(formData.get('emergencyContactEmail')).toBe('');
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
      'sailing-card-onboarding-mitId-help sailing-card-onboarding-mitId-error'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your MIT ID.');
  });

  it('renders affiliation and contact field server errors', () => {
    actionStateMock.state = {
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
    };

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

  it('renders manual-name and mit identity server errors', () => {
    actionStateMock.state = {
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
    };

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
    actionStateMock.state = {
      fieldErrors: { mitId: 'invalid_dw_identity' },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.MIT_STUDENT,
      },
    };

    renderForm();

    expect(
      screen.getByText('Enter an MIT ID that matches your account.')
    ).toBeInTheDocument();
  });

  it('falls back to the blank affiliation when the saved value is hidden', () => {
    actionStateMock.state = {
      fieldErrors: {},
      status: 'idle',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.NON_MIT,
      },
    };

    renderForm();

    expect(screen.getByRole('combobox', { name: 'Affiliation' })).toHaveValue(
      ''
    );
  });

  it('renders card type and date of birth server errors', () => {
    actionStateMock.state = {
      fieldErrors: {
        cardType: 'required',
        dateOfBirth: 'required',
      },
      status: 'error',
      values: {
        ...emptyValues,
        affiliation: SailingAffiliation.WELLESLEY,
      },
    };

    renderForm();

    expect(
      screen.getByRole('group', { name: 'Type of sailing card requested' })
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getAllByText('Required.')).toHaveLength(2);
  });

  it('uses submit onboarding action by default', () => {
    expect(defaultSailingCardOnboardingAction).toBe(
      submitSailingCardOnboardingAction
    );
  });
});
