import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventAnswerType,
  EventDetailPageKind,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  dbTransaction: vi.fn(),
  eventAdminCreateMany: vi.fn(),
  eventAdminDeleteMany: vi.fn(),
  eventCreate: vi.fn(),
  eventDelete: vi.fn(),
  eventEntryFeeCreate: vi.fn(),
  eventEntryFeeDeleteMany: vi.fn(),
  eventEntryFeeUpdateMany: vi.fn(),
  eventDateCreate: vi.fn(),
  eventDateDeleteMany: vi.fn(),
  eventDateUpdateMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventRegistrationUpdateMany: vi.fn(),
  eventRegistrationQuestionAggregate: vi.fn(),
  eventRegistrationQuestionCreate: vi.fn(),
  eventRegistrationQuestionDeleteMany: vi.fn(),
  eventRegistrationQuestionUpdateMany: vi.fn(),
  eventUpdate: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  revalidatePath: vi.fn(),
  requireAdminEventAccess: vi.fn(),
  requirePermission: vi.fn(),
  txQueryRaw: vi.fn(),
  updateTag: vi.fn(),
  appAuthContextFromSession: vi.fn(),
  userCount: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

type EventRegistrationStatusTransactionClient = {
  $queryRaw: typeof mocks.txQueryRaw;
  event: { findUnique: typeof mocks.eventFindUnique };
  eventAdmin: {
    createMany: typeof mocks.eventAdminCreateMany;
    deleteMany: typeof mocks.eventAdminDeleteMany;
  };
  eventRegistration: {
    count: typeof mocks.eventRegistrationCount;
    findFirst: typeof mocks.eventRegistrationFindFirst;
    updateMany: typeof mocks.eventRegistrationUpdateMany;
  };
};

type EventRegistrationStatusTransaction = (
  tx: EventRegistrationStatusTransactionClient
) => Promise<unknown>;

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: <T>(cachedFunction: T) => cachedFunction,
  updateTag: mocks.updateTag,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/admin/events/eventAdminAuthorization', () => ({
  requireAdminEventAccess: mocks.requireAdminEventAccess,
}));

vi.mock('@/libs/zenstack/authContext', () => ({
  appAuthContextFromSession: mocks.appAuthContextFromSession,
}));

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.dbTransaction,
    eventAdmin: {
      createMany: mocks.eventAdminCreateMany,
      deleteMany: mocks.eventAdminDeleteMany,
    },
    event: {
      create: mocks.eventCreate,
      delete: mocks.eventDelete,
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
    eventDate: {
      create: mocks.eventDateCreate,
      deleteMany: mocks.eventDateDeleteMany,
      updateMany: mocks.eventDateUpdateMany,
    },
    eventEntryFee: {
      create: mocks.eventEntryFeeCreate,
      deleteMany: mocks.eventEntryFeeDeleteMany,
      updateMany: mocks.eventEntryFeeUpdateMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
      updateMany: mocks.eventRegistrationUpdateMany,
    },
    eventRegistrationQuestion: {
      aggregate: mocks.eventRegistrationQuestionAggregate,
      create: mocks.eventRegistrationQuestionCreate,
      deleteMany: mocks.eventRegistrationQuestionDeleteMany,
      updateMany: mocks.eventRegistrationQuestionUpdateMany,
    },
    user: {
      count: mocks.userCount,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/libs/mit-sailing/sitemapCache', () => ({
  sitemapCatalogCacheTag: 'sitemap-catalog',
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

function validEventFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'Intro Sail');
  formData.set('shortName', '');
  formData.set('slug', 'intro-sail');
  formData.set('eventCategoryId', 'category-1');
  formData.set('description', 'Learn to sail.');
  formData.set('maxParticipants', '');
  formData.set('registrationStart', '');
  formData.set('registrationEnd', '');
  formData.set('detailPageKind', EventDetailPageKind.standard);
  formData.set('externalDetailUrl', '');
  formData.set('internalNotes', '');
  return formData;
}

function validEventDateFormData(): FormData {
  const formData = new FormData();
  formData.set('startDateTime', '2026-06-01T09:00');
  formData.set('endDateTime', '2026-06-01T12:00');
  return formData;
}

function validEventQuestionFormData(
  answerType: EventAnswerType = EventAnswerType.select
): FormData {
  const formData = new FormData();
  formData.set('questionText', 'Dietary restrictions?');
  formData.set('answerType', answerType);
  formData.set('optionsText', 'Vegetarian\nVegan');
  formData.set('required', 'true');
  formData.set('displayOrder', '');
  return formData;
}

function validEventFeeFormData(): FormData {
  const formData = new FormData();
  formData.set('description', 'Clinic fee');
  formData.set('amountDollars', '15.50');
  formData.set('isDeposit', 'true');
  return formData;
}

function statusFormData(status: EventRegistrationStatus): FormData {
  const formData = new FormData();
  formData.set('status', status);
  return formData;
}

function access() {
  return {
    accessMode: 'editable',
    db: {},
    event: { id: 'event-1', slug: 'intro-sail' },
    session: { user: { id: 'staff-1' } },
  };
}

beforeEach(() => {
  vi.resetModules();
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
  mocks.requireAdminEventAccess.mockResolvedValue(access());
  mocks.eventCreate.mockResolvedValue({ id: 'event-1', slug: 'intro-sail' });
  mocks.eventUpdate.mockResolvedValue({ id: 'event-1' });
  mocks.eventDelete.mockResolvedValue({ id: 'event-1' });
  mocks.eventDateCreate.mockResolvedValue({ id: 'date-1' });
  mocks.eventDateUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventDateDeleteMany.mockResolvedValue({ count: 1 });
  mocks.eventRegistrationQuestionAggregate.mockResolvedValue({
    _max: { displayOrder: 2 },
  });
  mocks.eventRegistrationQuestionCreate.mockResolvedValue({ id: 'question-1' });
  mocks.eventRegistrationQuestionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventRegistrationQuestionDeleteMany.mockResolvedValue({ count: 1 });
  mocks.eventEntryFeeCreate.mockResolvedValue({ id: 'fee-1' });
  mocks.eventEntryFeeUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventEntryFeeDeleteMany.mockResolvedValue({ count: 1 });
  mocks.eventFindUnique.mockResolvedValue({ maxParticipants: null });
  mocks.eventRegistrationFindFirst.mockResolvedValue({
    eventId: 'event-1',
    status: EventRegistrationStatus.pending,
  });
  mocks.eventRegistrationCount.mockResolvedValue(0);
  mocks.eventRegistrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.userCount.mockResolvedValue(1);
  mocks.txQueryRaw.mockResolvedValue([{ id: 'event-1' }]);
  const transactionClient: EventRegistrationStatusTransactionClient = {
    $queryRaw: mocks.txQueryRaw,
    event: { findUnique: mocks.eventFindUnique },
    eventAdmin: {
      createMany: mocks.eventAdminCreateMany,
      deleteMany: mocks.eventAdminDeleteMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
      updateMany: mocks.eventRegistrationUpdateMany,
    },
  };
  mocks.dbTransaction.mockImplementation(
    async (transaction: EventRegistrationStatusTransaction) => {
      const result = await transaction(transactionClient);
      return result;
    }
  );
});

describe('createAdminEventAction', () => {
  it('creates an event admin row for the creator', async () => {
    const session = {
      session: { impersonatedBy: null },
      user: {
        appRole: Role.DOCK_STAFF,
        banned: false,
        emailVerified: true,
        id: 'creator-1',
        role: Role.USER,
      },
    };
    mocks.requirePermission.mockResolvedValue(session);
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.DOCK_STAFF,
      id: 'creator-1',
    });
    mocks.zenstackForAuthContext.mockReturnValue({
      event: {
        create: mocks.eventCreate,
      },
    });
    mocks.eventCreate.mockResolvedValue({ id: 'event-1', slug: 'intro-sail' });
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      createAdminEventAction('en', validEventFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EVENTS_MANAGE,
      'en'
    );
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          admins: {
            create: expect.objectContaining({
              adminUserId: 'creator-1',
              id: expect.any(String),
            }),
          },
        }),
      })
    );
  });

  it('redirects new event validation failures without creating rows', async () => {
    const formData = validEventFormData();
    formData.set('name', '');
    mocks.requirePermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'creator-1' },
    });
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(createAdminEventAction('en', formData)).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/new?error=validation_failed'
    );

    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});

describe('updateAdminEventBasicsAction', () => {
  it('updates event basics through the verified event id', async () => {
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', validEventFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1' },
      })
    );
    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'editable',
      slug: 'intro-sail',
    });
  });

  it('redirects when event access is denied', async () => {
    mocks.requireAdminEventAccess.mockResolvedValue(null);
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', validEventFormData())
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=not_found'
    );

    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });
});

describe('admin event date actions', () => {
  it('creates dates only for the event id verified by slug access', async () => {
    const { addAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      addAdminEventDateAction(
        'en',
        'intro-sail',
        'event-1',
        validEventDateFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventDateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'event-1' }),
      })
    );
  });

  it('rejects mismatched event ids before creating dates', async () => {
    const { addAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      addAdminEventDateAction(
        'en',
        'intro-sail',
        'other-event',
        validEventDateFormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.eventDateCreate).not.toHaveBeenCalled();
  });

  it('redirects not found when a date update touches no rows', async () => {
    mocks.eventDateUpdateMany.mockResolvedValue({ count: 0 });
    const { updateAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventDateAction(
        'en',
        'intro-sail',
        'date-1',
        validEventDateFormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=not_found'
    );

    expect(mocks.eventDateUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'date-1', eventId: 'event-1' },
      })
    );
  });

  it('deletes dates through the protected event id', async () => {
    const { deleteAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      deleteAdminEventDateAction('en', 'intro-sail', 'date-1')
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventDateDeleteMany).toHaveBeenCalledWith({
      where: { id: 'date-1', eventId: 'event-1' },
    });
  });
});

describe('admin event question actions', () => {
  it('creates select questions after the current display order', async () => {
    const { addAdminEventQuestionAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      addAdminEventQuestionAction(
        'en',
        'intro-sail',
        'event-1',
        validEventQuestionFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventRegistrationQuestionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayOrder: 3,
          eventId: 'event-1',
          options: ['Vegetarian', 'Vegan'],
        }),
      })
    );
  });

  it('updates text questions with json null options and scoped ids', async () => {
    const { updateAdminEventQuestionAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventQuestionAction(
        'en',
        'intro-sail',
        'question-1',
        validEventQuestionFormData(EventAnswerType.text)
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventRegistrationQuestionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'question-1', eventId: 'event-1' },
        data: expect.objectContaining({ answerType: EventAnswerType.text }),
      })
    );
  });

  it('redirects not found when deleting a missing question', async () => {
    mocks.eventRegistrationQuestionDeleteMany.mockResolvedValue({ count: 0 });
    const { deleteAdminEventQuestionAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      deleteAdminEventQuestionAction('en', 'intro-sail', 'question-1')
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=not_found'
    );
  });
});

describe('admin event fee actions', () => {
  it('redirects invalid fee amounts without creating fees', async () => {
    const formData = validEventFeeFormData();
    formData.set('amountDollars', 'nope');
    const { addAdminEventFeeAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      addAdminEventFeeAction('en', 'intro-sail', 'event-1', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=invalid_event_fee_amount'
    );

    expect(mocks.eventEntryFeeCreate).not.toHaveBeenCalled();
  });

  it('updates fees through the protected event id', async () => {
    const { updateAdminEventFeeAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventFeeAction(
        'en',
        'intro-sail',
        'fee-1',
        validEventFeeFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventEntryFeeUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 1550, isDeposit: true }),
        where: { id: 'fee-1', eventId: 'event-1' },
      })
    );
  });

  it('redirects not found when deleting a missing fee', async () => {
    mocks.eventEntryFeeDeleteMany.mockResolvedValue({ count: 0 });
    const { deleteAdminEventFeeAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      deleteAdminEventFeeAction('en', 'intro-sail', 'fee-1')
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=not_found'
    );
  });
});

describe('updateAdminEventAdminsAction', () => {
  it('redirects validation failures when no admins are selected', async () => {
    const formData = new FormData();
    const { updateAdminEventAdminsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventAdminsAction('en', 'intro-sail', 'event-1', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('redirects validation failures for unassignable admin users', async () => {
    const formData = new FormData();
    formData.append('adminUserId', 'volunteer-1');
    mocks.userCount.mockResolvedValue(0);
    const { updateAdminEventAdminsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventAdminsAction('en', 'intro-sail', 'event-1', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.userCount).toHaveBeenCalledWith({
      where: {
        appRole: {
          in: [
            Role.VOLUNTEER_INSTRUCTOR,
            Role.DOCK_STAFF,
            Role.DOCK_MASTER,
            Role.ADMIN,
          ],
        },
        id: { in: ['volunteer-1'] },
      },
    });
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('saves assignable admin users through the protected event id', async () => {
    const formData = new FormData();
    formData.append('adminUserId', 'instructor-1');
    formData.append('adminUserId', 'dock-staff-1');
    mocks.userCount.mockResolvedValue(2);
    const { updateAdminEventAdminsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventAdminsAction('en', 'intro-sail', 'event-1', formData)
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventAdminDeleteMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
    });
    expect(mocks.eventAdminCreateMany).toHaveBeenCalledWith({
      data: [
        {
          adminUserId: 'instructor-1',
          eventId: 'event-1',
          id: expect.any(String),
        },
        {
          adminUserId: 'dock-staff-1',
          eventId: 'event-1',
          id: expect.any(String),
        },
      ],
    });
  });
});

describe('updateAdminEventRegistrationStatusAction', () => {
  it('redirects registration validation failures before opening a transaction', async () => {
    const formData = new FormData();
    formData.set('status', 'bogus');
    const { updateAdminEventRegistrationStatusAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventRegistrationStatusAction(
        'en',
        'intro-sail',
        'registration-1',
        formData
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/registrations?error=validation_failed'
    );

    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('redirects not found when the registration is outside the event', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    const { updateAdminEventRegistrationStatusAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventRegistrationStatusAction(
        'en',
        'intro-sail',
        'registration-1',
        statusFormData(EventRegistrationStatus.approved)
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/registrations?error=not_found'
    );
  });

  it('redirects capacity full before approving into a full event', async () => {
    mocks.eventFindUnique.mockResolvedValue({ maxParticipants: 1 });
    mocks.eventRegistrationCount.mockResolvedValue(1);
    const { updateAdminEventRegistrationStatusAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventRegistrationStatusAction(
        'en',
        'intro-sail',
        'registration-1',
        statusFormData(EventRegistrationStatus.approved)
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/registrations?error=capacity_full'
    );

    expect(mocks.eventRegistrationUpdateMany).not.toHaveBeenCalled();
  });

  it('updates registration status when capacity permits', async () => {
    mocks.eventFindUnique.mockResolvedValue({ maxParticipants: 2 });
    mocks.eventRegistrationCount.mockResolvedValue(1);
    const { updateAdminEventRegistrationStatusAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventRegistrationStatusAction(
        'en',
        'intro-sail',
        'registration-1',
        statusFormData(EventRegistrationStatus.approved)
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/registrations');

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.approved },
      where: { id: 'registration-1', eventId: 'event-1' },
    });
    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'editable',
      slug: 'intro-sail',
    });
  });
});
