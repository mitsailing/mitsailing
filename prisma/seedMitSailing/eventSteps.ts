import { SAILING_CLASSES } from '../../src/data/mit-sailing/classesFleetSeed';
import {
  EVENT_ADMINS,
  EVENT_CATEGORIES,
  EVENT_COMMENTS,
  EVENTS,
  EVENT_ENTRY_FEES,
  EVENT_REGISTRATION_ANSWERS,
  EVENT_REGISTRATIONS,
  EVENT_REGISTRATION_QUESTIONS,
  GLOBAL_EVENT_DATES,
  STUB_USERS,
} from '../../src/data/mit-sailing/eventsSeed';
import { Prisma } from '../../src/generated/prisma/client';
import type { PrismaClient } from '../../src/generated/prisma/client';
import type { EventRegistrationStatus } from '../../src/generated/prisma/enums';
import { toDetailPageKind } from './detailPageKind';
import { toDate } from './toPrismaDate';

type EventSeedUpsertArgs = Parameters<PrismaClient['event']['upsert']>[0];

type EventSeedClient = {
  readonly event: {
    readonly upsert: (args: EventSeedUpsertArgs) => Promise<unknown>;
  };
};

/**
 * @param p - Prisma client (injected for tests; production uses `src/libs/DB`)
 */
export async function seedStubUsers(p: PrismaClient): Promise<void> {
  for (const u of STUB_USERS) {
    await p.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        appRole: 'user',
        email: u.email,
        name: u.name,
        emailVerified: true,
        role: 'user',
      },
      update: {
        appRole: 'user',
        email: u.email,
        name: u.name,
        emailVerified: true,
        role: 'user',
      },
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedEventCategories(p: PrismaClient): Promise<void> {
  for (const c of EVENT_CATEGORIES) {
    await p.eventCategory.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        displayOrder: c.display_order,
        isVisible: c.is_visible,
        accentClassName: c.accent_class_name ?? null,
        createdAt: new Date(c.created_at),
      },
      update: {
        name: c.name,
        displayOrder: c.display_order,
        isVisible: c.is_visible,
        accentClassName: c.accent_class_name ?? null,
      },
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedEvents(p: EventSeedClient): Promise<void> {
  for (const e of EVENTS) {
    const detailKind = toDetailPageKind(e.detail_page_kind);
    const createManagedRegistrationFields = {
      learnToSailManagedClassKind: e.learn_to_sail_managed_class_kind ?? 'none',
      registrationMode: e.registration_mode ?? 'standard',
      selectionNote: e.selection_note ?? null,
    };
    const updateManagedRegistrationFields = {
      ...(e.learn_to_sail_managed_class_kind === undefined
        ? {}
        : {
            learnToSailManagedClassKind: e.learn_to_sail_managed_class_kind,
          }),
      ...(e.registration_mode === undefined
        ? {}
        : { registrationMode: e.registration_mode }),
      ...(e.selection_note === undefined
        ? {}
        : { selectionNote: e.selection_note }),
    };
    await p.event.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        name: e.name,
        shortName: e.short_name,
        eventCategoryId: e.event_category_id,
        description: e.description,
        slug: e.slug,
        isSpecial: e.is_special,
        maxParticipants: e.max_participants,
        requiresApproval: e.requires_approval,
        registrationStart: toDate(e.registration_start),
        registrationEnd: toDate(e.registration_end),
        createdAt: new Date(e.created_at),
        detailPageKind: detailKind,
        externalDetailUrl: e.external_detail_url ?? null,
        ...createManagedRegistrationFields,
        isPublished: e.is_published,
      },
      update: {
        name: e.name,
        shortName: e.short_name,
        eventCategoryId: e.event_category_id,
        description: e.description,
        isSpecial: e.is_special,
        maxParticipants: e.max_participants,
        requiresApproval: e.requires_approval,
        registrationStart: toDate(e.registration_start),
        registrationEnd: toDate(e.registration_end),
        createdAt: new Date(e.created_at),
        detailPageKind: detailKind,
        externalDetailUrl: e.external_detail_url ?? null,
        ...updateManagedRegistrationFields,
        isPublished: e.is_published,
      },
    });
  }
}

/**
 * Populates {@link SAILING_CLASSES} related-event links after `event` rows exist.
 *
 * @param p - Prisma client
 */
export async function seedSailingClassRelatedEventsFromSeed(
  p: PrismaClient
): Promise<void> {
  for (const cl of SAILING_CLASSES) {
    await p.sailingClassRelatedEvent.deleteMany({
      where: { sailingClassId: cl.id },
    });
    const existingEvents = await p.event.findMany({
      where: { id: { in: cl.relatedEventIds } },
      select: { id: true },
    });
    if (existingEvents.length > 0) {
      await p.sailingClassRelatedEvent.createMany({
        data: existingEvents.map((e) => ({
          sailingClassId: cl.id,
          eventId: e.id,
        })),
        skipDuplicates: true,
      });
    }
  }
}

/**
 * @param p - Prisma client
 */
export async function seedEventRelatedRows(p: PrismaClient): Promise<void> {
  for (const d of GLOBAL_EVENT_DATES) {
    await p.eventDate.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        eventId: d.eventId,
        startDateTime: new Date(d.start_datetime),
        endDateTime: new Date(d.end_datetime),
      },
      update: {
        startDateTime: new Date(d.start_datetime),
        endDateTime: new Date(d.end_datetime),
      },
    });
  }

  for (const a of EVENT_ADMINS) {
    await p.eventAdmin.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        eventId: a.event_id,
        adminUserId: a.admin_user_id,
      },
      update: {
        adminUserId: a.admin_user_id,
      },
    });
  }

  for (const q of EVENT_REGISTRATION_QUESTIONS) {
    const optionsValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      q.options === undefined
        ? Prisma.JsonNull
        : (structuredClone(q.options) as Prisma.InputJsonValue);
    await p.eventRegistrationQuestion.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        eventId: q.event_id,
        questionText: q.question_text,
        answerType: q.answer_type,
        options: optionsValue,
        required: q.required,
        displayOrder: q.display_order,
      },
      update: {
        questionText: q.question_text,
        answerType: q.answer_type,
        options: optionsValue,
        required: q.required,
        displayOrder: q.display_order,
      },
    });
  }

  for (const f of EVENT_ENTRY_FEES) {
    await p.eventEntryFee.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        eventId: f.event_id,
        description: f.description,
        amountCents: f.amount_cents,
      },
      update: {
        description: f.description,
        amountCents: f.amount_cents,
      },
    });
  }

  for (const r of EVENT_REGISTRATIONS) {
    await p.eventRegistration.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        eventId: r.event_id,
        userId: r.user_id,
        status: r.status as EventRegistrationStatus,
        phone: '+16175550100',
        createdAt: new Date(r.created_at),
        swimAgreementAcceptedAt: new Date(r.swim_agreement_accepted_at),
      },
      update: {
        status: r.status as EventRegistrationStatus,
        phone: '+16175550100',
        createdAt: new Date(r.created_at),
        swimAgreementAcceptedAt: new Date(r.swim_agreement_accepted_at),
      },
    });
  }

  for (const a of EVENT_REGISTRATION_ANSWERS) {
    await p.eventRegistrationAnswer.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        registrationId: a.registration_id,
        questionId: a.question_id,
        value: a.value,
      },
      update: { value: a.value },
    });
  }

  for (const c of EVENT_COMMENTS) {
    await p.eventComment.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        eventId: c.event_id,
        parentId: c.parent_id,
        userId: c.user_id,
        body: c.body,
        createdAt: new Date(c.created_at),
      },
      update: {
        body: c.body,
        parentId: c.parent_id,
        createdAt: new Date(c.created_at),
      },
    });
  }
}
