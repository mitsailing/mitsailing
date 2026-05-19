import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationCta } from '@/components/mit-sailing/events/EventRegistrationCta';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import messages from '@/locales/en.json';

const noopCancelAction = vi.fn((_formData: FormData) => {});

const minimalEvent: PublicEventDetail = {
  admins: [],
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
  it('renders nothing when reservations are closed (heading lives in EventDetailView)', () => {
    const { container } = render(
      <EventRegistrationCta {...defaultCtaProps} reservationState="closed" />
    );

    expect(container.firstChild).toBeNull();
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
});
