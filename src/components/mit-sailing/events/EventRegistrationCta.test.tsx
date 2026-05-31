import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationCta } from '@/components/mit-sailing/events/EventRegistrationCta';
import {
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
  maxParticipants: null,
  name: 'Spring Series',
  pendingRegistrationCount: 0,
  registrationEnd: null,
  registrationQuestions: [],
  registrationStart: null,
  requiresApproval: true,
  requiresPhone: false,
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
  it('offers another-events recovery when reservations are closed', () => {
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
      screen.getByRole('link', { name: 'Log in to register' })
    ).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fevents%2Fspring-series%2Fregister'
    );
    expect(
      screen.getByText(
        'Use your MIT Sailing account so event admins can match the registration to you.'
      )
    ).toBeVisible();
  });

  it('requests approval for signed-in sailors when an event requires approval', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="available" />
    );

    expect(
      screen.getByRole('link', { name: 'Request to register' })
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

    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute(
      'href',
      '/events/spring-series/register'
    );
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

    expect(screen.getByText(/going/u)).toBeVisible();
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

    expect(screen.getByText(/going/u)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Pay now' })
    ).not.toBeInTheDocument();
  });

  it('lets pending sailors cancel a request without a checkout link', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="pending" />
    );

    expect(screen.getByText('Pending acceptance')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Cancel request' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Pay now' })
    ).not.toBeInTheDocument();
  });

  it('shows capacity closure without a registration link when an event is full', () => {
    render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="full" />
    );

    expect(screen.getByText('Event is at capacity')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Request to register' })
    ).not.toBeInTheDocument();
  });
});
