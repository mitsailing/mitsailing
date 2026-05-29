import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  EventDetailPageKind,
  EventRegistrationMode,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { safeExternalHttpHref } from '@/libs/mit-sailing/cmsHref';
import { eventAddressPresetFields } from '@/libs/mit-sailing/eventAddressPresets';
import { MIT_SAILING_PUBLIC_ORIGIN } from '@/libs/mit-sailing/publicDiscoveryUrls';
import { AppConfig } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';

type PublicEventDiscoveryRegistrationStatus =
  | 'closed'
  | 'external'
  | 'full'
  | 'open'
  | 'opening_later'
  | 'unavailable';

type PublicEventDiscoveryDate = {
  id: string;
  startDateTime: string;
  endDateTime: string;
};

type PublicEventDiscoveryLocation = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type PublicEventDiscoveryEvent = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  detailUrl: string;
  category: {
    id: string;
    name: string;
  };
  location: PublicEventDiscoveryLocation;
  dates: PublicEventDiscoveryDate[];
  firstStartDateTime: string | null;
  lastEndDateTime: string | null;
  registration: {
    approvedCount: number;
    closesAt: string | null;
    maxParticipants: number | null;
    mode: EventRegistrationMode;
    opensAt: string | null;
    requiresApproval: boolean;
    status: PublicEventDiscoveryRegistrationStatus;
    url: string | null;
  };
};

export type PublicEventDiscoveryResponse = {
  categories: {
    id: string;
    name: string;
  }[];
  events: PublicEventDiscoveryEvent[];
  generatedAt: string;
};

type PublicEventDiscoveryRow = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  detailPageKind: EventDetailPageKind | null;
  externalDetailUrl: string | null;
  maxParticipants: number | null;
  requiresApproval: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  registrationMode: EventRegistrationMode;
  externalRegistrationUrl: string | null;
  addressPreset: Parameters<typeof eventAddressPresetFields>[0];
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

const defaultPublicEventLimit = 20;
const maxPublicEventLimit = 50;

function trimmedParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function discoveryUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function localEventPath(slug: string, suffix = ''): string {
  return getI18nPath(
    `/events/${encodeURIComponent(slug)}${suffix}`,
    AppConfig.i18n.defaultLocale
  );
}

function nullableIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function addressValue(
  value: string | null,
  fallbackValue: string | undefined
): string | null {
  const trimmed = value?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return fallbackValue && fallbackValue.length > 0 ? fallbackValue : null;
}

function locationFromEvent(
  event: Pick<
    PublicEventDiscoveryRow,
    | 'addressCity'
    | 'addressCountry'
    | 'addressLine1'
    | 'addressLine2'
    | 'addressName'
    | 'addressPostalCode'
    | 'addressPreset'
    | 'addressState'
  >
): PublicEventDiscoveryLocation {
  const preset = eventAddressPresetFields(event.addressPreset);
  return {
    name: addressValue(event.addressName, preset?.addressName),
    line1: addressValue(event.addressLine1, preset?.addressLine1),
    line2: addressValue(event.addressLine2, preset?.addressLine2),
    city: addressValue(event.addressCity, preset?.addressCity),
    state: addressValue(event.addressState, preset?.addressState),
    postalCode: addressValue(
      event.addressPostalCode,
      preset?.addressPostalCode
    ),
    country: addressValue(event.addressCountry, preset?.addressCountry),
  };
}

function publicRegistrationStatus(options: {
  approvedCount: number;
  event: Pick<
    PublicEventDiscoveryRow,
    | 'externalRegistrationUrl'
    | 'maxParticipants'
    | 'registrationEnd'
    | 'registrationMode'
    | 'registrationStart'
    | 'requiresApproval'
  >;
  externalRegistrationUrl: string | null;
  now: Date;
}): PublicEventDiscoveryRegistrationStatus {
  if (options.event.registrationMode === EventRegistrationMode.external) {
    return options.externalRegistrationUrl ? 'external' : 'unavailable';
  }
  if (options.event.registrationMode === EventRegistrationMode.none) {
    return 'unavailable';
  }
  const nowMs = options.now.getTime();
  if (
    options.event.registrationStart !== null &&
    nowMs < options.event.registrationStart.getTime()
  ) {
    return 'opening_later';
  }
  if (
    options.event.registrationEnd !== null &&
    nowMs >= options.event.registrationEnd.getTime()
  ) {
    return 'closed';
  }
  if (
    !options.event.requiresApproval &&
    options.event.maxParticipants !== null &&
    options.approvedCount >= options.event.maxParticipants
  ) {
    return 'full';
  }
  return 'open';
}

function publicRegistrationUrl(options: {
  event: Pick<
    PublicEventDiscoveryRow,
    'externalRegistrationUrl' | 'registrationMode' | 'slug'
  >;
  externalRegistrationUrl: string | null;
  origin: string;
  status: PublicEventDiscoveryRegistrationStatus;
}): string | null {
  if (options.status === 'external') {
    return options.externalRegistrationUrl;
  }
  if (options.status !== 'open') {
    return null;
  }
  if (options.event.registrationMode !== EventRegistrationMode.standard) {
    return null;
  }
  return discoveryUrl(
    options.origin,
    localEventPath(options.event.slug, '/register')
  );
}

function queryFilter(query: string | undefined): Prisma.EventWhereInput | null {
  if (!query) {
    return null;
  }
  return {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { shortName: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { category: { name: { contains: query, mode: 'insensitive' } } },
    ],
  };
}

function categoryFilter(
  category: string | undefined
): Prisma.EventWhereInput | null {
  if (!category) {
    return null;
  }
  return {
    OR: [
      { eventCategoryId: category },
      { category: { name: { equals: category, mode: 'insensitive' } } },
    ],
  };
}

function publicEventsWhere(params: {
  category?: string;
  query?: string;
}): Prisma.EventWhereInput {
  const filters = [
    queryFilter(trimmedParam(params.query)),
    categoryFilter(trimmedParam(params.category)),
  ].filter((filter): filter is Prisma.EventWhereInput => filter !== null);
  return {
    isPublished: true,
    category: { isVisible: true },
    ...(filters.length > 0 ? { AND: filters } : {}),
  };
}

function publicEventLimit(value: number | undefined): number {
  if (value === undefined) {
    return defaultPublicEventLimit;
  }
  if (!Number.isInteger(value)) {
    return defaultPublicEventLimit;
  }
  return Math.min(maxPublicEventLimit, Math.max(1, value));
}

function categorySortKey(category: { displayOrder: number; name: string }) {
  return `${String(category.displayOrder).padStart(8, '0')}:${category.name}`;
}

function eventSortKey(event: PublicEventDiscoveryRow): number {
  return event.dates[0]?.startDateTime.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function publicEventDetailUrl(options: {
  event: Pick<
    PublicEventDiscoveryRow,
    'detailPageKind' | 'externalDetailUrl' | 'slug'
  >;
  origin: string;
}): string {
  if (options.event.detailPageKind === EventDetailPageKind.external) {
    const safeExternalUrl = safeExternalHttpHref(
      options.event.externalDetailUrl
    );
    if (safeExternalUrl) {
      return safeExternalUrl;
    }
  }
  return discoveryUrl(options.origin, localEventPath(options.event.slug));
}

function publicEventFromRow(options: {
  event: PublicEventDiscoveryRow;
  now: Date;
  origin: string;
}): PublicEventDiscoveryEvent {
  const approvedCount = options.event._count.registrations;
  const externalRegistrationUrl = safeExternalHttpHref(
    options.event.externalRegistrationUrl
  );
  const status = publicRegistrationStatus({
    approvedCount,
    event: options.event,
    externalRegistrationUrl,
    now: options.now,
  });
  const dates = options.event.dates.map((date) => ({
    id: date.id,
    startDateTime: date.startDateTime.toISOString(),
    endDateTime: date.endDateTime.toISOString(),
  }));
  return {
    id: options.event.id,
    name: options.event.name,
    shortName: options.event.shortName,
    slug: options.event.slug,
    description: options.event.description,
    detailUrl: publicEventDetailUrl({
      event: options.event,
      origin: options.origin,
    }),
    category: {
      id: options.event.category.id,
      name: options.event.category.name,
    },
    location: locationFromEvent(options.event),
    dates,
    firstStartDateTime: dates[0]?.startDateTime ?? null,
    lastEndDateTime: dates.at(-1)?.endDateTime ?? null,
    registration: {
      approvedCount,
      closesAt: nullableIso(options.event.registrationEnd),
      maxParticipants: options.event.maxParticipants,
      mode: options.event.registrationMode,
      opensAt: nullableIso(options.event.registrationStart),
      requiresApproval: options.event.requiresApproval,
      status,
      url: publicRegistrationUrl({
        event: options.event,
        externalRegistrationUrl,
        origin: options.origin,
        status,
      }),
    },
  };
}

export async function listPublicEventsForDiscovery(params: {
  category?: string;
  limit?: number;
  now?: Date;
  origin?: string;
  query?: string;
}): Promise<PublicEventDiscoveryResponse> {
  const now = params.now ?? new Date();
  const limit = publicEventLimit(params.limit);
  const rows = (await prisma.event.findMany({
    where: {
      ...publicEventsWhere({
        category: params.category,
        query: params.query,
      }),
      dates: { some: { endDateTime: { gte: now } } },
    },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      description: true,
      detailPageKind: true,
      externalDetailUrl: true,
      maxParticipants: true,
      requiresApproval: true,
      registrationStart: true,
      registrationEnd: true,
      registrationMode: true,
      externalRegistrationUrl: true,
      addressPreset: true,
      addressName: true,
      addressLine1: true,
      addressLine2: true,
      addressCity: true,
      addressState: true,
      addressPostalCode: true,
      addressCountry: true,
      category: {
        select: { id: true, name: true, displayOrder: true },
      },
      dates: {
        where: { endDateTime: { gte: now } },
        orderBy: { startDateTime: 'asc' },
        select: { id: true, startDateTime: true, endDateTime: true },
      },
      _count: {
        select: {
          registrations: {
            where: { status: EventRegistrationStatus.approved },
          },
        },
      },
    },
  })) as PublicEventDiscoveryRow[];
  const sortedRows = rows
    .toSorted((left, right) => eventSortKey(left) - eventSortKey(right))
    .slice(0, limit);
  const origin = params.origin ?? MIT_SAILING_PUBLIC_ORIGIN;
  const events = sortedRows.map((event) =>
    publicEventFromRow({
      event,
      now,
      origin,
    })
  );
  const categories = [
    ...new Map(
      sortedRows
        .toSorted((left, right) =>
          categorySortKey(left.category).localeCompare(
            categorySortKey(right.category)
          )
        )
        .map((event) => [
          event.category.id,
          { id: event.category.id, name: event.category.name },
        ])
    ).values(),
  ];
  return {
    categories,
    events,
    generatedAt: now.toISOString(),
  };
}
