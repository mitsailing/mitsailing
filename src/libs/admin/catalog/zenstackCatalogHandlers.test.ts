import { ORMError, ORMErrorReason } from '@zenstackhq/orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';

vi.mock('server-only', () => ({}));

type TransactionClientMock = {
  eventCategory: {
    update: (input: unknown) => unknown;
  };
};

const mocks = vi.hoisted(() => {
  const aggregate = vi.fn();
  const create = vi.fn();
  const deleteMock = vi.fn();
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn(
    async (run: (tx: TransactionClientMock) => unknown) => {
      await Promise.resolve();
      return run({ eventCategory: { update } });
    }
  );
  return {
    aggregate,
    create,
    delete: deleteMock,
    findMany,
    findUnique,
    transaction,
    update,
    zenstackForAuthContext: vi.fn((authContext: unknown) => ({
      $transaction: transaction,
      authContext,
      eventCategory: {
        aggregate,
        create,
        delete: deleteMock,
        findMany,
        findUnique,
        update,
      },
    })),
  };
});

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
}));

function eventCategoryFormData(props?: {
  isVisible?: 'true' | 'false';
  name?: string;
}) {
  const formData = new FormData();
  formData.set('name', props?.name ?? 'Regattas');
  formData.set('isVisible', props?.isVisible ?? 'true');
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } });
  mocks.create.mockResolvedValue({ id: 'cat-1' });
  mocks.delete.mockResolvedValue({ id: 'cat-1' });
  mocks.findMany.mockResolvedValue([
    {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      displayOrder: 1,
      id: 'cat-1',
      isVisible: true,
      name: 'Regattas',
    },
  ]);
  mocks.findUnique.mockResolvedValue({
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    displayOrder: 1,
    id: 'cat-1',
    isVisible: true,
    name: 'Regattas',
  });
  mocks.transaction.mockImplementation(
    async (run: (tx: TransactionClientMock) => unknown) => {
      await Promise.resolve();
      return run({ eventCategory: { update: mocks.update } });
    }
  );
  mocks.update.mockResolvedValue({ id: 'cat-1' });
});

describe('createZenStackCatalogHandlers', () => {
  it('creates event categories through ZenStack', async () => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(
      handlers.createFromForm(eventCategoryFormData(), {
        authContext: {
          appRole: Role.ADMIN,
          id: 'admin-1',
        },
      })
    ).resolves.toEqual({ ok: true, id: 'cat-1' });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdAt: expect.any(Date),
        displayOrder: 5,
        id: expect.any(String),
        isVisible: true,
        name: 'Regattas',
      }),
      select: { id: true },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        data: expect.objectContaining({ accentClassName: expect.anything() }),
      })
    );
  });

  it('forbids creates without auth context', async () => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(
      handlers.createFromForm(eventCategoryFormData())
    ).resolves.toEqual({ ok: false, code: 'forbidden' });

    expect(mocks.zenstackForAuthContext).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('lists event categories in display order', async () => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(handlers.list()).resolves.toEqual([
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        displayOrder: 1,
        id: 'cat-1',
        isVisible: true,
        name: 'Regattas',
      },
    ]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        createdAt: true,
        displayOrder: true,
        id: true,
        isVisible: true,
        name: true,
      },
    });
  });

  it('updates only event category form fields', async () => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');
    const formData = eventCategoryFormData();
    formData.set('accentClassName', 'bg-mit-red');
    formData.set('createdAt', '2020-01-01T00:00:00.000Z');
    formData.set('displayOrder', '99');
    formData.set('id', 'attacker-id');

    await expect(
      handlers.updateFromForm('cat-1', formData, {
        authContext: {
          appRole: Role.ADMIN,
          id: 'admin-1',
        },
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.update).toHaveBeenCalledWith({
      data: {
        isVisible: true,
        name: 'Regattas',
      },
      where: { id: 'cat-1' },
    });
  });

  it('rejects blank names before writing', async () => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(
      handlers.updateFromForm('cat-1', eventCategoryFormData({ name: '   ' }), {
        authContext: {
          appRole: Role.ADMIN,
          id: 'admin-1',
        },
      })
    ).resolves.toEqual({ ok: false, code: 'validation_failed' });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps reorder updates in one ZenStack transaction', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(handlers.reorder?.(['cat-2', 'cat-1'])).resolves.toEqual({
      ok: true,
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({
      data: { displayOrder: 0 },
      where: { id: 'cat-2' },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      data: { displayOrder: 1 },
      where: { id: 'cat-1' },
    });
  });

  it('reports reorder transaction failures without partial success', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
    mocks.transaction.mockRejectedValue(new Error('transaction failed'));
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');

    await expect(handlers.reorder?.(['cat-2', 'cat-1'])).resolves.toEqual({
      ok: false,
      code: 'unknown',
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it.each([
    ['not_found', ORMErrorReason.NOT_FOUND],
    ['foreign_key', ORMErrorReason.DB_QUERY_ERROR],
    ['unknown', ORMErrorReason.INTERNAL_ERROR],
  ])('maps delete %s failures', async (code, reason) => {
    const { createZenStackCatalogHandlers } =
      await import('@/libs/admin/catalog/zenstackCatalogHandlers');
    const handlers = createZenStackCatalogHandlers('event_categories');
    const error = new ORMError(reason, 'delete failed');
    if (code === 'foreign_key') {
      error.dbErrorCode = '23503';
    }
    mocks.delete.mockRejectedValue(error);

    await expect(
      handlers.delete('cat-1', {
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
      })
    ).resolves.toEqual({ ok: false, code });
  });
});
