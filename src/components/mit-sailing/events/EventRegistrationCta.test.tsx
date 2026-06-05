import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationCta } from '@/components/mit-sailing/events/EventRegistrationCta';
import {
  LearnToSailManagedClassKind,
  PaymentStatus,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import messages from '@/locales/en.json';

const noopCancelAction = vi.fn((_formData: FormData) => {});

const minimalEvent: PublicEventDetail = {
  admins: [],
  attendees: {
    approved: [],
    pending: [],
  },
  approvedRegistrationCount: 0,
  category: { name: 'Racing' },
  dates: [],
  description: 'Spring racing series.',
  detailPageKind: 'standard',
  entryFees: [],
  externalDetailUrl: null,
  id: 'event-1',
  isSpecial: false,
  learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
  maxParticipants: null,
  name: 'Spring Series',
  pendingRegistrationCount: 0,
  registrationEnd: null,
  registrationQuestions: [],
  registrationStart: null,
  requiresApproval: true,
  requiresPhone: false,
  selectionNote: null,
  slug: 'spring-series',
  shortName: 'Spring Series',
  teamRegistration: {
    allowRepeatTeamCaptain: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    usesTeamRegistration: false,
  },
};

const defaultCtaProps = {
  cancelRegistrationAction: noopCancelAction,
  currentRegistration: null,
  errorCode: null,
  event: minimalEvent,
  isSignedIn: true,
  locale: 'en',
  registrationOpens: 'Jun 1, 2026',
  t: createTranslator({
    locale: 'en',
    messages,
    namespace: 'MitSailingEvents',
  }),
} as const;

describe('EventRegistrationCta', () => {
  it('offers another-events recovery when registration is closed', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="closed" />
    );

    expect(
      screen.getByRole('link', { name: 'View other events' })
    ).toHaveAttribute('href', '/events');
  });

  it('shows opening-later pill when registration has not opened yet', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        registrationOpens="Jul 1, 2026"
        reservationState="opening_later"
      />
    );

    expect(screen.getByText('Registration opens Jul 1, 2026')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Registration opens Jul 1, 2026'
    );
  });

  it('surfaces action errors as alerts', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        errorCode="closed"
        reservationState="available"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Registration is not open for this event.'
    );
  });

  it('sends signed-out sailors through login with the registration callback', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        isSignedIn={false}
        reservationState="available"
      />
    );

    expect(
      screen.getByRole('link', { name: 'Log in to request a spot' })
    ).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fevents%2Fspring-series%2Fregister'
    );
    expect(
      screen.getByText(
        'Use your MIT Sailing account so this registration stays attached to you.'
      )
    ).toBeVisible();
  });

  it('requests approval for signed-in sailors when an event requires approval', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="available" />
    );

    expect(
      screen.getByRole('link', { name: 'Request a spot' })
    ).toHaveAttribute('href', '/events/spring-series/register');
  });

  it('explains waitlist number rule for managed Learn-to-Sail class requests', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        event={{
          ...minimalEvent,
          approvedRegistrationCount: 18,
          learnToSailManagedClassKind:
            LearnToSailManagedClassKind.beginner_mid_week_123,
          maxParticipants: 18,
          pendingRegistrationCount: 132,
        }}
        reservationState="available"
      />
    );

    expect(screen.getByText('Annual waitlist')).toBeVisible();
    expect(screen.getByText('Not first-come')).toBeVisible();
    expect(screen.getByText('150 class requests')).toBeVisible();
    expect(screen.getByText('18 spots')).toBeVisible();
    expect(
      screen.getByText(
        'Request this class. If requests exceed spots, waitlist number decides. Request time does not change your order.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Request a spot' })
    ).toHaveAttribute('href', '/events/spring-series/register');
  });

  it('registers signed-in sailors directly when approval is not required', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        event={{ ...minimalEvent, requiresApproval: false }}
        reservationState="available"
      />
    );

    expect(
      screen.getByRole('link', { name: 'Register for this event' })
    ).toHaveAttribute('href', '/events/spring-series/register');
  });

  it('keeps approved sailors on payment recovery when checkout is still due', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        currentRegistration={{
          id: 'registration-1',
          payment: {
            amountCents: 4500,
            receiptUrl: null,
            status: PaymentStatus.past_due,
          },
          status: EventRegistrationStatus.approved,
        }}
        reservationState="approved"
      />
    );

    expect(screen.getByText('Payment needed')).toBeVisible();
    expect(screen.getByText('Payment due: $45.00')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute(
      'href',
      '/events/spring-series/checkout'
    );
  });

  it('does not show checkout recovery for completed approved registrations', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        currentRegistration={{
          id: 'registration-1',
          payment: {
            amountCents: 4500,
            receiptUrl: 'https://pay.stripe.com/receipts/test',
            status: PaymentStatus.paid,
          },
          status: EventRegistrationStatus.approved,
        }}
        reservationState="approved"
      />
    );

    expect(screen.getByText(/confirmed/u)).toBeVisible();
    expect(
      screen.getByText('You are registered for this event.')
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Pay now' })
    ).not.toBeInTheDocument();
  });

  it('lets pending sailors cancel a request without a checkout link', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="pending" />
    );

    expect(screen.getByText('Waiting for confirmation')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Cancel request' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Pay now' })
    ).not.toBeInTheDocument();
  });

  it('shows class-request status for pending Learn-to-Sail requests', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        event={{
          ...minimalEvent,
          learnToSailManagedClassKind:
            LearnToSailManagedClassKind.beginner_sunday_all_in_one,
        }}
        reservationState="pending"
      />
    );

    expect(screen.getByText('Spot requested')).toBeVisible();
    expect(
      screen.getByText(
        'We saved your class request. We will email you when your request is reviewed.'
      )
    ).toBeVisible();
    expect(screen.queryByText('Waiting for confirmation')).toBeNull();
  });

  it('shows class-spot status for approved Learn-to-Sail requests', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        currentRegistration={{
          id: 'registration-1',
          payment: null,
          status: EventRegistrationStatus.approved,
        }}
        event={{
          ...minimalEvent,
          learnToSailManagedClassKind:
            LearnToSailManagedClassKind.beginner_mid_week_123,
        }}
        reservationState="approved"
      />
    );

    expect(screen.getByText('You have a spot')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('You have a spot');
    expect(
      screen.getByText('You are on the class list for this event.')
    ).toBeVisible();
    expect(screen.queryByText(/confirmed/u)).toBeNull();
  });

  it('shows capacity closure without a registration link when an event is full', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="full" />
    );

    expect(screen.getByText('Event is at capacity')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Request a spot' })
    ).not.toBeInTheDocument();
  });

  it('keeps waitlist context visible when a managed class is full', () => {
    render(
      <EventRegistrationCta
        {...defaultCtaProps}
        event={{
          ...minimalEvent,
          approvedRegistrationCount: 18,
          learnToSailManagedClassKind:
            LearnToSailManagedClassKind.beginner_sunday_all_in_one,
          maxParticipants: 18,
          pendingRegistrationCount: 132,
        }}
        reservationState="full"
      />
    );

    expect(screen.getByText('Event is at capacity')).toBeVisible();
    expect(screen.getByText('Annual waitlist')).toBeVisible();
    expect(screen.getByText('Not first-come')).toBeVisible();
    expect(screen.getByText('150 class requests')).toBeVisible();
    expect(screen.getByText('18 spots')).toBeVisible();
  });
});
