import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EventAddressPreset,
  EventAnswerType,
  EventDetailPageKind,
  EventRegistrationMode,
} from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { AdminEventFormView } from './AdminEventFormView';

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  addAdminEventDateAction: vi.fn(),
  addAdminEventFeeAction: vi.fn(),
  addAdminEventQuestionAction: vi.fn(),
  deleteAdminEventDateAction: vi.fn(),
  deleteAdminEventFeeAction: vi.fn(),
  deleteAdminEventQuestionAction: vi.fn(),
  updateAdminEventAdminsAction: vi.fn(),
  updateAdminEventBasicsAction: vi.fn(),
  updateAdminEventDateAction: vi.fn(),
  updateAdminEventFeeAction: vi.fn(),
  updateAdminEventLocationAction: vi.fn(),
  updateAdminEventPaymentSettingsAction: vi.fn(),
  updateAdminEventQuestionAction: vi.fn(),
}));

type AdminEventFormViewProps = React.ComponentProps<typeof AdminEventFormView>;
type AdminEventFixture = AdminEventFormViewProps['event'];

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

const tCommon = createTranslator({
  locale: 'en',
  messages,
  namespace: 'Common',
});

const optionalEditorLabels = [
  'FAQ',
  'Notice of Race',
  'Sailing Instructions',
  'Results',
  'Registration',
  'Ask phone',
  'Ask question',
  'Teams',
  'Entry fees',
];

function createEventFixture(
  overrides: Partial<AdminEventFixture> = {}
): AdminEventFixture {
  return {
    admins: [
      {
        admin: {
          email: 'instructor@example.com',
          id: 'instructor-1',
          name: 'Sailing Instructor',
        },
        adminUserId: 'instructor-1',
        id: 'event-admin-1',
      },
    ],
    allowRepeatTeamCaptain: false,
    addressCity: null,
    addressCountry: null,
    addressLine1: null,
    addressLine2: null,
    addressName: null,
    addressPostalCode: null,
    addressPreset: EventAddressPreset.pavilion,
    addressState: null,
    boatsPerTeam: 1,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    dates: [
      {
        endDateTime: new Date('2026-06-01T15:00:00Z'),
        id: 'date-1',
        startDateTime: new Date('2026-06-01T13:00:00Z'),
      },
    ],
    description: 'Learn how to sail.',
    detailPageKind: EventDetailPageKind.standard,
    entryFees: [],
    eventCategoryId: 'category-1',
    externalDetailUrl: null,
    externalEntriesUrl: null,
    externalRegistrationUrl: null,
    faqContent: '',
    faqVisible: false,
    id: 'event-1',
    isPublished: true,
    isSpecial: false,
    maxParticipants: null,
    name: 'Intro Sail',
    noticeOfRaceContent: '',
    noticeOfRaceVisible: false,
    paymentDeadlineAt: null,
    paymentsEnabled: false,
    personsPerBoat: 1,
    registrationCounts: {
      approved: 1,
      cancelled: 0,
      pending: 0,
    },
    registrationEnd: null,
    registrationMode: EventRegistrationMode.standard,
    registrationQuestions: [],
    registrationStart: null,
    requiresApproval: false,
    requiresPhone: false,
    resultsContent: '',
    resultsVisible: false,
    sailingInstructionsContent: '',
    sailingInstructionsVisible: false,
    shortName: '',
    slug: 'intro-sail',
    usesTeamRegistration: false,
    ...overrides,
  };
}

function renderView(
  accessMode: AdminEventFormViewProps['accessMode'],
  eventOverrides: Partial<AdminEventFixture> = {}
) {
  return render(
    <AdminEventFormView
      accessMode={accessMode}
      categories={[{ id: 'category-1', name: 'Clinic' }]}
      errorCode={null}
      event={createEventFixture(eventOverrides)}
      locale="en"
      t={t}
      tCommon={tCommon}
      users={[
        {
          email: 'instructor@example.com',
          id: 'instructor-1',
          name: 'Sailing Instructor',
        },
      ]}
    />
  );
}

function optionalSection(label: string): Element | null {
  return screen.getByText(label).closest('details');
}

describe('AdminEventFormView', () => {
  it('links back to the admin event show page', () => {
    renderView('editable');

    expect(
      screen.getByRole('link', { name: 'Back to events' })
    ).toHaveAttribute('href', '/admin/events/intro-sail');
  });

  it('links read-only users back to the event index', () => {
    renderView('readOnly');

    expect(
      screen.getByRole('link', { name: 'Back to events' })
    ).toHaveAttribute('href', '/admin/events');
  });

  it('does not render a slug textbox for editable access', () => {
    const view = renderView('editable');

    expect(screen.queryByLabelText('Slug')).toBeNull();
    expect(view.container.querySelector('input[name="slug"]')).toBeNull();
  });

  it('hides external page URL for standard public pages', () => {
    renderView('editable', {
      detailPageKind: EventDetailPageKind.standard,
      externalDetailUrl: 'https://example.com/details',
    });

    expect(screen.queryByLabelText('External page URL')).toBeNull();
  });

  it('hides external registration URLs for standard registration', () => {
    renderView('editable', {
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      registrationMode: EventRegistrationMode.standard,
    });

    expect(screen.queryByLabelText('External registration URL')).toBeNull();
    expect(screen.queryByLabelText('External entries URL')).toBeNull();
    expect(screen.getByLabelText('Registration opens')).toBeVisible();
    expect(screen.getByLabelText('Registration closes')).toBeVisible();
  });

  it('shows only external registration URLs for custom registration', () => {
    renderView('editable', {
      registrationMode: EventRegistrationMode.external,
    });

    expect(screen.getByLabelText('External registration URL')).toBeVisible();
    expect(screen.getByLabelText('External entries URL')).toBeVisible();
    expect(screen.queryByLabelText('Registration opens')).toBeNull();
    expect(screen.queryByLabelText('Registration closes')).toBeNull();
    expect(screen.queryByLabelText('Maximum participants')).toBeNull();
    expect(screen.queryByLabelText('Manual confirmation required')).toBeNull();
  });

  it('updates conditional URL fields when admin changes page and registration modes', async () => {
    const user = userEvent.setup();
    renderView('editable');

    expect(screen.queryByLabelText('External page URL')).toBeNull();
    await user.click(
      screen.getByRole('radio', { name: /External or custom URL/i })
    );
    expect(screen.getByLabelText('External page URL')).toBeVisible();

    await user.click(screen.getByText('Registration'));
    expect(screen.queryByLabelText('External registration URL')).toBeNull();
    await user.selectOptions(
      screen.getByLabelText('Registration mode'),
      EventRegistrationMode.external
    );
    expect(screen.getByLabelText('External registration URL')).toBeVisible();
    expect(screen.getByLabelText('External entries URL')).toBeVisible();
    expect(screen.queryByLabelText('Registration opens')).toBeNull();
  });

  it('uses public content disclosure state without a separate visibility checkbox', () => {
    const view = renderView('editable', {
      faqContent: 'Answers for sailors',
      faqVisible: true,
    });
    const faqVisibleInput = view.container.querySelector(
      'input[name="faqVisible"]'
    );

    expect(screen.queryByLabelText('Show on public event page')).toBeNull();
    expect(faqVisibleInput).toHaveAttribute('value', 'true');
    expect(view.container.querySelector('#event-faq-content')).toBeVisible();
  });

  it('hides internal notes and mutation controls for read-only access', () => {
    const view = renderView('readOnly', {
      entryFees: [
        {
          amountCents: 2500,
          description: 'Clinic fee',
          id: 'fee-1',
          isDeposit: false,
        },
      ],
      maxParticipants: 12,
      registrationQuestions: [
        {
          answerType: EventAnswerType.text,
          displayOrder: 1,
          id: 'question-1',
          options: [],
          questionText: 'Dietary restrictions?',
          required: false,
        },
      ],
      requiresApproval: true,
    });

    expect(screen.getByText('Read-only access')).toBeVisible();
    expect(screen.getByText('Learn how to sail.')).toBeVisible();
    expect(screen.getByText('Sailing Instructor')).toBeVisible();
    expect(screen.getByText('Dietary restrictions?')).toBeVisible();
    expect(screen.queryByText('Private staffing note')).toBeNull();
    expect(screen.queryByLabelText('Internal notes')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Save event details' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save admins' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add date' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add question' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add fee' })).toBeNull();
    expect(
      view.container.querySelector('[aria-labelledby="event-dates"] li > dl')
    ).not.toBeNull();
    expect(
      view.container.querySelector('[aria-labelledby="event-fees"] li > dl')
    ).not.toBeNull();
  });

  it('shows compact editor sections for editable access', () => {
    renderView('editable');

    expect(screen.getByRole('heading', { name: 'Edit event' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Basics' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Dates and times' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Contacts / event admins' })
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Event address' })
    ).toBeVisible();
    expect(screen.queryByText('Record metadata')).toBeNull();
    expect(screen.queryByText('Summary')).toBeNull();
    expect(
      screen.queryByRole('table', { name: 'Registration roster' })
    ).toBeNull();
    expect(screen.queryByLabelText('Internal notes')).toBeNull();
    expect(screen.queryByText('Private staffing note')).toBeNull();

    for (const label of optionalEditorLabels) {
      expect(optionalSection(label)).not.toBeNull();
    }
    expect(screen.queryByText('Ask gender')).toBeNull();
  });

  it('closes optional boxes for default editable events', () => {
    renderView('editable');

    for (const label of optionalEditorLabels) {
      expect(optionalSection(label)).not.toHaveAttribute('open');
    }
    expect(
      screen.getByRole('checkbox', {
        name: /Collect payment for approved registrations/,
      })
    ).not.toBeChecked();
    expect(screen.getByLabelText('Event address')).toHaveTextContent(
      'MIT Sailing Pavilion'
    );
  });

  it('opens optional boxes with existing editable content', () => {
    renderView('editable', {
      allowRepeatTeamCaptain: true,
      boatsPerTeam: 2,
      entryFees: [
        {
          amountCents: 2500,
          description: 'Clinic fee',
          id: 'fee-1',
          isDeposit: false,
        },
      ],
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      faqContent: 'Answers for sailors',
      faqVisible: true,
      maxParticipants: 12,
      noticeOfRaceContent: 'Race notice',
      personsPerBoat: 2,
      registrationEnd: new Date('2026-05-30T20:00:00Z'),
      registrationMode: EventRegistrationMode.external,
      registrationQuestions: [
        {
          answerType: 'text',
          displayOrder: 1,
          id: 'question-1',
          options: [],
          questionText: 'Dietary restrictions?',
          required: false,
        },
      ],
      registrationStart: new Date('2026-05-01T13:00:00Z'),
      requiresApproval: true,
      requiresPhone: true,
      resultsContent: 'Final scores',
      sailingInstructionsVisible: true,
      usesTeamRegistration: true,
    });

    for (const label of optionalEditorLabels) {
      expect(optionalSection(label)).toHaveAttribute('open');
    }
  });
});
