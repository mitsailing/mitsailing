import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventAddressPreset,
  EventDetailPageKind,
  EventRegistrationMode,
} from '@/generated/prisma/enums';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  eventDateGroupBy: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findMany: mocks.eventFindMany,
    },
    eventDate: {
      groupBy: mocks.eventDateGroupBy,
    },
  },
}));

beforeEach(() => {
  mocks.eventDateGroupBy.mockReset();
  mocks.eventDateGroupBy.mockResolvedValue([
    {
      _min: { startDateTime: new Date('2026-06-15T14:00:00Z') },
      eventId: 'event-1',
    },
  ]);
  mocks.eventFindMany.mockReset();
});

type EventRowFixture = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  detailPageKind: EventDetailPageKind;
  externalDetailUrl: string | null;
  maxParticipants: number | null;
  requiresApproval: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  registrationMode: EventRegistrationMode;
  externalRegistrationUrl: string | null;
  addressPreset: EventAddressPreset;
  addressName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  category: {
    id: string;
    name: string;
    displayOrder: number;
  };
  dates: {
    id: string;
    startDateTime: Date;
    endDateTime: Date;
  }[];
  _count: {
    registrations: number;
  };
};

function eventDate(overrides: Partial<EventRowFixture['dates'][number]> = {}) {
  return {
    id: 'date-1',
    startDateTime: new Date('2026-06-15T14:00:00Z'),
    endDateTime: new Date('2026-06-15T16:00:00Z'),
    ...overrides,
  };
}

function eventRow(overrides: Partial<EventRowFixture>): EventRowFixture {
  return {
    id: 'event-1',
    name: 'Test Event',
    shortName: 'Event',
    slug: 'test-event',
    description: 'Race.',
    detailPageKind: EventDetailPageKind.standard,
    externalDetailUrl: null,
    maxParticipants: null,
    requiresApproval: true,
    registrationStart: null,
    registrationEnd: null,
    registrationMode: EventRegistrationMode.none,
    externalRegistrationUrl: null,
    addressPreset: EventAddressPreset.pavilion,
    addressName: null,
    addressLine1: null,
    addressLine2: null,
    addressCity: null,
    addressState: null,
    addressPostalCode: null,
    addressCountry: null,
    category: { id: 'category-racing', name: 'Racing', displayOrder: 2 },
    dates: [eventDate()],
    _count: { registrations: 0 },
    ...overrides,
  };
}

describe('listPublicEventsForDiscovery', () => {
  it('returns published upcoming events with categories and registration links', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'Intro Windsurfing',
        shortName: 'Windsurfing',
        slug: 'intro-windsurfing',
        description: 'Learn to windsurf.',
        maxParticipants: 12,
        requiresApproval: false,
        registrationStart: new Date('2026-05-20T12:00:00Z'),
        registrationEnd: new Date('2026-06-10T12:00:00Z'),
        registrationMode: EventRegistrationMode.standard,
        addressName: '',
        addressLine1: '',
        addressCity: '',
        category: {
          id: 'category-classes',
          name: 'Classes',
          displayOrder: 1,
        },
        _count: { registrations: 1 },
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      query: 'windsurfing',
      now,
    });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }],
        where: expect.objectContaining({
          category: { isVisible: true },
          dates: { some: { endDateTime: { gte: now } } },
          id: { in: ['event-1'] },
          isPublished: true,
          AND: [{ OR: expect.any(Array) }],
        }),
        select: expect.objectContaining({
          _count: {
            select: {
              registrations: {
                where: { status: 'approved' },
              },
            },
          },
        }),
      })
    );
    expect(mocks.eventDateGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['eventId'],
        orderBy: [{ _min: { startDateTime: 'asc' } }, { eventId: 'asc' }],
        take: 20,
        where: expect.objectContaining({
          endDateTime: { gte: now },
          event: expect.objectContaining({
            category: { isVisible: true },
            isPublished: true,
            AND: [{ OR: expect.any(Array) }],
          }),
        }),
        _min: { startDateTime: true },
      })
    );
    expect(result.categories).toEqual([
      { id: 'category-classes', name: 'Classes' },
    ]);
    expect(result.events).toEqual([
      expect.objectContaining({
        category: { id: 'category-classes', name: 'Classes' },
        detailUrl: 'https://mitsailing.com/events/intro-windsurfing',
        firstStartDateTime: '2026-06-15T14:00:00.000Z',
        name: 'Intro Windsurfing',
        registration: expect.objectContaining({
          approvedCount: 1,
          maxParticipants: 12,
          mode: 'standard',
          status: 'open',
          url: 'https://mitsailing.com/events/intro-windsurfing/register',
        }),
      }),
    ]);
  });

  it('marks full standard events without exposing attendee records', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'Full Race',
        shortName: 'Race',
        slug: 'full-race',
        maxParticipants: 1,
        requiresApproval: false,
        registrationMode: EventRegistrationMode.standard,
        _count: { registrations: 1 },
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.registration).toMatchObject({
      approvedCount: 1,
      status: 'full',
      url: null,
    });
    expect(JSON.stringify(result.events)).not.toContain('registration-1');
  });

  it('passes through safe external registration URLs', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'External Regatta',
        shortName: 'Regatta',
        slug: 'external-regatta',
        registrationMode: EventRegistrationMode.external,
        externalRegistrationUrl: 'https://example.com/register',
        addressPreset: EventAddressPreset.custom,
        addressName: 'Harbor',
        addressLine1: '1 Main St',
        addressCity: 'Boston',
        addressState: 'MA',
        addressPostalCode: '02110',
        addressCountry: 'US',
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.registration).toMatchObject({
      mode: 'external',
      status: 'external',
      url: 'https://example.com/register',
    });
  });

  it('rejects unsafe external registration URLs', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const unsafeUrl = ['javascript', 'alert(1)'].join(':');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'Unsafe External Regatta',
        shortName: 'Regatta',
        slug: 'unsafe-external-regatta',
        registrationMode: EventRegistrationMode.external,
        externalRegistrationUrl: unsafeUrl,
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.registration).toMatchObject({
      mode: 'external',
      status: 'unavailable',
      url: null,
    });
  });

  it('uses safe external detail URLs for external detail pages', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'External Detail Regatta',
        shortName: 'Regatta',
        slug: 'external-detail-regatta',
        detailPageKind: EventDetailPageKind.external,
        externalDetailUrl: 'https://example.com/details',
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.detailUrl).toBe('https://example.com/details');
  });

  it('falls back to local event pages for unsafe external detail URLs', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const unsafeUrl = ['javascript', 'alert(1)'].join(':');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        name: 'Unsafe External Detail Regatta',
        shortName: 'Regatta',
        slug: 'unsafe-external-detail-regatta',
        detailPageKind: EventDetailPageKind.external,
        externalDetailUrl: unsafeUrl,
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.detailUrl).toBe(
      'https://mitsailing.com/events/unsafe-external-detail-regatta'
    );
  });

  it('sorts by nearest event date before applying the public limit', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const category = {
      id: 'category-classes',
      name: 'Classes',
      displayOrder: 1,
    };
    mocks.eventDateGroupBy.mockResolvedValue([
      {
        _min: { startDateTime: new Date('2026-06-05T14:00:00Z') },
        eventId: 'event-soon',
      },
    ]);
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-soon',
        name: 'Soon Class',
        shortName: 'Class',
        slug: 'soon-class',
        category,
        registrationMode: EventRegistrationMode.standard,
        requiresApproval: false,
        dates: [
          eventDate({
            id: 'date-soon',
            startDateTime: new Date('2026-06-05T14:00:00Z'),
            endDateTime: new Date('2026-06-05T16:00:00Z'),
          }),
        ],
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      limit: 1,
      now,
    });

    expect(result.events.map((event) => event.slug)).toEqual(['soon-class']);
    expect(mocks.eventDateGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['event-soon'] } }),
      })
    );
  });

  it('uses the latest end across overlapping event dates', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    mocks.eventFindMany.mockResolvedValue([
      eventRow({
        id: 'event-1',
        dates: [
          eventDate({
            id: 'date-long',
            startDateTime: new Date('2026-06-05T14:00:00Z'),
            endDateTime: new Date('2026-06-07T16:00:00Z'),
          }),
          eventDate({
            id: 'date-short-later',
            startDateTime: new Date('2026-06-06T14:00:00Z'),
            endDateTime: new Date('2026-06-06T16:00:00Z'),
          }),
        ],
      }),
    ]);
    const { listPublicEventsForDiscovery } =
      await import('@/libs/mit-sailing/publicEventDiscovery');

    const result = await listPublicEventsForDiscovery({
      origin: 'https://mitsailing.com',
      now,
    });

    expect(result.events[0]?.lastEndDateTime).toBe('2026-06-07T16:00:00.000Z');
  });
});
