import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deletePublicSlugHistoryForTarget: vi.fn(),
  fleetBoatDelete: vi.fn(),
  fleetBoatUpdate: vi.fn(),
  fleetUserAuditCreate: vi.fn(),
  fleetUserAuditFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
  recordCatalogRevision: vi.fn(),
  recordCatalogRevisionFromSnapshot: vi.fn(),
  recordCatalogRevisionIfChanged: vi.fn(),
  recordPublicSlugHistory: vi.fn(),
  requiredFleetBoatCount: vi.fn(),
  sailingClassDelete: vi.fn(),
  sailingClassFindMany: vi.fn(),
  sailingClassUpdate: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.prismaTransaction,
    fleetBoat: {
      findMany: vi.fn(),
    },
    sailingClass: {
      findMany: mocks.sailingClassFindMany,
    },
  },
}));

vi.mock('@/libs/mit-sailing/catalogHistory', () => ({
  loadCatalogRevisionSnapshot: vi.fn(
    async (props: { resourceId: 'fleet' | 'sailing_classes' }) => {
      await Promise.resolve();
      if (props.resourceId === 'fleet') {
        return {
          id: 'boat-1',
          name: 'Tech Dinghy',
          resource: 'fleet',
          slug: 'old-boat',
        };
      }
      return {
        id: 'class-1',
        name: 'Intro sailing',
        resource: 'sailing_classes',
        slug: 'old-class',
      };
    }
  ),
  recordCatalogRevision: mocks.recordCatalogRevision,
  recordCatalogRevisionFromSnapshot: mocks.recordCatalogRevisionFromSnapshot,
  recordCatalogRevisionIfChanged: mocks.recordCatalogRevisionIfChanged,
}));

vi.mock('@/libs/mit-sailing/publicSlugHistory', () => ({
  deletePublicSlugHistoryForTarget: mocks.deletePublicSlugHistoryForTarget,
  recordPublicSlugHistory: mocks.recordPublicSlugHistory,
}));

const { fleetCatalogHandlers } =
  await import('@/libs/admin/catalog/fleetCatalogHandlers');
const { sailingClassesCatalogHandlers } =
  await import('@/libs/admin/catalog/sailingClassesHandlers');

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  mocks.prismaTransaction.mockImplementation(
    async (transactionBody: (tx: unknown) => Promise<unknown>) => {
      await Promise.resolve();
      const tx = {
        fleetBoat: {
          count: mocks.requiredFleetBoatCount,
          delete: mocks.fleetBoatDelete,
          update: mocks.fleetBoatUpdate,
        },
        sailingClass: {
          delete: mocks.sailingClassDelete,
          update: mocks.sailingClassUpdate,
        },
        userAudit: {
          create: mocks.fleetUserAuditCreate,
          findFirst: mocks.fleetUserAuditFindFirst,
        },
      };
      return transactionBody(tx);
    }
  );
  mocks.fleetBoatDelete.mockResolvedValue({ id: 'boat-1' });
  mocks.fleetBoatUpdate.mockResolvedValue({ id: 'boat-1' });
  mocks.recordCatalogRevisionFromSnapshot.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.recordCatalogRevisionIfChanged.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.recordPublicSlugHistory.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.deletePublicSlugHistoryForTarget.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.requiredFleetBoatCount.mockResolvedValue(0);
  mocks.sailingClassDelete.mockResolvedValue({ id: 'class-1' });
  mocks.sailingClassUpdate.mockResolvedValue({ id: 'class-1' });
});

function sailingClassFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'Intro sailing');
  formData.set('slug', 'new-class');
  formData.set('classCategoryId', 'category-1');
  formData.set('level', 'Beginner');
  formData.set('description', 'Learn to sail.');
  formData.set('imagePaths', '/classes/intro.jpg');
  formData.set('isVisible', 'true');
  return formData;
}

function fleetBoatFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'Tech Dinghy');
  formData.set('slug', 'new-boat');
  formData.set('type', 'dinghy');
  formData.set('capacity', '2');
  formData.set('requiredClassId', 'class-1');
  formData.set('description', 'A boat.');
  formData.set('imagePath', '/fleet/boat.jpg');
  return formData;
}

describe('sailingClassesCatalogHandlers', () => {
  it('records public slug history when class slug changes', async () => {
    await expect(
      sailingClassesCatalogHandlers.updateFromForm(
        'class-1',
        sailingClassFormData()
      )
    ).resolves.toEqual({ ok: true });

    expect(mocks.recordPublicSlugHistory).toHaveBeenCalledWith({
      currentSlug: 'new-class',
      db: expect.anything(),
      previousSlug: 'old-class',
      scope: 'classes',
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });
  });

  it('deletes public slug history when deleting a class', async () => {
    await expect(
      sailingClassesCatalogHandlers.delete('class-1')
    ).resolves.toEqual({
      ok: true,
    });

    expect(mocks.deletePublicSlugHistoryForTarget).toHaveBeenCalledWith({
      db: expect.anything(),
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });
  });
});

describe('fleetCatalogHandlers', () => {
  it('records public slug history when boat slug changes', async () => {
    await expect(
      fleetCatalogHandlers.updateFromForm('boat-1', fleetBoatFormData())
    ).resolves.toEqual({ ok: true });

    expect(mocks.recordPublicSlugHistory).toHaveBeenCalledWith({
      currentSlug: 'new-boat',
      db: expect.anything(),
      previousSlug: 'old-boat',
      scope: 'fleet',
      sluggableId: 'boat-1',
      sluggableType: 'FleetBoat',
    });
  });

  it('deletes public slug history when deleting a boat', async () => {
    await expect(fleetCatalogHandlers.delete('boat-1')).resolves.toEqual({
      ok: true,
    });

    expect(mocks.deletePublicSlugHistoryForTarget).toHaveBeenCalledWith({
      db: expect.anything(),
      sluggableId: 'boat-1',
      sluggableType: 'FleetBoat',
    });
  });
});
