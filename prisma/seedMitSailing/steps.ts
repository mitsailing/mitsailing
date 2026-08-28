import { staff } from '../../src/data/mit-sailing/aboutContent';
import {
  CLASS_CATEGORY_ROWS,
  classCategoryIdFromSeedKey,
  overrideClassCategorySeedId,
  resetClassCategorySeedKeyMap,
} from '../../src/data/mit-sailing/classCategoriesSeed';
import {
  FLEET_BOATS,
  SAILING_CLASSES,
} from '../../src/data/mit-sailing/classesFleetSeed';
import { DONATION_FUND_SEED_ROWS } from '../../src/data/mit-sailing/donationFundsSeed';
import {
  SAILING_RATING_RULES,
  SAILING_RATINGS,
} from '../../src/data/mit-sailing/sailingRatingsSeed';
import { SITE_ALERT_SEED_ROWS } from '../../src/data/mit-sailing/siteAlertsSeed';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';
export { seedCmsContent } from './cmsSteps';
export {
  seedEventCategories,
  seedEventRelatedRows,
  seedEvents,
  seedSailingClassRelatedEventsFromSeed,
  seedStubUsers,
} from './eventSteps';

/**
 * Idempotent: upserts categories and reconciles slug collisions so `classCategoryIdFromSeedKey` matches the database.
 *
 * @param p - Prisma client
 */
export async function seedClassCategories(p: PrismaClient): Promise<void> {
  resetClassCategorySeedKeyMap();
  const now = new Date();
  for (const row of CLASS_CATEGORY_ROWS) {
    const existingBySlug = await p.classCategory.findUnique({
      where: { slug: row.slug },
      select: { id: true },
    });
    if (existingBySlug && existingBySlug.id !== row.id) {
      overrideClassCategorySeedId(row.seedKey, existingBySlug.id);
      await p.classCategory.update({
        where: { slug: row.slug },
        data: {
          name: row.name,
          displayOrder: row.displayOrder,
          isVisible: true,
        },
      });
      continue;
    }

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
        isVisible: cl.isVisible ?? true,
      },
      update: {
        name: cl.name,
        classCategoryId,
        level: cl.level,
        description: cl.description,
        displayOrder,
        isVisible: cl.isVisible ?? true,
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

  const boatIds = FLEET_BOATS.map((boat) => boat.id);
  await p.sailingClassUnlockedBoat.deleteMany({
    where: {
      fleetBoat: {
        id: { notIn: boatIds },
      },
    },
  });
  await p.sailingRatingRule.deleteMany({
    where: {
      boatId: { notIn: boatIds },
    },
  });
  await p.fleetBoat.deleteMany({
    where: {
      id: { notIn: boatIds },
    },
  });

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

function sailingRatingRuleTargetData(
  rule: (typeof SAILING_RATING_RULES)[number]
) {
  return {
    boatId: rule.targetType === 'boat' ? rule.targetId : null,
    classId: rule.targetType === 'class' ? rule.targetId : null,
    ratingId: rule.targetType === 'rating' ? rule.targetId : null,
  };
}

async function removeStaleSailingRatingRows(
  p: PrismaClient,
  props: {
    readonly ratingIds: string[];
    readonly ruleIds: string[];
  }
): Promise<void> {
  await p.sailingRatingRule.deleteMany({
    where: { id: { notIn: props.ruleIds } },
  });
  await p.userSailingRating.deleteMany({
    where: { sailingRatingId: { notIn: props.ratingIds } },
  });
  await p.sailingRating.deleteMany({
    where: { id: { notIn: props.ratingIds } },
  });
}

async function seedSailingRatingRows(
  p: PrismaClient,
  createdAt: Date
): Promise<void> {
  for (const rating of SAILING_RATINGS) {
    await p.sailingRating.upsert({
      where: { id: rating.id },
      create: {
        ...rating,
        createdAt,
      },
      update: {
        slug: rating.slug,
        name: rating.name,
        shortName: rating.shortName,
        description: rating.description,
        category: rating.category,
        level: rating.level,
        windCondition: rating.windCondition,
        guideUrl: rating.guideUrl,
        displayOrder: rating.displayOrder,
        isVisible: rating.isVisible,
        isDeprecated: rating.isDeprecated,
      },
    });
  }
}

async function seedSailingRatingRuleRows(p: PrismaClient): Promise<void> {
  for (const rule of SAILING_RATING_RULES) {
    const target = sailingRatingRuleTargetData(rule);
    const data = {
      ...target,
      ruleType: rule.ruleType,
      sailingRatingId: rule.sailingRatingId,
      groupKey: rule.groupKey,
      displayOrder: rule.displayOrder,
    };
    await p.sailingRatingRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        ...data,
      },
      update: data,
    });
  }
}

/**
 * @param p - Prisma client
 */
export async function seedSailingRatings(p: PrismaClient): Promise<void> {
  const ratingIds = SAILING_RATINGS.map((rating) => rating.id);
  const ruleIds = SAILING_RATING_RULES.map((rule) => rule.id);

  await removeStaleSailingRatingRows(p, { ratingIds, ruleIds });
  await seedSailingRatingRows(p, new Date());
  await seedSailingRatingRuleRows(p);
}

function seedTextOrNull(value: string | undefined): string | null {
  return value ?? null;
}

function staffMemberSeedData(s: (typeof staff)[number]) {
  return {
    slug: s.slug,
    name: s.name,
    role: s.role,
    bio: seedTextOrNull(s.bio),
    fullBio: structuredClone(s.fullBio) as Prisma.InputJsonValue,
    imageSrc: seedTextOrNull(s.imageSrc),
    imageAlt: seedTextOrNull(s.imageAlt),
    email: s.email,
  };
}

/**
 * @param p - Prisma client
 */
export async function seedStaff(p: PrismaClient): Promise<void> {
  for (const s of staff) {
    const data = staffMemberSeedData(s);
    await p.staffMember.upsert({
      where: { slug: s.slug },
      create: {
        id: s.slug,
        ...data,
      },
      update: data,
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
