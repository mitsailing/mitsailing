import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationForm } from '@/components/mit-sailing/events/EventRegistrationForm';
import type { EventRegistrationFormLabels } from '@/components/mit-sailing/events/EventRegistrationForm';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import type { PublicEventRegistrationFormState } from '@/libs/mit-sailing/eventRegistrationActions';

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
    unknown: 'Something went wrong with registration.',
  },
  feesHeading: 'Entry fees',
  phoneHelp: 'Used by event admins if they need to reach you.',
  phoneLabel: 'Phone',
  questionsHeading: 'Registration questions',
  required: 'Required',
  requiresApprovalNote:
    'An event admin will review and confirm your registration.',
  selectPlaceholder: 'Select an option',
  submitRequestButton: 'Submit registration request',
  swimAgreementHeading: 'Swim agreement',
  swimAgreementLabel: 'I agree to the Swim Agreement and Liability Release.',
  teamBoatEmailLabel: 'Email',
  teamBoatFullNameLabel: 'Full name',
  teamBoatHeading: 'Boat 1 information',
  teamCrewLabel: 'Crew',
  teamCrewNumberLabel: 'Crew {number}',
  teamHelmLabel: 'Helm',
  teamNameLabel: 'Team name',
  teamSectionHeading: 'Team information',
};

const event: PublicEventDetail = {
  admins: [],
  approvedRegistrationCount: 0,
  category: { name: 'Classes' },
  dates: [],
  description: 'Learn to sail.',
  detailPageKind: 'standard',
  entryFees: [],
  externalDetailUrl: null,
  id: 'event-1',
  isSpecial: false,
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
  shortName: 'LTS',
  slug: 'learn-to-sail',
  teamRegistration: {
    allowRepeatTeamCaptain: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    usesTeamRegistration: false,
  },
};

function formValues(formData: FormData): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const [name, value] of formData) {
    if (typeof value === 'string') {
      values[name] = [...(values[name] ?? []), value];
    }
  }
  return values;
}

describe('EventRegistrationForm', () => {
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
      screen.getByText('Used by event admins if they need to reach you.')
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

  it('omits phone input when phone is not required', () => {
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

    expect(screen.queryByRole('textbox', { name: /phone/i })).toBeNull();
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
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const action = vi.fn(
      (
        _prevState: PublicEventRegistrationFormState,
        formData: FormData
      ): PublicEventRegistrationFormState => ({
        code: 'swim_agreement_required',
        fieldErrors: { swimAgreementAccepted: 'swim_agreement_required' },
        status: 'error',
        values: formValues(formData),
      })
    );

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={event}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

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
      screen.getByRole('combobox', { name: 'T-shirt sizeRequired' })
    ).toHaveValue('L');
    expect(
      screen.getByRole('switch', {
        name: 'I agree to the Swim Agreement and Liability Release.',
      })
    ).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
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
    const action = vi.fn(
      (
        _prevState: PublicEventRegistrationFormState,
        formData: FormData
      ): PublicEventRegistrationFormState => ({
        code: 'questions_required',
        fieldErrors: { eventEntryFeeId: 'questions_required' },
        status: 'error',
        values: formValues(formData),
      })
    );

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={{
          ...event,
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
        }}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    const adultFee = screen.getByRole('radio', {
      name: /adult/i,
    });
    const juniorFee = screen.getByRole('radio', {
      name: /junior/i,
    });

    expect(screen.getByRole('radiogroup')).toBeRequired();
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
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('renders team boat fields and preserves validation state', async () => {
    const user = userEvent.setup();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const action = vi.fn(
      (
        _prevState: PublicEventRegistrationFormState,
        formData: FormData
      ): PublicEventRegistrationFormState => ({
        code: 'questions_required',
        fieldErrors: {
          teamName: 'questions_required',
          teamBoatMember_1_email: 'answers_invalid',
        },
        status: 'error',
        values: formValues(formData),
      })
    );

    render(
      <EventRegistrationForm
        createRegistrationAction={action}
        event={{
          ...event,
          teamRegistration: {
            allowRepeatTeamCaptain: false,
            boatsPerTeam: 1,
            personsPerBoat: 2,
            usesTeamRegistration: true,
          },
        }}
        formPermalink="/events/learn-to-sail/register"
        labels={labels}
        locale="en"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Team information' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Boat 1 information' })
    ).toBeVisible();

    const teamName = screen.getByRole('textbox', { name: 'Team nameRequired' });
    const helmName = screen.getByRole('textbox', {
      name: 'Helm Full name',
    });
    const helmEmail = screen.getByRole('textbox', {
      name: 'Helm Email',
    });
    const crewName = screen.getByRole('textbox', {
      name: 'Crew Full name',
    });
    const crewEmail = screen.getByRole('textbox', {
      name: 'Crew Email',
    });

    expect(teamName).toHaveAttribute('name', 'teamName');
    expect(helmName).toHaveAttribute('name', 'teamBoatMember_0_name');
    expect(helmEmail).toHaveAttribute('name', 'teamBoatMember_0_email');
    expect(crewName).toHaveAttribute('name', 'teamBoatMember_1_name');
    expect(crewEmail).toHaveAttribute('name', 'teamBoatMember_1_email');

    await user.type(teamName, '  Tech Dinghies  ');
    await user.type(helmName, 'Ada Lovelace');
    await user.type(helmEmail, 'ada@example.test');
    await user.type(crewName, 'Grace Hopper');
    await user.type(crewEmail, 'not-an-email');
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    expect(
      await screen.findByText('Answer the required registration questions.')
    ).toBeVisible();
    expect(teamName).toHaveValue('  Tech Dinghies  ');
    expect(crewEmail).toHaveValue('not-an-email');
    expect(teamName).toHaveAttribute('aria-invalid', 'true');
    expect(crewEmail).toHaveAttribute('aria-invalid', 'true');
  });
});
