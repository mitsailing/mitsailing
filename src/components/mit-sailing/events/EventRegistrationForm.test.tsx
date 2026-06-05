import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EventRegistrationForm,
  eventRegistrationFormLabels,
} from '@/components/mit-sailing/events/EventRegistrationForm';
import type { EventRegistrationFormLabels } from '@/components/mit-sailing/events/EventRegistrationForm';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import type { PublicEventRegistrationFormState } from '@/libs/mit-sailing/eventRegistrationActions';
import messages from '@/locales/en.json';

const labels: EventRegistrationFormLabels = {
  autoApprovalNote: 'Your spot is confirmed immediately after you submit.',
  confirmButton: 'Confirm registration',
  deposit: 'Deposit',
  errorMessages: {
    answers_invalid: 'One or more registration answers are invalid.',
    closed: 'Registration is not open for this event.',
    full: 'This event is at capacity.',
    not_found: 'That event is no longer available.',
    questions_required: 'Answer the required registration questions.',
    swim_agreement_required: 'Accept the swim agreement before registering.',
    waitlist_required:
      'Join the annual Learn-to-Sail waitlist before requesting this class.',
    unknown: 'Something went wrong with registration.',
  },
  feesHeading: 'Entry fees',
  learnToSailRankingHeading: 'Waitlist-ranked request',
  learnToSailRankingRule:
    'Request this class. If requests exceed spots, waitlist number decides. Request time does not change your order.',
  learnToSailWaitlistNumber: 'Waitlist #{number}',
  learnToSailRequestNote: 'We will email you when your request is reviewed.',
  phoneHelp: 'Used only if we need to reach you about this event.',
  phoneLabel: 'Phone',
  nextStepHeading: 'What happens next',
  questionsHeading: 'Registration questions',
  required: 'Required',
  requiresApprovalNote: 'We will email you when your request is reviewed.',
  selectPlaceholder: 'Select an option',
  submitRequestButton: 'Request a spot',
  swimAgreementHeading: 'Swim agreement',
  swimAgreementLabel: 'I agree to the Swim Agreement and Liability Release.',
  teamBoatEmailLabel: 'Email',
  teamBoatFullNameLabel: 'Full name',
  teamBoatHeading: 'Boat {number} information',
  teamCrewLabel: 'Crew',
  teamCrewNumberLabel: 'Crew {number}',
  teamHelmLabel: 'Helm',
  teamNameLabel: 'Team name',
  teamSectionHeading: 'Team information',
};

const event: PublicEventDetail = {
  admins: [],
  attendees: {
    approved: [],
    pending: [],
  },
  approvedRegistrationCount: 0,
  category: { name: 'Classes' },
  dates: [],
  description: 'Learn to sail.',
  detailPageKind: 'standard',
  entryFees: [],
  externalDetailUrl: null,
  id: 'event-1',
  isSpecial: false,
  learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
  maxParticipants: null,
  name: 'Learn to Sail',
  pendingRegistrationCount: 0,
  registrationEnd: null,
  registrationQuestions: [
    {
      answerType: 'select',
      displayOrder: 1,
      id: 'shirt',
      options: ['M', 'L'],
      questionText: 'T-shirt size',
      required: true,
    },
    {
      answerType: 'checkbox',
      displayOrder: 2,
      id: 'photo',
      options: [],
      questionText: 'OK to use your photo for MITNA promotion?',
      required: false,
    },
  ],
  registrationStart: null,
  requiresApproval: false,
  requiresPhone: false,
  selectionNote: null,
  shortName: 'LTS',
  slug: 'learn-to-sail',
  teamRegistration: {
    allowRepeatTeamCaptain: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    usesTeamRegistration: false,
  },
};

const originalMatchMedia = window.matchMedia;
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  window.HTMLElement.prototype,
  'scrollIntoView'
);

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      window.HTMLElement.prototype,
      'scrollIntoView',
      originalScrollIntoViewDescriptor
    );
  } else {
    Reflect.deleteProperty(window.HTMLElement.prototype, 'scrollIntoView');
  }
});

function formValues(formData: FormData): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const [name, value] of formData) {
    if (typeof value === 'string') {
      values[name] = [...(values[name] ?? []), value];
    }
  }
  return values;
}

function renderRegistrationForm(options: {
  action?: Parameters<
    typeof EventRegistrationForm
  >[0]['createRegistrationAction'];
  eventOverrides?: Partial<PublicEventDetail>;
  learnToSailWaitlistPosition?: number | null;
}) {
  render(
    <EventRegistrationForm
      createRegistrationAction={options.action ?? vi.fn()}
      event={{ ...event, ...options.eventOverrides }}
      formPermalink="/events/learn-to-sail/register"
      labels={labels}
      learnToSailWaitlistPosition={options.learnToSailWaitlistPosition}
      locale="en"
    />
  );
}

function entryFeeEventOverrides(): Partial<PublicEventDetail> {
  return {
    entryFees: [
      {
        amountCents: 15_000,
        description: 'Adult',
        id: 'fee-adult',
        isDeposit: false,
      },
      {
        amountCents: 9000,
        description: 'Junior',
        id: 'fee-junior',
        isDeposit: true,
      },
    ],
  };
}

function teamEventOverrides(options: {
  boatsPerTeam: number;
  personsPerBoat: number;
}): Partial<PublicEventDetail> {
  return {
    teamRegistration: {
      allowRepeatTeamCaptain: false,
      boatsPerTeam: options.boatsPerTeam,
      personsPerBoat: options.personsPerBoat,
      usesTeamRegistration: true,
    },
  };
}

function invalidFormAction(options: {
  code: PublicEventRegistrationFormState['code'];
  fieldErrors: NonNullable<PublicEventRegistrationFormState['fieldErrors']>;
}) {
  return vi.fn(
    (
      _prevState: PublicEventRegistrationFormState,
      formData: FormData
    ): PublicEventRegistrationFormState => ({
      code: options.code,
      fieldErrors: options.fieldErrors,
      status: 'error',
      values: formValues(formData),
    })
  );
}

function teamFields() {
  return {
    crewEmail: screen.getByRole('textbox', { name: 'Crew Email' }),
    crewName: screen.getByRole('textbox', { name: 'Crew Full name' }),
    helmEmail: screen.getByRole('textbox', { name: 'Helm Email' }),
    helmName: screen.getByRole('textbox', { name: 'Helm Full name' }),
    teamName: screen.getByRole('textbox', { name: 'Team nameRequired' }),
  };
}

function expectTeamFieldsRequired(fields: ReturnType<typeof teamFields>) {
  expect(fields.teamName).toHaveAttribute('name', 'teamName');
  expect(fields.helmName).toHaveAttribute('name', 'teamBoatMember_0_name');
  expect(fields.helmEmail).toHaveAttribute('name', 'teamBoatMember_0_email');
  expect(fields.crewName).toHaveAttribute('name', 'teamBoatMember_1_name');
  expect(fields.crewEmail).toHaveAttribute('name', 'teamBoatMember_1_email');
  expect(fields.helmName).toBeRequired();
  expect(fields.helmEmail).toBeRequired();
  expect(fields.crewName).toBeRequired();
  expect(fields.crewEmail).toBeRequired();
  expect(fields.helmName).toHaveAttribute('aria-required', 'true');
  expect(fields.helmEmail).toHaveAttribute('aria-required', 'true');
  expect(fields.crewName).toHaveAttribute('aria-required', 'true');
  expect(fields.crewEmail).toHaveAttribute('aria-required', 'true');
}

async function fillInvalidTeamFields(
  user: ReturnType<typeof userEvent.setup>,
  fields: ReturnType<typeof teamFields>
) {
  await user.type(fields.teamName, '  Tech Dinghies  ');
  await user.type(fields.helmName, 'Ada Lovelace');
  await user.type(fields.helmEmail, 'ada@example.test');
  await user.type(fields.crewName, 'Grace Hopper');
  await user.type(fields.crewEmail, 'not-an-email');
  await user.click(
    screen.getByRole('button', { name: 'Confirm registration' })
  );
}

function teamMemberFields() {
  return {
    crewEmailFields: screen.getAllByRole('textbox', { name: 'Crew Email' }),
    crewNameFields: screen.getAllByRole('textbox', { name: 'Crew Full name' }),
    helmEmailFields: screen.getAllByRole('textbox', { name: 'Helm Email' }),
    helmNameFields: screen.getAllByRole('textbox', { name: 'Helm Full name' }),
  };
}

function expectTeamBoatMemberNames(
  fields: ReturnType<typeof teamMemberFields>
) {
  const expectedNames = [
    [fields.helmNameFields[0], 'teamBoatMember_1_0_name'],
    [fields.helmEmailFields[0], 'teamBoatMember_1_0_email'],
    [fields.crewNameFields[0], 'teamBoatMember_1_1_name'],
    [fields.crewEmailFields[0], 'teamBoatMember_1_1_email'],
    [fields.helmNameFields[1], 'teamBoatMember_2_0_name'],
    [fields.helmEmailFields[1], 'teamBoatMember_2_0_email'],
    [fields.crewNameFields[1], 'teamBoatMember_2_1_name'],
    [fields.crewEmailFields[1], 'teamBoatMember_2_1_email'],
  ] as const;
  for (const [field, name] of expectedNames) {
    expect(field).toHaveAttribute('name', name);
  }
}

function expectElementBefore(first: Element, second: Element): void {
  const orderedElements = [...document.body.querySelectorAll('*')];
  expect(orderedElements.indexOf(first)).toBeLessThan(
    orderedElements.indexOf(second)
  );
}

describe('EventRegistrationForm', () => {
  it('maps translated labels used by the register page', () => {
    const t = createTranslator({
      locale: 'en',
      messages,
      namespace: 'MitSailingEvents',
    });

    const translatedLabels = eventRegistrationFormLabels(t);

    expect(translatedLabels.confirmButton).toBe('Confirm registration');
    expect(translatedLabels.errorMessages.waitlist_required).toBe(
      'Join the annual Learn-to-Sail waitlist before requesting this class.'
    );
    expect(translatedLabels.teamBoatHeading).toBe('Boat {number} information');
    expect(translatedLabels.teamCrewNumberLabel).toBe('Crew {number}');
  });

  it('renders required phone input with preserved validation state', async () => {
    const user = userEvent.setup();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const action = vi.fn(
      (
        _prevState: PublicEventRegistrationFormState,
        formData: FormData
      ): PublicEventRegistrationFormState => ({
        code: 'questions_required',
        fieldErrors: { phone: 'questions_required' },
        status: 'error',
        values: formValues(formData),
      })
    );

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={{ ...event, requiresPhone: true }}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    const phoneInput = screen.getByRole('textbox', { name: /phone/i });

    expect(phoneInput).toBeRequired();
    expect(phoneInput).toHaveAttribute('name', 'phone');
    expect(
      screen.getByText('Used only if we need to reach you about this event.')
    ).toBeVisible();

    await user.type(phoneInput, '   ');
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    expect(
      await screen.findByText('Answer the required registration questions.')
    ).toBeVisible();
    expect(phoneInput).toHaveValue('   ');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders phone input for every registration', () => {
    const action = vi.fn();

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={event}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    expect(screen.getByRole('textbox', { name: /phone/i })).toBeRequired();
  });

  it('prefills phone from the profile phone', () => {
    const action = vi.fn();

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={event}
        formPermalink="/events/learn-to-sail/register"
        initialPhone="+16175550100"
        labels={labels}
        locale="en"
      />
    );

    expect(screen.getByRole('textbox', { name: /phone/i })).toHaveValue(
      '(617) 555-0100'
    );
  });

  it('replaces prefilled phone when typing a new phone', async () => {
    const user = userEvent.setup();
    const action = vi.fn();

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={event}
        formPermalink="/events/learn-to-sail/register"
        initialPhone="+16175550100"
        labels={labels}
        locale="en"
      />
    );

    const phoneInput = screen.getByRole('textbox', { name: /phone/i });

    await user.click(phoneInput);
    await user.keyboard('857-555-0101');

    expect(phoneInput).toHaveValue('857-555-0101');
  });

  it('toggles swim agreement from the agreement row text', async () => {
    const user = userEvent.setup();
    const action = vi.fn();

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={event}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    await user.click(
      screen.getByText('I agree to the Swim Agreement and Liability Release.')
    );

    expect(
      screen.getByRole('switch', {
        name: 'I agree to the Swim Agreement and Liability Release.',
      })
    ).toBeChecked();
  });

  it('renders inline swim error and keeps selected answers', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const action = invalidFormAction({
      code: 'swim_agreement_required',
      fieldErrors: { swimAgreementAccepted: 'swim_agreement_required' },
    });

    renderRegistrationForm({ action });

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'T-shirt sizeRequired' }),
      'L'
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    expect(
      await screen.findByText('Accept the swim agreement before registering.')
    ).toBeVisible();
    expect(
      screen.getByRole('switch', {
        name: 'I agree to the Swim Agreement and Liability Release.',
      })
    ).toHaveAttribute('aria-required', 'true');
    expect(
      screen.getByRole('combobox', { name: 'T-shirt sizeRequired' })
    ).toHaveValue('L');
    expect(
      screen.getByRole('switch', {
        name: 'I agree to the Swim Agreement and Liability Release.',
      })
    ).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'center',
      });
    });
  });

  it('displays one fee without requiring a registration type choice', () => {
    const action = vi.fn();

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={{
          ...event,
          entryFees: [
            {
              amountCents: 15_000,
              description: 'Standard entry',
              id: 'fee-standard',
              isDeposit: false,
            },
          ],
        }}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    expect(screen.getByText('Standard entry')).toBeVisible();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('requires a fee choice when multiple fees are available and preserves selected value', async () => {
    const user = userEvent.setup();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const action = invalidFormAction({
      code: 'questions_required',
      fieldErrors: { eventEntryFeeId: 'questions_required' },
    });

    renderRegistrationForm({
      action,
      eventOverrides: entryFeeEventOverrides(),
    });

    const adultFee = screen.getByRole('radio', {
      name: /adult/i,
    });
    const juniorFee = screen.getByRole('radio', {
      name: /junior/i,
    });

    expect(screen.getByRole('group', { name: /entry fees/i })).toBeVisible();
    expect(adultFee).toBeRequired();
    expect(juniorFee).toBeRequired();
    expect(adultFee).toHaveAttribute('name', 'eventEntryFeeId');
    expect(juniorFee).toHaveAttribute('name', 'eventEntryFeeId');

    await user.click(juniorFee);
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    expect(
      await screen.findByText('Answer the required registration questions.')
    ).toBeVisible();
    expect(juniorFee).toBeChecked();
    expect(screen.getByRole('group', { name: /entry fees/i })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('puts decision facts before contact fields and commit copy before submit', () => {
    renderRegistrationForm({
      eventOverrides: {
        ...entryFeeEventOverrides(),
        requiresApproval: true,
      },
    });

    const feeGroup = screen.getByRole('group', { name: /entry fees/i });
    const phoneInput = screen.getByRole('textbox', { name: /phone/i });
    const swimAgreement = screen.getByRole('switch', {
      name: 'I agree to the Swim Agreement and Liability Release.',
    });
    const nextStep = screen.getByRole('region', {
      name: 'What happens next',
    });
    const submitButton = screen.getByRole('button', {
      name: 'Request a spot',
    });

    expectElementBefore(feeGroup, phoneInput);
    expectElementBefore(phoneInput, swimAgreement);
    expectElementBefore(nextStep, submitButton);
    expect(nextStep).toHaveTextContent(
      'We will email you when your request is reviewed.'
    );
  });

  it('uses waitlist-number copy for managed Learn-to-Sail requests', () => {
    renderRegistrationForm({
      eventOverrides: {
        learnToSailManagedClassKind:
          LearnToSailManagedClassKind.beginner_mid_week_123,
        requiresApproval: true,
      },
      learnToSailWaitlistPosition: 184,
    });

    const nextStep = screen.getByRole('region', {
      name: 'What happens next',
    });

    expect(nextStep).toHaveTextContent(
      'We will email you when your request is reviewed.'
    );
    expect(
      screen.getByRole('region', { name: 'Waitlist-ranked request' })
    ).toHaveTextContent(
      'Request this class. If requests exceed spots, waitlist number decides. Request time does not change your order.'
    );
    expect(screen.getByText('Waitlist #184')).toBeVisible();
  });

  it('renders team boat fields and preserves validation state', async () => {
    const user = userEvent.setup();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const action = invalidFormAction({
      code: 'questions_required',
      fieldErrors: {
        teamName: 'questions_required',
        teamBoatMember_1_email: 'answers_invalid',
      },
    });

    renderRegistrationForm({
      action,
      eventOverrides: teamEventOverrides({
        boatsPerTeam: 1,
        personsPerBoat: 2,
      }),
    });

    expect(
      screen.getByRole('heading', { name: 'Team information' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Boat 1 information' })
    ).toBeVisible();

    const fields = teamFields();
    expectTeamFieldsRequired(fields);
    await fillInvalidTeamFields(user, fields);

    expect(
      await screen.findByText('Answer the required registration questions.')
    ).toBeVisible();
    expect(fields.teamName).toHaveValue('  Tech Dinghies  ');
    expect(fields.crewEmail).toHaveValue('not-an-email');
    expect(fields.teamName).toHaveAttribute('aria-invalid', 'true');
    expect(fields.crewEmail).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders distinct member fields for every team boat', () => {
    renderRegistrationForm({
      eventOverrides: teamEventOverrides({
        boatsPerTeam: 2,
        personsPerBoat: 2,
      }),
    });

    expect(
      screen.getByRole('heading', { name: 'Boat 1 information' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Boat 2 information' })
    ).toBeVisible();

    expectTeamBoatMemberNames(teamMemberFields());
  });
});
