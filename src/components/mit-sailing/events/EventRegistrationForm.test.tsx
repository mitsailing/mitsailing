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
  questionsHeading: 'Registration questions',
  required: 'Required',
  requiresApprovalNote:
    'An event admin will review and confirm your registration.',
  selectPlaceholder: 'Select an option',
  submitRequestButton: 'Submit registration request',
  swimAgreementHeading: 'Swim agreement',
  swimAgreementLabel: 'I agree to the Swim Agreement and Liability Release.',
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
  shortName: 'LTS',
  slug: 'learn-to-sail',
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
        name: 'Swim agreementRequired I agree to the Swim Agreement and Liability Release.',
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
        name: 'Swim agreementRequired I agree to the Swim Agreement and Liability Release.',
      })
    ).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('submits restored boolean answers as false after unchecking', async () => {
    const user = userEvent.setup();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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
      screen.getByRole('switch', {
        name: 'OK to use your photo for MITNA promotion?',
      })
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    expect(
      await screen.findByText('Accept the swim agreement before registering.')
    ).toBeVisible();
    await user.click(
      screen.getByRole('switch', {
        name: 'OK to use your photo for MITNA promotion?',
      })
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm registration' })
    );

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
    const secondFormData = action.mock.calls[1]?.[1];

    expect(secondFormData).toBeInstanceOf(FormData);
    expect(secondFormData?.getAll('question_photo')).toEqual(['false']);
  });
});
