import { staff } from '../../src/data/mit-sailing/aboutContent';
import {
  CLASS_CATEGORY_ROWS,
  classCategoryIdFromSeedKey,
} from '../../src/data/mit-sailing/classCategoriesSeed';
import {
  FLEET_BOATS,
  SAILING_CLASSES,
} from '../../src/data/mit-sailing/classesFleetSeed';
import {
  CMS_MENU_SEED_ROWS,
  CMS_PAGE_SEED_ROWS,
  orderedCmsSeedMenuItems,
} from '../../src/data/mit-sailing/cmsSeed';
import type {
  CmsSeedMenu,
  CmsSeedMenuItem,
  CmsSeedPage,
} from '../../src/data/mit-sailing/cmsSeed';
import { DONATION_FUND_SEED_ROWS } from '../../src/data/mit-sailing/donationFundsSeed';
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
import { SITE_ALERT_SEED_ROWS } from '../../src/data/mit-sailing/siteAlertsSeed';
import { Prisma } from '../../src/generated/prisma/client';
import type { PrismaClient } from '../../src/generated/prisma/client';
import type { EventRegistrationStatus } from '../../src/generated/prisma/enums';
import { toDetailPageKind } from './detailPageKind';
import { toDate } from './toPrismaDate';

/**
 * @param p - Prisma client (injected for tests; production uses `src/libs/DB`)
 */
export async function seedStubUsers(p: PrismaClient): Promise<void> {
  for (const u of STUB_USERS) {
    await p.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        emailVerified: true,
        role: 'user',
      },
      update: {
        email: u.email,
        name: u.name,
        emailVerified: true,
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
export async function seedClassCategories(p: PrismaClient): Promise<void> {
  const now = new Date();
  for (const row of CLASS_CATEGORY_ROWS) {
    await p.classCategory.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        displayOrder: row.displayOrder,
        isVisible: true,
        createdAt: now,
      },
      update: {
        slug: row.slug,
        name: row.name,
        displayOrder: row.displayOrder,
      },
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedSailingClassesAndBoats(
  p: PrismaClient
): Promise<void> {
  const displayOrderByCategory = new Map<string, number>();

  function nextDisplayOrder(categoryKey: string): number {
    const n = displayOrderByCategory.get(categoryKey) ?? 0;
    displayOrderByCategory.set(categoryKey, n + 1);
    return n;
  }

  for (const cl of SAILING_CLASSES) {
    const classCategoryId = classCategoryIdFromSeedKey(cl.category);
    const displayOrder = nextDisplayOrder(cl.category);
    await p.sailingClass.upsert({
      where: { id: cl.id },
      create: {
        id: cl.id,
        name: cl.name,
        slug: cl.slug,
        classCategoryId,
        level: cl.level,
        description: cl.description,
        displayOrder,
        isVisible: true,
      },
      update: {
        name: cl.name,
        classCategoryId,
        level: cl.level,
        description: cl.description,
        displayOrder,
        isVisible: true,
      },
    });

    await p.sailingClassPrerequisite.deleteMany({
      where: { sailingClassId: cl.id },
    });
    if (cl.prerequisites.length > 0) {
      await p.sailingClassPrerequisite.createMany({
        data: cl.prerequisites.map((prerequisiteClassId) => ({
          sailingClassId: cl.id,
          prerequisiteClassId,
        })),
        skipDuplicates: true,
      });
    }
  }

  for (const b of FLEET_BOATS) {
    await p.fleetBoat.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        name: b.name,
        slug: b.slug,
        type: b.type,
        capacity: b.capacity,
        displayOrder: b.displayOrder,
        requiredClassId: b.requiredClassId,
        description: b.description,
        imagePath: b.image,
      },
      update: {
        name: b.name,
        type: b.type,
        capacity: b.capacity,
        displayOrder: b.displayOrder,
        requiredClassId: b.requiredClassId,
        description: b.description,
        imagePath: b.image,
      },
    });
  }

  for (const cl of SAILING_CLASSES) {
    await p.sailingClassUnlockedBoat.deleteMany({
      where: { sailingClassId: cl.id },
    });
    const existingBoats = await p.fleetBoat.findMany({
      where: { id: { in: cl.unlockedBoatIds } },
      select: { id: true },
    });
    if (existingBoats.length > 0) {
      await p.sailingClassUnlockedBoat.createMany({
        data: existingBoats.map((b) => ({
          sailingClassId: cl.id,
          fleetBoatId: b.id,
        })),
        skipDuplicates: true,
      });
    }
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
export async function seedStaff(p: PrismaClient): Promise<void> {
  for (const s of staff) {
    const fullBio = structuredClone(s.fullBio) as Prisma.InputJsonValue;
    await p.staffMember.upsert({
      where: { slug: s.slug },
      create: {
        id: s.slug,
        slug: s.slug,
        name: s.name,
        role: s.role,
        bio: s.bio ?? null,
        fullBio,
        imageSrc: s.imageSrc ?? null,
        imageAlt: s.imageAlt ?? null,
        email: s.email,
      },
      update: {
        name: s.name,
        role: s.role,
        bio: s.bio ?? null,
        fullBio,
        imageSrc: s.imageSrc ?? null,
        imageAlt: s.imageAlt ?? null,
        email: s.email,
      },
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedEvents(p: PrismaClient): Promise<void> {
  for (const e of EVENTS) {
    const detailKind = toDetailPageKind(e.detail_page_kind);
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
        createdByUserId: e.created_by,
        createdAt: new Date(e.created_at),
        detailPageKind: detailKind,
        externalDetailUrl: e.external_detail_url ?? null,
        internalNotes: e.internal_notes ?? null,
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
        createdByUserId: e.created_by,
        createdAt: new Date(e.created_at),
        detailPageKind: detailKind,
        externalDetailUrl: e.external_detail_url ?? null,
        internalNotes: e.internal_notes ?? null,
        isPublished: e.is_published,
      },
    });
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
        isDeposit: f.is_deposit,
      },
      update: {
        description: f.description,
        amountCents: f.amount_cents,
        isDeposit: f.is_deposit,
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
        createdAt: new Date(r.created_at),
        swimAgreementAcceptedAt: new Date(r.swim_agreement_accepted_at),
      },
      update: {
        status: r.status as EventRegistrationStatus,
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

/**
 * @param p - Prisma client
 */
export async function seedDonationFunds(p: PrismaClient): Promise<void> {
  for (const row of DONATION_FUND_SEED_ROWS) {
    await p.donationFund.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        fundId: row.fundId,
        name: row.name,
        description: row.description,
        url: row.url,
        displayOrder: row.displayOrder,
        isVisible: row.isVisible,
      },
      update: {
        fundId: row.fundId,
        name: row.name,
        description: row.description,
        url: row.url,
        displayOrder: row.displayOrder,
        isVisible: row.isVisible,
      },
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedSiteAlerts(p: PrismaClient): Promise<void> {
  for (const row of SITE_ALERT_SEED_ROWS) {
    await p.siteAlert.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        body: row.body,
        isPublished: row.isPublished,
        startDate: row.startDate,
        lastDate: row.lastDate,
      },
      update: {
        body: row.body,
        isPublished: row.isPublished,
        startDate: row.startDate,
        lastDate: row.lastDate,
      },
    });
  }
}

function hasSeedText(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function cmsSeedBlockDisplayFlags(block: CmsSeedPage['blocks'][number]) {
  return {
    showCta:
      block.showCta ??
      (hasSeedText(block.ctaLabel) && hasSeedText(block.ctaUrl)),
    showImage:
      block.showImage ??
      (hasSeedText(block.imageSrc) && hasSeedText(block.imageAlt)),
  };
}

async function seedCmsPageBlocks(props: {
  p: PrismaClient;
  page: CmsSeedPage;
}): Promise<void> {
  const { p, page } = props;

  for (const block of page.blocks) {
    const { showCta, showImage } = cmsSeedBlockDisplayFlags(block);
    await p.cmsPageBlock.upsert({
      where: { id: block.id },
      create: {
        id: block.id,
        pageId: page.id,
        kind: block.kind,
        title: block.title,
        subtitle: block.subtitle ?? null,
        body: block.body ?? null,
        ctaLabel: block.ctaLabel ?? null,
        ctaUrl: block.ctaUrl ?? null,
        showCta,
        imageSrc: block.imageSrc ?? null,
        imageAlt: block.imageAlt ?? null,
        showImage,
        displayOrder: block.displayOrder,
        isVisible: block.isVisible,
      },
      update: {
        pageId: page.id,
        kind: block.kind,
        title: block.title,
        subtitle: block.subtitle ?? null,
        body: block.body ?? null,
        ctaLabel: block.ctaLabel ?? null,
        ctaUrl: block.ctaUrl ?? null,
        showCta,
        imageSrc: block.imageSrc ?? null,
        imageAlt: block.imageAlt ?? null,
        showImage,
        displayOrder: block.displayOrder,
        isVisible: block.isVisible,
      },
    });
  }
}

async function seedCmsPages(p: PrismaClient): Promise<void> {
  for (const page of CMS_PAGE_SEED_ROWS) {
    await p.cmsPage.upsert({
      where: { id: page.id },
      create: {
        id: page.id,
        slug: page.slug,
        path: page.path,
        title: page.title,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        isPublished: page.isPublished ?? true,
      },
      update: {
        slug: page.slug,
        path: page.path,
        title: page.title,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        isPublished: page.isPublished ?? true,
      },
    });
    await seedCmsPageBlocks({ p, page });
  }
}

async function seedCmsMenuItem(props: {
  p: PrismaClient;
  menu: CmsSeedMenu;
  item: CmsSeedMenuItem;
}): Promise<void> {
  const { p, menu, item } = props;
  const linkedPageId = item.kind === 'page_link' ? item.linkedPageId : null;
  const url = item.kind === 'url_link' ? (item.url ?? null) : null;
  const isExternal = item.kind === 'url_link' ? item.isExternal : false;

  await p.cmsMenuItem.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      menuId: menu.id,
      parentId: item.parentId ?? null,
      linkedPageId,
      label: item.label,
      url,
      isExternal,
      isVisible: item.isVisible,
      displayOrder: item.displayOrder,
      systemKey: item.systemKey ?? null,
    },
    update: {
      menuId: menu.id,
      parentId: item.parentId ?? null,
      linkedPageId,
      label: item.label,
      url,
      isExternal,
      isVisible: item.isVisible,
      displayOrder: item.displayOrder,
      systemKey: item.systemKey ?? null,
    },
  });
}

async function seedCmsMenus(p: PrismaClient): Promise<void> {
  for (const menu of CMS_MENU_SEED_ROWS) {
    const items = orderedCmsSeedMenuItems(menu);

    await p.cmsMenu.upsert({
      where: { id: menu.id },
      create: {
        id: menu.id,
        location: menu.location,
        title: menu.title,
      },
      update: {
        location: menu.location,
        title: menu.title,
      },
    });

    await p.cmsMenuItem.deleteMany({
      where:
        items.length === 0
          ? { menuId: menu.id }
          : {
              menuId: menu.id,
              id: { notIn: items.map((item) => item.id) },
            },
    });

    for (const item of items) {
      await seedCmsMenuItem({ p, menu, item });
    }
  }
}

/**
 * @param p - Prisma client
 */
export async function seedCmsContent(p: PrismaClient): Promise<void> {
  await seedCmsPages(p);
  await seedCmsMenus(p);
}
