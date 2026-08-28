import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  personaPriceCentsFromForm,
  pavilionSpaceFormSchema,
  rawPavilionSpaceFromFormData,
} from '@/libs/admin/catalog/pavilionSpacesSchemas';
import type {
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogReorderScope,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPersonas';
import { formatPavilionReservationMoney } from '@/libs/mit-sailing/pavilionReservationPricing';

function mapPrismaErr(e: unknown): CatalogMutationErr | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { ok: false, code: 'duplicate_slug' };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    return { ok: false, code: 'foreign_key' };
  }
  return null;
}

function dollarsFromCents(amountCents: number | null): string {
  if (amountCents === null) {
    return '';
  }
  return String(amountCents / 100);
}

function priceHintFromCents(amountCents: number | null): string {
  if (amountCents === null) {
    return 'Price on request';
  }
  return formatPavilionReservationMoney(amountCents);
}

type ItemWithPricesAndMedia = {
  id: string;
  slug: string;
  kind: 'space' | 'service';
  name: string;
  description: string;
  imageUrl: string | null;
  pricingType: 'hourly' | 'flat';
  minDurationHours: number | null;
  publicGroup: 'venue' | 'event_options' | 'programs' | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  prices: {
    persona: (typeof PAVILION_RESERVATION_PERSONAS)[number];
    amountCents: number | null;
  }[];
  media: {
    displayOrder: number;
    mediaAsset: { publicPath: string };
  }[];
};

function priceMapFromRows(
  prices: ItemWithPricesAndMedia['prices']
): Record<(typeof PAVILION_RESERVATION_PERSONAS)[number], number | null> {
  const map = {
    mit_academic: null as number | null,
    mit_student: null as number | null,
    mit_community: null as number | null,
    non_mit: null as number | null,
  };
  for (const price of prices) {
    map[price.persona] = price.amountCents;
  }
  return map;
}

function rowFromDb(row: ItemWithPricesAndMedia): CatalogRow {
  const prices = priceMapFromRows(row.prices);
  const imagePaths = row.media
    .toSorted((a, b) => a.displayOrder - b.displayOrder)
    .map((entry) => entry.mediaAsset.publicPath);
  if (imagePaths.length === 0 && row.imageUrl) {
    imagePaths.push(row.imageUrl);
  }
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    description: row.description,
    pricingType: row.pricingType,
    minDurationHours: row.minDurationHours,
    publicGroup: row.publicGroup,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    imagePaths,
    publicSpaceUrl:
      row.kind === 'space' && row.isVisible ? `/spaces/${row.slug}` : null,
    priceMitAcademic: dollarsFromCents(prices.mit_academic),
    priceMitStudent: dollarsFromCents(prices.mit_student),
    priceMitCommunity: dollarsFromCents(prices.mit_community),
    priceNonMit: dollarsFromCents(prices.non_mit),
    priceHint: priceHintFromCents(prices.mit_academic),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const itemSelect = {
  id: true,
  slug: true,
  kind: true,
  name: true,
  description: true,
  imageUrl: true,
  pricingType: true,
  minDurationHours: true,
  publicGroup: true,
  displayOrder: true,
  isVisible: true,
  createdAt: true,
  updatedAt: true,
  prices: {
    select: { persona: true, amountCents: true },
  },
  media: {
    orderBy: { displayOrder: 'asc' as const },
    select: {
      displayOrder: true,
      mediaAsset: { select: { publicPath: true } },
    },
  },
} satisfies Prisma.PavilionReservableItemSelect;

async function syncMediaAndImageUrl(props: {
  imagePaths: readonly string[];
  itemId: string;
  tx: Prisma.TransactionClient;
}): Promise<void> {
  await props.tx.pavilionReservableItemMedia.deleteMany({
    where: { itemId: props.itemId },
  });

  let order = 0;
  for (const publicPath of props.imagePaths) {
    const asset = await props.tx.cmsMediaAsset.findFirst({
      where: { publicPath },
      select: { id: true },
    });
    if (asset) {
      await props.tx.pavilionReservableItemMedia.create({
        data: {
          id: randomUUID(),
          itemId: props.itemId,
          mediaAssetId: asset.id,
          displayOrder: order,
        },
      });
    }
    order += 1;
  }

  const firstImagePath =
    props.imagePaths.find((path) => /\.(?:gif|jpe?g|png|webp)$/iu.test(path)) ??
    null;

  await props.tx.pavilionReservableItem.update({
    where: { id: props.itemId },
    data: { imageUrl: firstImagePath },
  });
}

async function upsertPersonaPrices(props: {
  itemId: string;
  prices: Record<(typeof PAVILION_RESERVATION_PERSONAS)[number], number | null>;
  tx: Prisma.TransactionClient;
}): Promise<void> {
  for (const persona of PAVILION_RESERVATION_PERSONAS) {
    await props.tx.pavilionReservableItemPrice.upsert({
      where: { itemId_persona: { itemId: props.itemId, persona } },
      create: {
        id: randomUUID(),
        itemId: props.itemId,
        persona,
        amountCents: props.prices[persona],
      },
      update: { amountCents: props.prices[persona] },
    });
  }
}

/**
 * Prisma-backed handlers for pavilion spaces/services catalog admin.
 */
export const pavilionSpacesCatalogHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.pavilionReservableItem.findMany({
      orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      select: itemSelect,
    });
    return rows.map(rowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.pavilionReservableItem.findUnique({
      where: { id },
      select: itemSelect,
    });
    return row ? rowFromDb(row) : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const prices = personaPriceCentsFromForm(data);
    const newId = randomUUID();
    try {
      await prisma.$transaction(async (tx) => {
        const agg = await tx.pavilionReservableItem.aggregate({
          _max: { displayOrder: true },
        });
        const nextOrder = (agg._max.displayOrder ?? -1) + 1;
        await tx.pavilionReservableItem.create({
          data: {
            id: newId,
            slug: data.slug,
            kind: data.kind,
            name: data.name,
            description: data.description,
            pricingType: data.pricingType,
            minDurationHours:
              data.pricingType === 'hourly'
                ? (data.minDurationHours ?? 1)
                : null,
            publicGroup: data.kind === 'space' ? data.publicGroup : null,
            displayOrder: nextOrder,
            isVisible: data.isVisible,
            imageUrl:
              data.imagePaths.find((path) =>
                /\.(?:gif|jpe?g|png|webp)$/iu.test(path)
              ) ?? null,
          },
        });
        await upsertPersonaPrices({ itemId: newId, prices, tx });
        await syncMediaAndImageUrl({
          imagePaths: data.imagePaths,
          itemId: newId,
          tx,
        });
      });
      return { ok: true, id: newId };
    } catch (error: unknown) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { data } = parsed;
    const prices = personaPriceCentsFromForm(data);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.pavilionReservableItem.update({
          where: { id },
          data: {
            slug: data.slug,
            kind: data.kind,
            name: data.name,
            description: data.description,
            pricingType: data.pricingType,
            minDurationHours:
              data.pricingType === 'hourly'
                ? (data.minDurationHours ?? 1)
                : null,
            publicGroup: data.kind === 'space' ? data.publicGroup : null,
            isVisible: data.isVisible,
            imageUrl:
              data.imagePaths.find((path) =>
                /\.(?:gif|jpe?g|png|webp)$/iu.test(path)
              ) ?? null,
          },
        });
        await upsertPersonaPrices({ itemId: id, prices, tx });
        await syncMediaAndImageUrl({
          imagePaths: data.imagePaths,
          itemId: id,
          tx,
        });
      });
      return { ok: true };
    } catch (error: unknown) {
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    try {
      await prisma.pavilionReservableItem.delete({ where: { id } });
      return { ok: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { ok: false, code: 'not_found' };
      }
      const mapped = mapPrismaErr(error);
      if (mapped) {
        return mapped;
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async reorder(
    orderedIds: readonly string[],
    _scope?: CatalogReorderScope
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const existing = await prisma.pavilionReservableItem.findMany({
      select: { id: true },
    });
    const set = new Set(existing.map((row) => row.id));
    if (
      orderedIds.length !== set.size ||
      orderedIds.some((rowId) => !set.has(rowId))
    ) {
      return { ok: false, code: 'invalid_order' };
    }
    try {
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < orderedIds.length; index += 1) {
          await tx.pavilionReservableItem.update({
            where: { id: orderedIds[index] },
            data: { displayOrder: index },
          });
        }
      });
      return { ok: true };
    } catch {
      return { ok: false, code: 'unknown' };
    }
  },
};
