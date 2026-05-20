import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  fleetBoatFindUnique: vi.fn(),
  fleetBoatUpdate: vi.fn(),
  sailingClassFindUnique: vi.fn(),
  sailingClassUpdate: vi.fn(),
  userAuditCreate: vi.fn(),
  userAuditFindFirst: vi.fn(),
  userAuditFindMany: vi.fn(),
  prismaTransaction: vi.fn(),
  recordPublicSlugHistory: vi.fn(),
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

vi.mock('@/libs/mit-sailing/publicSlugHistory', () => ({
  recordPublicSlugHistory: mocks.recordPublicSlugHistory,
}));

const {
  getAdminCatalogRevisionCompare,
  listAdminCatalogRevisions,
  recordCatalogRevision,
  recordCatalogRevisionIfChanged,
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
  mocks.recordPublicSlugHistory.mockReset();
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
    name: props?.name ?? 'Tech dinghy',
    requiredClassId: 'class-1',
    requiredClassName: 'Intro Sailing 101',
    resource: 'fleet',
    slug: 'tech-dinghy',
    type: 'Dinghy',
  } satisfies Prisma.InputJsonObject;
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
          title: 'Tech dinghy',
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
          title: 'Tech dinghy',
        },
        summary: { kind: 'created' },
        version: 1,
      },
    ]);
  });

  it('summarizes oldest update revision against empty baseline when no prior audit', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        action: 'update',
        auditedChanges: fleetSnapshot({ capacity: 4 }),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-1',
        user: null,
        version: 2,
      },
      {
        action: 'update',
        auditedChanges: fleetSnapshot({ capacity: 2 }),
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
        id: 'audit-0',
        user: null,
        version: 1,
      },
    ]);

    const rows = await listAdminCatalogRevisions({
      itemId: 'boat-1',
      resourceId: 'fleet',
    });

    expect(rows).toHaveLength(2);
    const [, oldest] = rows;
    if (oldest === undefined) {
      throw new Error('expected second row');
    }
    expect(oldest.version).toBe(1);
    const oldestSummary = oldest.summary;
    expect(oldestSummary.kind).toBe('changes');
    if (oldestSummary.kind === 'changes') {
      expect(oldestSummary.changes.length).toBeGreaterThan(0);
    }
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

  it('detects fleet required class change when ids differ but names match', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'update',
        auditedChanges: {
          ...fleetSnapshot(),
          requiredClassId: 'class-2',
        },
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-2',
        user: null,
        version: 2,
      })
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot(),
        version: 1,
      });

    const compare = await getAdminCatalogRevisionCompare({
      itemId: 'boat-1',
      resourceId: 'fleet',
      revisionId: 'audit-2',
    });

    expect(compare?.comparison.changes).toContainEqual({
      after: { kind: 'text', value: 'Intro Sailing 101' },
      before: { kind: 'text', value: 'Intro Sailing 101' },
      field: 'requiredClassId',
    });
  });

  it('ignores fleet required class drift when only the denormalized name changed', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'update',
        auditedChanges: {
          ...fleetSnapshot(),
          requiredClassName: 'Intro Sailing 101 (renamed)',
        },
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-2',
        user: null,
        version: 2,
      })
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot(),
        version: 1,
      });

    const compare = await getAdminCatalogRevisionCompare({
      itemId: 'boat-1',
      resourceId: 'fleet',
      revisionId: 'audit-2',
    });

    expect(compare?.comparison.changes.map((c) => c.field)).not.toContain(
      'requiredClassId'
    );
  });

  it('detects sailing class category change when ids differ but names match', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'update',
        auditedChanges: {
          ...sailingClassSnapshot(),
          classCategoryId: 'cc-other',
        },
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-2',
        user: null,
        version: 2,
      })
      .mockResolvedValueOnce({
        auditedChanges: sailingClassSnapshot(),
        version: 1,
      });

    const compare = await getAdminCatalogRevisionCompare({
      itemId: 'class-1',
      resourceId: 'sailing_classes',
      revisionId: 'audit-2',
    });

    expect(compare?.comparison.changes).toContainEqual({
      after: { kind: 'text', value: 'Introduction' },
      before: { kind: 'text', value: 'Introduction' },
      field: 'classCategoryId',
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

describe('recordCatalogRevisionIfChanged', () => {
  it('skips audit row when previousSnapshot is null but row matches latest audit', async () => {
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });
    mocks.userAuditFindFirst.mockResolvedValue({
      auditedChanges: fleetSnapshot(),
      version: 1,
    });
    const tx = {
      fleetBoat: { findUnique: mocks.fleetBoatFindUnique },
      sailingClass: { findUnique: mocks.sailingClassFindUnique },
      userAudit: {
        create: mocks.userAuditCreate,
        findFirst: mocks.userAuditFindFirst,
      },
    };

    await recordCatalogRevisionIfChanged({
      action: 'update',
      itemId: 'boat-1',
      previousSnapshot: null,
      resourceId: 'fleet',
      tx,
    });

    expect(mocks.userAuditCreate).not.toHaveBeenCalled();
  });

  it('skips audit row when previousSnapshot matches row after update', async () => {
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });
    const tx = {
      fleetBoat: { findUnique: mocks.fleetBoatFindUnique },
      sailingClass: { findUnique: mocks.sailingClassFindUnique },
      userAudit: {
        create: mocks.userAuditCreate,
        findFirst: mocks.userAuditFindFirst,
      },
    };

    await recordCatalogRevisionIfChanged({
      action: 'update',
      itemId: 'boat-1',
      previousSnapshot: fleetSnapshot(),
      resourceId: 'fleet',
      tx,
    });

    expect(mocks.userAuditCreate).not.toHaveBeenCalled();
    expect(mocks.userAuditFindFirst).not.toHaveBeenCalled();
  });

  it('writes audit when previousSnapshot is null and no prior audit exists', async () => {
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

    await recordCatalogRevisionIfChanged({
      action: 'update',
      itemId: 'boat-1',
      previousSnapshot: null,
      resourceId: 'fleet',
      tx,
    });

    expect(mocks.userAuditCreate).toHaveBeenCalledTimes(1);
  });

  it('loads snapshot and compares in one transaction when tx omitted', async () => {
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });
    mocks.userAuditFindFirst.mockResolvedValue({
      auditedChanges: fleetSnapshot(),
      version: 1,
    });

    await recordCatalogRevisionIfChanged({
      action: 'update',
      itemId: 'boat-1',
      previousSnapshot: null,
      resourceId: 'fleet',
    });

    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.userAuditCreate).not.toHaveBeenCalled();
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

  it('loads snapshot and writes audit in one serializable transaction when tx omitted', async () => {
    mocks.fleetBoatFindUnique.mockResolvedValue({
      ...fleetSnapshot(),
      requiredClass: { name: 'Intro Sailing 101' },
      requiredClassId: 'class-1',
    });
    mocks.userAuditFindFirst.mockResolvedValue(null);
    mocks.userAuditCreate.mockResolvedValue({ id: 'audit-1' });

    await recordCatalogRevision({
      action: 'create',
      itemId: 'boat-1',
      resourceId: 'fleet',
    });

    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.fleetBoatFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userAuditCreate).toHaveBeenCalledTimes(1);
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
        name: 'Tech dinghy',
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

  it('records fleet slug history when restoring to an old slug', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot({ name: 'Restored boat' }),
      })
      .mockResolvedValueOnce({
        auditedChanges: fleetSnapshot({ name: 'Restored boat' }),
        version: 2,
      });
    mocks.fleetBoatFindUnique
      .mockResolvedValueOnce({
        ...fleetSnapshot({ name: 'Current boat' }),
        requiredClass: { name: 'Intro Sailing 101' },
        requiredClassId: 'class-1',
        slug: 'current-boat',
      })
      .mockResolvedValueOnce({
        ...fleetSnapshot({ name: 'Restored boat' }),
        requiredClass: { name: 'Intro Sailing 101' },
        requiredClassId: 'class-1',
      });
    mocks.fleetBoatUpdate.mockResolvedValue({ id: 'boat-1' });

    await expect(
      restoreCatalogRevision({
        itemId: 'boat-1',
        resourceId: 'fleet',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: true, slug: 'tech-dinghy' });

    expect(mocks.recordPublicSlugHistory).toHaveBeenCalledWith({
      currentSlug: 'tech-dinghy',
      db: expect.any(Object),
      previousSlug: 'current-boat',
      scope: 'fleet',
      sluggableId: 'boat-1',
      sluggableType: 'FleetBoat',
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

  it('records class slug history when restoring to an old slug', async () => {
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        auditedChanges: sailingClassSnapshot({ name: 'Restored class' }),
      })
      .mockResolvedValueOnce({
        auditedChanges: sailingClassSnapshot({ name: 'Restored class' }),
        version: 2,
      });
    mocks.sailingClassFindUnique
      .mockResolvedValueOnce({
        ...sailingClassSnapshot({ name: 'Current class' }),
        classCategory: { name: 'Introduction' },
        classCategoryId: 'cc-introduction',
        slug: 'current-class',
      })
      .mockResolvedValueOnce({
        ...sailingClassSnapshot({ name: 'Restored class' }),
        classCategory: { name: 'Introduction' },
        classCategoryId: 'cc-introduction',
      });
    mocks.sailingClassUpdate.mockResolvedValue({ id: 'class-1' });

    await expect(
      restoreCatalogRevision({
        itemId: 'class-1',
        resourceId: 'sailing_classes',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: true, slug: 'intro-sailing-101' });

    expect(mocks.recordPublicSlugHistory).toHaveBeenCalledWith({
      currentSlug: 'intro-sailing-101',
      db: expect.any(Object),
      previousSlug: 'current-class',
      scope: 'classes',
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });
  });

  it('maps prisma P2025 during restore transaction to not_found', async () => {
    mocks.userAuditFindFirst.mockResolvedValueOnce({
      auditedChanges: fleetSnapshot(),
    });
    mocks.prismaTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
        clientVersion: 'test',
        code: 'P2025',
      })
    );

    await expect(
      restoreCatalogRevision({
        itemId: 'boat-1',
        resourceId: 'fleet',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: false, code: 'not_found' });
  });
});
