import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fleetBoatFindUnique: vi.fn(),
  fleetBoatUpdate: vi.fn(),
  sailingClassFindUnique: vi.fn(),
  sailingClassUpdate: vi.fn(),
  userAuditCreate: vi.fn(),
  userAuditFindFirst: vi.fn(),
  userAuditFindMany: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    fleetBoat: {
      findUnique: mocks.fleetBoatFindUnique,
      update: mocks.fleetBoatUpdate,
    },
    sailingClass: {
      findUnique: mocks.sailingClassFindUnique,
      update: mocks.sailingClassUpdate,
    },
    userAudit: {
      create: mocks.userAuditCreate,
      findFirst: mocks.userAuditFindFirst,
      findMany: mocks.userAuditFindMany,
    },
    $transaction: mocks.prismaTransaction,
  },
}));

const {
  getAdminCatalogRevisionCompare,
  listAdminCatalogRevisions,
  recordCatalogRevision,
  restoreCatalogRevision,
} = await import('@/libs/mit-sailing/catalogHistory');

beforeEach(() => {
  mocks.fleetBoatFindUnique.mockReset();
  mocks.fleetBoatUpdate.mockReset();
  mocks.sailingClassFindUnique.mockReset();
  mocks.sailingClassUpdate.mockReset();
  mocks.userAuditCreate.mockReset();
  mocks.userAuditFindFirst.mockReset();
  mocks.userAuditFindMany.mockReset();
  mocks.prismaTransaction.mockReset();
  mocks.prismaTransaction.mockImplementation(
    async (transactionBody: (tx: unknown) => Promise<unknown>) => {
      const result = await transactionBody({
        fleetBoat: {
          findUnique: mocks.fleetBoatFindUnique,
          update: mocks.fleetBoatUpdate,
        },
        sailingClass: {
          findUnique: mocks.sailingClassFindUnique,
          update: mocks.sailingClassUpdate,
        },
        userAudit: {
          create: mocks.userAuditCreate,
          findFirst: mocks.userAuditFindFirst,
        },
      });
      return result;
    }
  );
});

function fleetSnapshot(props?: { capacity?: number; name?: string }) {
  return {
    capacity: props?.capacity ?? 2,
    description: '<p>Fast boat</p>',
    id: 'boat-1',
    imagePath: '/fleet.png',
    name: props?.name ?? 'Tech Dinghy',
    requiredClassId: 'class-1',
    requiredClassName: 'Intro Sailing 101',
    resource: 'fleet',
    slug: 'tech-dinghy',
    type: 'Dinghy',
  };
}

function sailingClassSnapshot(props?: { name?: string }) {
  return {
    classCategoryId: 'cc-introduction',
    classCategoryName: 'Introduction',
    description: '<p>Learn basics</p>',
    id: 'class-1',
    imagePaths: ['/class.png'],
    isVisible: true,
    level: 'beginner',
    name: props?.name ?? 'Intro Sailing 101',
    resource: 'sailing_classes',
    slug: 'intro-sailing-101',
  };
}

describe('listAdminCatalogRevisions', () => {
  it('maps user audit rows to catalog revision summaries', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        action: 'update',
        auditedChanges: fleetSnapshot({ capacity: 4 }),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-1',
        user: { email: 'admin@example.com', name: 'Admin Sailor' },
        version: 2,
      },
      {
        action: 'create',
        auditedChanges: fleetSnapshot(),
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
        id: 'audit-0',
        user: null,
        version: 1,
      },
    ]);

    await expect(
      listAdminCatalogRevisions({ itemId: 'boat-1', resourceId: 'fleet' })
    ).resolves.toEqual([
      {
        action: 'update',
        createdAt: '2026-05-10T12:00:00.000Z',
        editorEmail: 'admin@example.com',
        editorName: 'Admin Sailor',
        id: 'audit-1',
        preview: {
          excerpt: 'Fast boat',
          subtitle: 'Intro Sailing 101',
          title: 'Tech Dinghy',
        },
        summary: {
          changes: [{ field: 'capacity' }],
          kind: 'changes',
          remainingCount: 0,
        },
        version: 2,
      },
      {
        action: 'create',
        createdAt: '2026-05-10T11:00:00.000Z',
        editorEmail: undefined,
        editorName: undefined,
        id: 'audit-0',
        preview: {
          excerpt: 'Fast boat',
          subtitle: 'Intro Sailing 101',
          title: 'Tech Dinghy',
        },
        summary: { kind: 'created' },
        version: 1,
      },
    ]);
  });
});

describe('getAdminCatalogRevisionCompare', () => {
  it('compares a fleet audit with the previous version', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'update',
        auditedChanges: fleetSnapshot({ capacity: 4 }),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-2',
        user: null,
        version: 2,
      })
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot({ capacity: 2 }),
        version: 1,
      });

    const compare = await getAdminCatalogRevisionCompare({
      itemId: 'boat-1',
      resourceId: 'fleet',
      revisionId: 'audit-2',
    });

    expect(compare?.comparison.changes).toContainEqual({
      after: { kind: 'number', value: 4 },
      before: { kind: 'number', value: 2 },
      field: 'capacity',
    });
  });

  it('diffs the first revision against empty snapshot not live row', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'create',
        auditedChanges: fleetSnapshot({ capacity: 2 }),
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
        id: 'audit-1',
        user: null,
        version: 1,
      })
      .mockResolvedValueOnce(null);

    const compare = await getAdminCatalogRevisionCompare({
      itemId: 'boat-1',
      resourceId: 'fleet',
      revisionId: 'audit-1',
    });

    expect(mocks.fleetBoatFindUnique).not.toHaveBeenCalled();
    expect(compare?.comparison.changes).toContainEqual({
      after: { kind: 'number', value: 2 },
      before: { kind: 'number', value: 0 },
      field: 'capacity',
    });
  });
});

describe('recordCatalogRevision', () => {
  it('uses the provided transaction client', async () => {
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });
    mocks.userAuditFindFirst.mockResolvedValue(null);
    mocks.userAuditCreate.mockResolvedValue({ id: 'audit-1' });
    const tx = {
      fleetBoat: { findUnique: mocks.fleetBoatFindUnique },
      sailingClass: { findUnique: mocks.sailingClassFindUnique },
      userAudit: {
        create: mocks.userAuditCreate,
        findFirst: mocks.userAuditFindFirst,
      },
    };

    await recordCatalogRevision({
      action: 'create',
      itemId: 'boat-1',
      resourceId: 'fleet',
      tx,
    });

    expect(mocks.prismaTransaction).not.toHaveBeenCalled();
    expect(mocks.fleetBoatFindUnique).toHaveBeenCalledWith({
      select: expect.objectContaining({ imagePath: true, name: true }),
      where: { id: 'boat-1' },
    });
    expect(mocks.userAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'create',
        auditableId: 'boat-1',
        auditableType: 'fleet',
        version: 1,
      }),
    });
  });
});

describe('restoreCatalogRevision', () => {
  it('restores fleet image path and records a restore audit', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        auditedChanges: {
          ...fleetSnapshot(),
          requiredClassName: 'stale denormalized label',
        },
      })
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot(),
        version: 2,
      });
    mocks.fleetBoatUpdate.mockResolvedValue({ id: 'boat-1' });
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });

    await expect(
      restoreCatalogRevision({
        context: { userId: 'admin-1' },
        itemId: 'boat-1',
        resourceId: 'fleet',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: true, slug: 'tech-dinghy' });

    expect(mocks.fleetBoatUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imagePath: '/fleet.png',
        name: 'Tech Dinghy',
        slug: 'tech-dinghy',
      }),
      where: { id: 'boat-1' },
    });
    expect(mocks.userAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'restore',
        auditableId: 'boat-1',
        auditableType: 'fleet',
        auditedChanges: expect.objectContaining({
          requiredClassName: 'Intro Sailing 101',
        }),
        userId: 'admin-1',
        version: 3,
      }),
    });
  });

  it('restores class form fields and records a restore audit', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        auditedChanges: {
          ...sailingClassSnapshot(),
          classCategoryName: 'stale denormalized label',
        },
      })
      .mockResolvedValueOnce({
        auditedChanges: sailingClassSnapshot(),
        version: 2,
      });
    mocks.sailingClassUpdate.mockResolvedValue({ id: 'class-1' });
    mocks.sailingClassFindUnique.mockResolvedValue({
      ...sailingClassSnapshot(),
      classCategory: { name: 'Introduction' },
      classCategoryId: 'cc-introduction',
    });

    await expect(
      restoreCatalogRevision({
        context: {
          userId: 'admin-1',
          impersonatedUserId: 'sailor-1',
        },
        itemId: 'class-1',
        resourceId: 'sailing_classes',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: true, slug: 'intro-sailing-101' });

    expect(mocks.sailingClassUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        classCategoryId: 'cc-introduction',
        name: 'Intro Sailing 101',
        slug: 'intro-sailing-101',
      }),
      where: { id: 'class-1' },
    });
    expect(mocks.userAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'restore',
        auditableId: 'class-1',
        auditableType: 'sailing_classes',
        auditedChanges: expect.objectContaining({
          classCategoryName: 'Introduction',
        }),
        impersonatedUserId: 'sailor-1',
        userId: 'admin-1',
        version: 3,
      }),
    });
  });
});
