import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EventDetailPageKind } from '@/generated/prisma/enums';
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
  updateAdminEventQuestionAction: vi.fn(),
}));

type AdminEventFormViewProps = React.ComponentProps<typeof AdminEventFormView>;

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

function renderView(accessMode: AdminEventFormViewProps['accessMode']) {
  return render(
    <AdminEventFormView
      accessMode={accessMode}
      categories={[{ id: 'category-1', name: 'Clinic' }]}
      errorCode={null}
      event={{
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
        entryFees: [
          {
            amountCents: 2500,
            description: 'Clinic fee',
            id: 'fee-1',
            isDeposit: false,
          },
        ],
        eventCategoryId: 'category-1',
        externalDetailUrl: null,
        id: 'event-1',
        internalNotes: 'Private staffing note',
        isPublished: true,
        isSpecial: false,
        maxParticipants: 12,
        name: 'Intro Sail',
        registrationCounts: {
          approved: 1,
          cancelled: 0,
          pending: 0,
        },
        registrationEnd: null,
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
        registrationStart: null,
        requiresApproval: true,
        requiresPhone: false,
        shortName: '',
        slug: 'intro-sail',
      }}
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

describe('AdminEventFormView', () => {
  it('hides internal notes and mutation controls for read-only access', () => {
    renderView('readOnly');

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
  });
});
