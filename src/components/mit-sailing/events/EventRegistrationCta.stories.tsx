import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import {
  EventRegistrationStatus,
  LearnToSailManagedClassKind,
  PaymentStatus,
} from '@/generated/prisma/enums';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import messages from '@/locales/en.json';
import { EventRegistrationCta } from './EventRegistrationCta';

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'MitSailingEvents',
});

const event: PublicEventDetail = {
  admins: [],
  attendees: {
    approved: [],
    pending: [],
  },
  approvedRegistrationCount: 18,
  category: { name: 'Classes' },
  dates: [],
  description: 'Event description.',
  detailPageKind: 'standard',
  entryFees: [],
  externalDetailUrl: null,
  externalEntriesUrl: null,
  externalRegistrationUrl: null,
  id: 'event-1',
  isSpecial: false,
  learnToSailManagedClassKind:
    LearnToSailManagedClassKind.beginner_mid_week_123,
  maxParticipants: 18,
  name: 'Mid-Week 1-2-3',
  pendingRegistrationCount: 132,
  publicContentSections: [],
  registrationEnd: null,
  registrationMode: 'standard',
  registrationQuestions: [],
  registrationStart: null,
  requiresApproval: true,
  requiresPhone: false,
  selectionNote: 'Decisions Monday afternoon',
  shortName: 'Mid-Week 1-2-3',
  slug: 'mid-week-1-2-3',
  teamRegistration: {
    allowRepeatTeamCaptain: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    usesTeamRegistration: false,
  },
};

function cancelRegistrationAction(formData: FormData): void {
  formData.get('storybook-noop');
}

const baseProps = {
  cancelRegistrationAction,
  currentRegistration: null,
  errorCode: null,
  event,
  isSignedIn: true,
  locale: 'en',
  registrationOpens: 'Jun 8, 2026',
  reservationState: 'available',
  t,
} satisfies React.ComponentProps<typeof EventRegistrationCta>;

function StateFrame(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="min-h-28 rounded-xl border border-mit-line bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-mit-text">
        {props.title}
      </h3>
      {props.children}
    </section>
  );
}

const meta = {
  title: 'MIT Sailing/Events/EventRegistrationCta',
  component: EventRegistrationCta,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: baseProps,
} satisfies Meta<typeof EventRegistrationCta>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ApprovalRequired: Story = {};

export const DirectRegistration: Story = {
  args: {
    event: {
      ...event,
      requiresApproval: false,
    },
  },
};

export const ActionStates: Story = {
  render: () => (
    <div className="grid w-[720px] max-w-[calc(100vw-2rem)] gap-4 md:grid-cols-2">
      <StateFrame title="Signed out">
        <EventRegistrationCta
          {...baseProps}
          isSignedIn={false}
          reservationState="available"
        />
      </StateFrame>
      <StateFrame title="Request review">
        <EventRegistrationCta {...baseProps} reservationState="available" />
      </StateFrame>
      <StateFrame title="Registration opens later">
        <EventRegistrationCta {...baseProps} reservationState="opening_later" />
      </StateFrame>
      <StateFrame title="Pending request">
        <EventRegistrationCta {...baseProps} reservationState="pending" />
      </StateFrame>
      <StateFrame title="Accepted">
        <EventRegistrationCta
          {...baseProps}
          currentRegistration={{
            id: 'registration-1',
            payment: null,
            status: EventRegistrationStatus.approved,
          }}
          reservationState="approved"
        />
      </StateFrame>
      <StateFrame title="Payment due">
        <EventRegistrationCta
          {...baseProps}
          currentRegistration={{
            id: 'registration-2',
            payment: {
              amountCents: 4500,
              receiptUrl: null,
              status: PaymentStatus.past_due,
            },
            status: EventRegistrationStatus.approved,
          }}
          reservationState="approved"
        />
      </StateFrame>
      <StateFrame title="Full">
        <EventRegistrationCta {...baseProps} reservationState="full" />
      </StateFrame>
      <StateFrame title="Closed">
        <EventRegistrationCta {...baseProps} reservationState="closed" />
      </StateFrame>
    </div>
  ),
};
