import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { EventRegistrationStatus } from "@/generated/prisma/enums";
import type {
  EventPaymentStatus as EventPaymentStatusValue,
  EventRegistrationStatus as EventRegistrationStatusValue,
} from "@/generated/prisma/enums";
import { resolveEventCategoryCalendarAccentClassName } from "@/lib/mit-sailing/eventCategoryAccent";
import { Role } from "@/libs/auth/roles";
import { prisma } from "@/libs/DB";
import { logger } from "@/libs/Logger";
import { sanitizeCmsRichTextHtml } from "@/libs/mit-sailing/cmsRichText";
import { eventCalendarMonthFromDate } from "@/libs/mit-sailing/eventCalendar";
import type {
  EventCalendarCategory,
  EventCalendarDate,
  EventCalendarMonthBounds,
} from "@/libs/mit-sailing/eventCalendar";
import { safeErrorCode, safeErrorName } from "@/libs/safeUnknownError";
import { getZenStack, zenstackForAuthContext } from "@/libs/zenstack/auth";

export type EventPublicContentSectionDto = {
  body: string;
  id: "faq" | "noticeOfRace" | "sailingInstructions" | "results";
  titleKey:
    | "content_faq_title"
    | "content_notice_of_race_title"
    | "content_sailing_instructions_title"
    | "content_results_title";
};

export type PublicEventDetail = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  slug: string;
  isSpecial: boolean;
  maxParticipants: number | null;
  requiresApproval: boolean;
  requiresPhone: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  detailPageKind: "standard" | "external" | null;
  externalDetailUrl: string | null;
  registrationMode?: "none" | "standard" | "external" | null;
  externalRegistrationUrl?: string | null;
  externalEntriesUrl?: string | null;
  teamRegistration: {
    usesTeamRegistration: boolean;
    boatsPerTeam: number;
    personsPerBoat: number;
    allowRepeatTeamCaptain: boolean;
  };
  addressName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
  category: { name: string };
  dates: {
    id: string;
    startDateTime: Date;
    endDateTime: Date;
  }[];
  admins: {
    id: string;
    admin: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  registrationQuestions: {
    id: string;
    questionText: string;
    answerType: "text" | "select" | "checkbox";
    options: string[];
    required: boolean;
    displayOrder: number;
  }[];
  entryFees: {
    id: string;
    description: string;
    /** USD minor units (integer cents); same as Stripe `amount` for `usd`. */
    amountCents: number;
    isDeposit: boolean;
  }[];
  publicContentSections?: EventPublicContentSectionDto[];
  approvedRegistrationCount: number;
  pendingRegistrationCount: number;
};

export type PublicEventRegistrationState = {
  id: string;
  payment?: {
    amountCents: number;
    receiptUrl: string | null;
    status: EventPaymentStatusValue;
  } | null;
  status: EventRegistrationStatusValue;
};

function logPublicEventsQueryFailure(options: {
  where: string;
  fallback: string;
  error: unknown;
}): void {
  const code = safeErrorCode(options.error);
  logger.error(
    [
      `[public-events:${options.where}]`,
      `fallback=${options.fallback}`,
      `error_name=${safeErrorName(options.error)}`,
      code ? `error_code=${code}` : undefined,
    ]
      .filter((part): part is string => typeof part === "string")
      .join(" "),
  );
}

function logPublicEventsEmptyFallback(options: {
  where: string;
  fallback: string;
  reason: string;
}): void {
  logger.warn(
    `[public-events:${options.where}] fallback=${options.fallback} reason=${options.reason}`,
  );
}

/**
 * Normalizes stored JSON options to a string list for public and admin DTOs.
 *
 * @param value - Raw JSON options from Prisma
 * @returns List of string options
 */
export function questionOptionsFromJson(
  value: Prisma.JsonValue | null,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((option): option is string => typeof option === "string");
}

export function publicContentSectionsFromEvent(event: {
  faqVisible?: boolean;
  faqContent?: string;
  noticeOfRaceVisible?: boolean;
  noticeOfRaceContent?: string;
  sailingInstructionsVisible?: boolean;
  sailingInstructionsContent?: string;
  resultsVisible?: boolean;
  resultsContent?: string;
}): EventPublicContentSectionDto[] {
  const sections = [
    {
      body: event.faqContent ?? "",
      id: "faq",
      titleKey: "content_faq_title",
      visible: event.faqVisible ?? false,
    },
    {
      body: event.noticeOfRaceContent ?? "",
      id: "noticeOfRace",
      titleKey: "content_notice_of_race_title",
      visible: event.noticeOfRaceVisible ?? false,
    },
    {
      body: event.sailingInstructionsContent ?? "",
      id: "sailingInstructions",
      titleKey: "content_sailing_instructions_title",
      visible: event.sailingInstructionsVisible ?? false,
    },
    {
      body: event.resultsContent ?? "",
      id: "results",
      titleKey: "content_results_title",
      visible: event.resultsVisible ?? false,
    },
  ] satisfies readonly (EventPublicContentSectionDto & {
    visible: boolean;
  })[];

  return sections.flatMap((section) => {
    if (!section.visible) {
      return [];
    }
    const body = sanitizeCmsRichTextHtml(section.body);
    if (!body) {
      return [];
    }
    return [{ body, id: section.id, titleKey: section.titleKey }];
  });
}

async function publicEventIds(): Promise<string[]> {
  const rows = await getZenStack().event.findMany({
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Single published event for detail, or `null` if not found or unpublished.
 * Wrapped in {@link https://react.dev/reference/react/cache React `cache`} for request deduplication
 * (metadata and page in the same render).
 *
 * @param slug - URL slug for the event
 * @returns Published event or `null`
 */
export const getPublishedEventForPublicBySlug = cache(async (slug: string) => {
  try {
    const event = await getZenStack().event.findFirst({
      where: { slug },
      select: {
        id: true,
        name: true,
        shortName: true,
        description: true,
        slug: true,
        isSpecial: true,
        maxParticipants: true,
        requiresApproval: true,
        requiresPhone: true,
        registrationStart: true,
        registrationEnd: true,
        detailPageKind: true,
        externalDetailUrl: true,
        registrationMode: true,
        externalRegistrationUrl: true,
        externalEntriesUrl: true,
        usesTeamRegistration: true,
        boatsPerTeam: true,
        personsPerBoat: true,
        allowRepeatTeamCaptain: true,
        faqVisible: true,
        faqContent: true,
        noticeOfRaceVisible: true,
        noticeOfRaceContent: true,
        sailingInstructionsVisible: true,
        sailingInstructionsContent: true,
        resultsVisible: true,
        resultsContent: true,
        addressName: true,
        addressLine1: true,
        addressLine2: true,
        addressCity: true,
        addressState: true,
        addressPostalCode: true,
        addressCountry: true,
        category: { select: { name: true } },
        dates: {
          orderBy: { startDateTime: "asc" },
          select: { id: true, startDateTime: true, endDateTime: true },
        },
        admins: {
          orderBy: [{ admin: { name: "asc" } }, { admin: { email: "asc" } }],
          select: {
            id: true,
            admin: { select: { id: true, name: true, email: true } },
          },
        },
        registrationQuestions: {
          orderBy: [{ displayOrder: "asc" }, { questionText: "asc" }],
          select: {
            id: true,
            questionText: true,
            answerType: true,
            options: true,
            required: true,
            displayOrder: true,
          },
        },
        entryFees: {
          orderBy: [{ isDeposit: "desc" }, { description: "asc" }],
          select: {
            id: true,
            description: true,
            amountCents: true,
            isDeposit: true,
          },
        },
      },
    });
    if (!event) {
      return null;
    }

    const [approvedRegistrationCount, pendingRegistrationCount] =
      await Promise.all([
        prisma.eventRegistration.count({
          where: {
            eventId: event.id,
            status: EventRegistrationStatus.approved,
          },
        }),
        prisma.eventRegistration.count({
          where: { eventId: event.id, status: EventRegistrationStatus.pending },
        }),
      ]);

    return {
      id: event.id,
      name: event.name,
      shortName: event.shortName,
      description: event.description,
      slug: event.slug,
      isSpecial: event.isSpecial,
      maxParticipants: event.maxParticipants,
      requiresApproval: event.requiresApproval,
      requiresPhone: event.requiresPhone,
      registrationStart: event.registrationStart,
      registrationEnd: event.registrationEnd,
      detailPageKind: event.detailPageKind,
      externalDetailUrl: event.externalDetailUrl,
      registrationMode: event.registrationMode,
      externalRegistrationUrl: event.externalRegistrationUrl,
      externalEntriesUrl: event.externalEntriesUrl,
      category: event.category,
      dates: event.dates,
      admins: event.admins,
      entryFees: event.entryFees.map((fee) => ({
        id: fee.id,
        description: fee.description,
        amountCents: fee.amountCents,
        isDeposit: fee.isDeposit,
      })),
      teamRegistration: {
        usesTeamRegistration: event.usesTeamRegistration,
        boatsPerTeam: event.boatsPerTeam,
        personsPerBoat: event.personsPerBoat,
        allowRepeatTeamCaptain: event.allowRepeatTeamCaptain,
      },
      publicContentSections: publicContentSectionsFromEvent(event),
      registrationQuestions: event.registrationQuestions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        answerType: question.answerType,
        options: questionOptionsFromJson(question.options),
        required: question.required,
        displayOrder: question.displayOrder,
      })),
      approvedRegistrationCount,
      pendingRegistrationCount,
    } satisfies PublicEventDetail;
  } catch (error) {
    logPublicEventsQueryFailure({
      where: "detail",
      fallback: "not_found",
      error,
    });
    return null;
  }
});

/**
 * Current viewer's newest registration row for a published event.
 *
 * @param options - Event and user identifiers
 * @returns Registration state or `null`
 */
const getCachedPublicEventRegistrationState = cache(
  async (
    eventId: string,
    userId: string,
  ): Promise<PublicEventRegistrationState | null> => {
    try {
      const db = zenstackForAuthContext({
        appRole: Role.USER,
        id: userId,
      });
      const registration = await db.eventRegistration.findFirst({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          payment: {
            select: {
              amountCents: true,
              status: true,
              stripeReceiptUrl: true,
            },
          },
          status: true,
        },
      });
      return registration
        ? {
            id: registration.id,
            payment: registration.payment
              ? {
                  amountCents: registration.payment.amountCents,
                  receiptUrl: registration.payment.stripeReceiptUrl,
                  status: registration.payment.status,
                }
              : null,
            status: registration.status,
          }
        : null;
    } catch (error) {
      logPublicEventsQueryFailure({
        where: "viewer-registration",
        fallback: "null_registration",
        error,
      });
      return null;
    }
  },
);

export async function getPublicEventRegistrationState(options: {
  eventId: string;
  userId: string;
}): Promise<PublicEventRegistrationState | null> {
  const state = await getCachedPublicEventRegistrationState(
    options.eventId,
    options.userId,
  );
  return state;
}

/**
 * Visible event categories that have at least one published event occurrence in a month.
 *
 * @param params - UTC instants for the month range
 * @returns Categories with events overlapping the month, ordered for filters
 */
export async function listVisibleEventCategoriesForPublicCalendarMonth(params: {
  rangeStart: Date;
  rangeEndExclusive: Date;
}): Promise<EventCalendarCategory[]> {
  try {
    const eventIds = await publicEventIds();
    if (eventIds.length === 0) {
      logPublicEventsEmptyFallback({
        where: "month_categories",
        fallback: "all_categories_only",
        reason: "no_categories_with_month_events",
      });
      return [];
    }
    const categories = await prisma.eventCategory.findMany({
      where: {
        isVisible: true,
        events: {
          some: {
            id: { in: eventIds },
            dates: {
              some: {
                startDateTime: { lt: params.rangeEndExclusive },
                endDateTime: { gte: params.rangeStart },
              },
            },
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, displayOrder: true },
    });
    if (categories.length === 0) {
      logPublicEventsEmptyFallback({
        where: "month_categories",
        fallback: "all_categories_only",
        reason: "no_categories_with_month_events",
      });
    }
    return categories;
  } catch (error) {
    logPublicEventsQueryFailure({
      where: "month_categories",
      fallback: "empty_categories",
      error,
    });
    return [];
  }
}

/**
 * Published event date bounds for calendar navigation.
 *
 * @returns Month bounds in New York local time
 */
export async function getPublishedEventCalendarMonthBounds(): Promise<EventCalendarMonthBounds> {
  try {
    const eventIds = await publicEventIds();
    const bounds = await prisma.eventDate.aggregate({
      where: {
        eventId: { in: eventIds },
        event: {
          category: { isVisible: true },
        },
      },
      _min: { startDateTime: true },
      _max: { endDateTime: true },
    });

    const hasBounds = bounds._min.startDateTime && bounds._max.endDateTime;
    const minMonth = bounds._min.startDateTime
      ? eventCalendarMonthFromDate(bounds._min.startDateTime)
      : eventCalendarMonthFromDate(new Date());
    const maxMonth = bounds._max.endDateTime
      ? eventCalendarMonthFromDate(bounds._max.endDateTime)
      : minMonth;

    if (!hasBounds) {
      logPublicEventsEmptyFallback({
        where: "bounds",
        fallback: "current_month",
        reason: "no_published_event_dates",
      });
    }

    return {
      minYear: minMonth.year,
      minMonth: minMonth.month,
      maxYear: maxMonth.year,
      maxMonth: maxMonth.month,
    };
  } catch (error) {
    const fallbackMonth = eventCalendarMonthFromDate(new Date());
    logPublicEventsQueryFailure({
      where: "bounds",
      fallback: "current_month",
      error,
    });
    return {
      minYear: fallbackMonth.year,
      minMonth: fallbackMonth.month,
      maxYear: fallbackMonth.year,
      maxMonth: fallbackMonth.month,
    };
  }
}

/**
 * Published event dates overlapping a New York calendar month.
 *
 * @param params - UTC instants for the month range and optional category id
 * @returns Event date rows with the event/category data needed by the calendar
 */
export async function listPublishedEventDatesForCalendarMonth(params: {
  rangeStart: Date;
  rangeEndExclusive: Date;
  categoryId?: string;
}): Promise<EventCalendarDate[]> {
  try {
    const eventIds = await publicEventIds();
    if (eventIds.length === 0) {
      return [];
    }
    const dates = await prisma.eventDate.findMany({
      where: {
        eventId: { in: eventIds },
        startDateTime: { lt: params.rangeEndExclusive },
        endDateTime: { gte: params.rangeStart },
        event: {
          category: { isVisible: true },
          ...(params.categoryId ? { eventCategoryId: params.categoryId } : {}),
        },
      },
      orderBy: [{ startDateTime: "asc" }, { event: { name: "asc" } }],
      select: {
        id: true,
        startDateTime: true,
        endDateTime: true,
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            eventCategoryId: true,
            category: {
              select: { id: true, name: true, accentClassName: true },
            },
          },
        },
      },
    });
    return dates.map((row) => ({
      ...row,
      event: {
        ...row.event,
        category: {
          ...row.event.category,
          accentClassName: resolveEventCategoryCalendarAccentClassName(
            row.event.category,
          ),
        },
      },
    }));
  } catch (error) {
    logPublicEventsQueryFailure({
      where: "month_dates",
      fallback: "empty_dates",
      error,
    });
    return [];
  }
}
