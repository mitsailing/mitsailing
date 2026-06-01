import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventAddressPreset,
  EventAnswerType,
  EventDetailPageKind,
  EventPaymentNotificationKind,
  PaymentStatus,
  EventRegistrationStatus,
  EventSailingCardRequirement,
} from '@/generated/prisma/enums';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  dbTransaction: vi.fn(),
  eventAdminCreateMany: vi.fn(),
  eventAdminDeleteMany: vi.fn(),
  eventCreate: vi.fn(),
  eventDelete: vi.fn(),
  eventDateCount: vi.fn(),
  eventEntryFeeCreate: vi.fn(),
  eventEntryFeeDeleteMany: vi.fn(),
  eventEntryFeeUpdateMany: vi.fn(),
  eventDateCreate: vi.fn(),
  eventDateDeleteMany: vi.fn(),
  eventDateFindMany: vi.fn(),
  eventDateUpdateMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventRegistrationUpdateMany: vi.fn(),
  eventPaymentFindFirst: vi.fn(),
  eventPaymentFindMany: vi.fn(),
  eventPaymentUpsert: vi.fn(),
  eventPaymentUpdateMany: vi.fn(),
  eventPaymentNotificationUpsert: vi.fn(),
  eventRegistrationBoatMemberCount: vi.fn(),
  enqueueEventPaymentEmailJob: vi.fn(),
  eventRegistrationQuestionAggregate: vi.fn(),
  eventRegistrationQuestionCreate: vi.fn(),
  eventRegistrationQuestionDeleteMany: vi.fn(),
  eventRegistrationQuestionUpdateMany: vi.fn(),
  eventRegistrationTeamCount: vi.fn(),
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
  getDefaultQueue: vi.fn(() => ({ queue: true })),
  userCount: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

type AdminEventTransactionClient = {
  $queryRaw: typeof mocks.txQueryRaw;
  event: {
    findUnique: typeof mocks.eventFindUnique;
    update: typeof mocks.eventUpdate;
  };
  eventAdmin: {
    createMany: typeof mocks.eventAdminCreateMany;
    deleteMany: typeof mocks.eventAdminDeleteMany;
  };
  eventDate: {
    count: typeof mocks.eventDateCount;
    create: typeof mocks.eventDateCreate;
    deleteMany: typeof mocks.eventDateDeleteMany;
    findMany: typeof mocks.eventDateFindMany;
    updateMany: typeof mocks.eventDateUpdateMany;
  };
  eventRegistration: {
    count: typeof mocks.eventRegistrationCount;
    findFirst: typeof mocks.eventRegistrationFindFirst;
    updateMany: typeof mocks.eventRegistrationUpdateMany;
  };
  payment: {
    findFirst: typeof mocks.eventPaymentFindFirst;
    findMany: typeof mocks.eventPaymentFindMany;
    upsert: typeof mocks.eventPaymentUpsert;
    updateMany: typeof mocks.eventPaymentUpdateMany;
  };
  eventPaymentNotification: {
    upsert: typeof mocks.eventPaymentNotificationUpsert;
  };
  eventRegistrationBoatMember: {
    count: typeof mocks.eventRegistrationBoatMemberCount;
  };
  eventRegistrationTeam: {
    count: typeof mocks.eventRegistrationTeamCount;
  };
};

type EventRegistrationStatusTransaction = (
  tx: AdminEventTransactionClient
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
      count: mocks.eventDateCount,
      create: mocks.eventDateCreate,
      deleteMany: mocks.eventDateDeleteMany,
      findMany: mocks.eventDateFindMany,
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
    payment: {
      findFirst: mocks.eventPaymentFindFirst,
      findMany: mocks.eventPaymentFindMany,
      upsert: mocks.eventPaymentUpsert,
      updateMany: mocks.eventPaymentUpdateMany,
    },
    eventPaymentNotification: {
      upsert: mocks.eventPaymentNotificationUpsert,
    },
    eventRegistrationBoatMember: {
      count: mocks.eventRegistrationBoatMemberCount,
    },
    eventRegistrationTeam: {
      count: mocks.eventRegistrationTeamCount,
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

vi.mock('@/worker/defaultQueue', () => ({
  getDefaultQueue: mocks.getDefaultQueue,
}));

vi.mock('@/worker/eventPaymentEmailJob', () => ({
  enqueueEventPaymentEmailJob: mocks.enqueueEventPaymentEmailJob,
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
  formData.set('registrationMode', 'standard');
  formData.set('externalRegistrationUrl', '');
  formData.set('externalEntriesUrl', '');
  formData.set('faqContent', '');
  formData.set('noticeOfRaceContent', '');
  formData.set('sailingInstructionsContent', '');
  formData.set('resultsContent', '');
  formData.set('startDateTime', '2026-06-01T09:00');
  formData.set('endDateTime', '2026-06-01T12:00');
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

function validPaymentSettingsFormData(): FormData {
  const formData = new FormData();
  formData.set('paymentsEnabled', 'true');
  formData.set('paymentDeadlineAt', '2026-06-01T17:00');
  return formData;
}

function validLocationFormData(): FormData {
  const formData = new FormData();
  formData.set('addressPreset', EventAddressPreset.pavilion);
  formData.set('addressName', '');
  formData.set('addressLine1', '');
  formData.set('addressLine2', '');
  formData.set('addressCity', '');
  formData.set('addressState', '');
  formData.set('addressPostalCode', '');
  formData.set('addressCountry', '');
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
  mocks.eventDateCount.mockResolvedValue(2);
  mocks.eventDateCreate.mockResolvedValue({ id: 'date-1' });
  mocks.eventDateFindMany.mockResolvedValue([]);
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
  mocks.eventFindUnique.mockResolvedValue({
    entryFees: [],
    maxParticipants: null,
    name: 'Intro Sail',
    paymentDeadlineAt: null,
    paymentsEnabled: false,
  });
  mocks.eventRegistrationFindFirst.mockResolvedValue({
    eventEntryFee: {
      amountCents: 15_000,
      description: 'Adult entry',
      id: 'fee-1',
    },
    eventId: 'event-1',
    id: 'registration-1',
    status: EventRegistrationStatus.pending,
    userId: 'user-1',
  });
  mocks.eventRegistrationCount.mockResolvedValue(0);
  mocks.eventRegistrationBoatMemberCount.mockResolvedValue(0);
  mocks.eventRegistrationTeamCount.mockResolvedValue(0);
  mocks.eventRegistrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventPaymentFindFirst.mockResolvedValue({
    id: 'payment-1',
    status: PaymentStatus.pending,
  });
  mocks.eventPaymentFindMany.mockResolvedValue([
    { id: 'payment-1', status: PaymentStatus.pending },
  ]);
  mocks.eventPaymentUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventPaymentUpsert.mockResolvedValue({ id: 'payment-1' });
  mocks.eventPaymentNotificationUpsert.mockResolvedValue({
    id: 'notification-1',
  });
  mocks.enqueueEventPaymentEmailJob.mockImplementation(async () => {});
  mocks.userCount.mockResolvedValue(1);
  mocks.txQueryRaw.mockResolvedValue([{ id: 'event-1' }]);
  const transactionClient: AdminEventTransactionClient = {
    $queryRaw: mocks.txQueryRaw,
    event: {
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
    eventAdmin: {
      createMany: mocks.eventAdminCreateMany,
      deleteMany: mocks.eventAdminDeleteMany,
    },
    eventDate: {
      count: mocks.eventDateCount,
      create: mocks.eventDateCreate,
      deleteMany: mocks.eventDateDeleteMany,
      findMany: mocks.eventDateFindMany,
      updateMany: mocks.eventDateUpdateMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
      updateMany: mocks.eventRegistrationUpdateMany,
    },
    payment: {
      findFirst: mocks.eventPaymentFindFirst,
      findMany: mocks.eventPaymentFindMany,
      upsert: mocks.eventPaymentUpsert,
      updateMany: mocks.eventPaymentUpdateMany,
    },
    eventPaymentNotification: {
      upsert: mocks.eventPaymentNotificationUpsert,
    },
    eventRegistrationBoatMember: {
      count: mocks.eventRegistrationBoatMemberCount,
    },
    eventRegistrationTeam: {
      count: mocks.eventRegistrationTeamCount,
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
    const formData = validEventFormData();
    formData.set('internalNotes', 'Private staffing note');
    formData.set('requiresPhone', 'true');
    mocks.eventCreate.mockResolvedValue({
      id: 'event-1',
      slug: '2026-06-01-intro-sail',
    });
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(createAdminEventAction('en', formData)).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/events\/2026-06-01-intro-sail$/u
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EVENTS_MANAGE,
      'en'
    );
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ internalNotes: expect.anything() }),
      })
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
          dates: {
            create: expect.objectContaining({
              endDateTime: new Date('2026-06-01T16:00:00.000Z'),
              id: expect.any(String),
              startDateTime: new Date('2026-06-01T13:00:00.000Z'),
            }),
          },
          requiresPhone: true,
          slug: '2026-06-01-intro-sail',
        }),
      })
    );
  });

  it('persists team registration settings when creating an event', async () => {
    mocks.requirePermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'creator-1' },
    });
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '2');
    formData.set('personsPerBoat', '1');
    formData.set('allowRepeatTeamCaptain', 'true');
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(createAdminEventAction('en', formData)).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/events\/2026-06-01-intro-sail$/u
    );

    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowRepeatTeamCaptain: true,
          boatsPerTeam: 2,
          dates: {
            create: expect.objectContaining({
              startDateTime: new Date('2026-06-01T13:00:00.000Z'),
            }),
          },
          personsPerBoat: 1,
          slug: '2026-06-01-intro-sail',
          usesTeamRegistration: true,
        }),
      })
    );
  });

  it('persists sailing card requirement when creating an event', async () => {
    mocks.requirePermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'creator-1' },
    });
    const formData = validEventFormData();
    formData.set(
      'sailingCardRequirement',
      EventSailingCardRequirement.CURRENT_CARD
    );
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(createAdminEventAction('en', formData)).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/events\/2026-06-01-intro-sail$/u
    );

    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardRequirement: EventSailingCardRequirement.CURRENT_CARD,
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

  it('requires an event date when creating an event', async () => {
    const formData = validEventFormData();
    formData.set('startDateTime', '');
    formData.set('endDateTime', '');
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

  it('redirects invalid team settings without creating rows', async () => {
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '1');
    formData.set('personsPerBoat', '1');
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
    const formData = validEventFormData();
    formData.set('internalNotes', 'Private staffing note');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ internalNotes: expect.anything() }),
        where: { id: 'event-1' },
      })
    );
    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'editable',
      slug: 'intro-sail',
    });
  });

  it('persists registration mode and external registration URLs', async () => {
    const formData = validEventFormData();
    formData.set('registrationMode', 'external');
    formData.set('externalRegistrationUrl', 'https://example.com/register');
    formData.set('externalEntriesUrl', 'https://example.com/entries');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalEntriesUrl: 'https://example.com/entries',
          externalRegistrationUrl: 'https://example.com/register',
          registrationMode: 'external',
        }),
      })
    );
  });

  it('stays on the edit screen when requested after updating basics', async () => {
    const formData = validEventFormData();
    formData.set('redirectTo', 'edit');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail\/edit$/u);
  });

  it('persists phone requirement from event basics', async () => {
    const formData = validEventFormData();
    formData.set('requiresPhone', 'true');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiresPhone: true,
        }),
      })
    );
  });

  it('persists sailing card requirement from event basics', async () => {
    const formData = validEventFormData();
    formData.set(
      'sailingCardRequirement',
      EventSailingCardRequirement.CURRENT_CARD
    );
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardRequirement: EventSailingCardRequirement.CURRENT_CARD,
        }),
      })
    );
  });

  it('persists team registration settings from event basics', async () => {
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '1');
    formData.set('personsPerBoat', '2');
    formData.set('allowRepeatTeamCaptain', 'true');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowRepeatTeamCaptain: true,
          boatsPerTeam: 1,
          personsPerBoat: 2,
          usesTeamRegistration: true,
        }),
      })
    );
  });

  it('locks the event before validating team registration settings', async () => {
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '1');
    formData.set('personsPerBoat', '2');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.txQueryRaw).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('FOR UPDATE')]),
      'event-1'
    );
    const [lockOrder] = mocks.txQueryRaw.mock.invocationCallOrder;
    const [validationOrder] =
      mocks.eventRegistrationBoatMemberCount.mock.invocationCallOrder;
    const [updateOrder] = mocks.eventUpdate.mock.invocationCallOrder;
    if (
      typeof lockOrder !== 'number' ||
      typeof validationOrder !== 'number' ||
      typeof updateOrder !== 'number'
    ) {
      throw new TypeError('Expected lock, validation, and update to run.');
    }
    expect(lockOrder).toBeLessThan(validationOrder);
    expect(lockOrder).toBeLessThan(updateOrder);
  });

  it('rejects team setting updates that invalidate existing boat members', async () => {
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '1');
    formData.set('personsPerBoat', '2');
    mocks.eventRegistrationBoatMemberCount.mockResolvedValue(1);
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.eventUpdate).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationBoatMemberCount).toHaveBeenCalledWith({
      where: {
        registration: { eventId: 'event-1' },
        OR: [{ boatNumber: { gt: 1 } }, { position: { gte: 2 } }],
      },
    });
  });

  it('rejects disabling team registration with existing teams', async () => {
    const formData = validEventFormData();
    mocks.eventRegistrationTeamCount.mockResolvedValue(1);
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.eventUpdate).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationTeamCount).toHaveBeenCalledWith({
      where: { registration: { eventId: 'event-1' } },
    });
  });

  it('rejects disallowing repeat captains with existing repeat teams', async () => {
    const formData = validEventFormData();
    formData.set('usesTeamRegistration', 'true');
    formData.set('boatsPerTeam', '1');
    formData.set('personsPerBoat', '2');
    mocks.eventRegistrationTeamCount.mockResolvedValue(1);
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.eventUpdate).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationTeamCount).toHaveBeenCalledWith({
      where: {
        allowRepeatCaptain: true,
        registration: { eventId: 'event-1' },
      },
    });
  });

  it('persists public content section visibility and content', async () => {
    const formData = validEventFormData();
    formData.set('faqVisible', 'true');
    formData.set('faqContent', '<p>Questions</p>');
    formData.set('noticeOfRaceVisible', 'true');
    formData.set('noticeOfRaceContent', 'Notice text');
    formData.set('sailingInstructionsContent', '<p>Hidden draft</p>');
    formData.set('resultsVisible', 'true');
    formData.set('resultsContent', '<p>Scores</p>');
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          faqContent: '<p>Questions</p>',
          faqVisible: true,
          noticeOfRaceContent: '<p>Notice text</p>',
          noticeOfRaceVisible: true,
          resultsContent: '<p>Scores</p>',
          resultsVisible: true,
          sailingInstructionsContent: '<p>Hidden draft</p>',
          sailingInstructionsVisible: false,
        }),
      })
    );
  });

  it('ignores submitted slugs and updates slug from current dates and name', async () => {
    const formData = validEventFormData();
    formData.set('name', 'Summer Regatta');
    formData.set('slug', 'attacker-controlled-slug');
    mocks.eventDateFindMany.mockResolvedValue([
      { startDateTime: new Date('2026-08-10T13:00:00Z') },
      { startDateTime: new Date('2026-08-11T13:00:00Z') },
    ]);
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', formData)
    ).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/events\/2026-08-10-11-summer-regatta$/u
    );

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Summer Regatta',
          slug: '2026-08-10-11-summer-regatta',
        }),
      })
    );
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
    mocks.eventDateFindMany.mockResolvedValue([
      { startDateTime: new Date('2026-06-01T13:00:00Z') },
    ]);
    const { addAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      addAdminEventDateAction(
        'en',
        'intro-sail',
        'event-1',
        validEventDateFormData()
      )
    ).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/events\/2026-06-01-intro-sail$/u
    );

    expect(mocks.eventDateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'event-1' }),
      })
    );
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1);
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

  it('regenerates and redirects to a new slug after a date update changes the first event day', async () => {
    mocks.requireAdminEventAccess.mockResolvedValue({
      ...access(),
      event: { id: 'event-1', name: 'Intro Sail', slug: 'intro-sail' },
    });
    mocks.eventDateFindMany.mockResolvedValue([
      { startDateTime: new Date('2026-08-10T13:00:00Z') },
    ]);
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
      /^NEXT_REDIRECT:\/admin\/events\/2026-08-10-intro-sail$/u
    );

    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { slug: '2026-08-10-intro-sail' },
    });
  });

  it('stays on the edit screen when requested after updating a date', async () => {
    const formData = validEventDateFormData();
    formData.set('redirectTo', 'edit');
    const { updateAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventDateAction('en', 'intro-sail', 'date-1', formData)
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail\/edit$/u);
  });

  it('deletes dates through the protected event id', async () => {
    const { deleteAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      deleteAdminEventDateAction('en', 'intro-sail', 'date-1')
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

    expect(mocks.eventDateDeleteMany).toHaveBeenCalledWith({
      where: { id: 'date-1', eventId: 'event-1' },
    });
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps the last event date', async () => {
    mocks.eventDateCount.mockResolvedValue(1);
    const { deleteAdminEventDateAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      deleteAdminEventDateAction('en', 'intro-sail', 'date-1')
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/edit?error=validation_failed'
    );

    expect(mocks.eventDateDeleteMany).not.toHaveBeenCalled();
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1);
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
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

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
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

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
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

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

describe('updateAdminEventPaymentSettingsAction', () => {
  it('updates payment settings through the protected event id', async () => {
    const { updateAdminEventPaymentSettingsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventPaymentSettingsAction(
        'en',
        'intro-sail',
        validPaymentSettingsFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentDeadlineAt: new Date('2026-06-01T21:00:00.000Z'),
        paymentsEnabled: true,
      }),
      where: { id: 'event-1' },
    });
  });
});

describe('updateAdminEventLocationAction', () => {
  it('updates event address through the protected event id', async () => {
    const { updateAdminEventLocationAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventLocationAction(
        'en',
        'intro-sail',
        validLocationFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        addressCity: 'Cambridge',
        addressCountry: 'US',
        addressLine1: '134 Memorial Drive',
        addressLine2: null,
        addressName: 'MIT Sailing Pavilion',
        addressPostalCode: '02139',
        addressPreset: EventAddressPreset.pavilion,
        addressState: 'MA',
      }),
      where: { id: 'event-1' },
    });
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
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/events\/intro-sail$/u);

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
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      maxParticipants: 1,
      paymentDeadlineAt: null,
      paymentsEnabled: false,
    });
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
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      maxParticipants: 2,
      paymentDeadlineAt: null,
      paymentsEnabled: false,
    });
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

  it('creates a payment and request marker when approving paid registrations', async () => {
    const deadline = new Date('2099-06-01T13:00:00.000Z');
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [
        {
          amountCents: 15_000,
          description: 'Adult entry',
          id: 'fee-1',
        },
      ],
      maxParticipants: 2,
      paymentDeadlineAt: deadline,
      paymentsEnabled: true,
    });
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

    expect(mocks.eventPaymentUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        amountCents: 15_000,
        currency: 'usd',
        eventId: 'event-1',
        registrationId: 'registration-1',
        selectedFeeDescription: 'Adult entry',
        selectedFeeId: 'fee-1',
        status: PaymentStatus.pending,
        userId: 'user-1',
      }),
      update: {},
      where: { registrationId: 'registration-1' },
    });
    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: EventPaymentNotificationKind.request,
          paymentId: 'payment-1',
        }),
      })
    );
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        kind: 'request',
        paymentId: 'payment-1',
      })
    );
  });

  it('creates admin approval payment from the selected registration fee snapshot', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue({
      eventEntryFee: {
        amountCents: 20_000,
        description: 'Premium entry at registration',
        id: 'fee-premium',
      },
      eventId: 'event-1',
      id: 'registration-1',
      status: EventRegistrationStatus.pending,
      userId: 'user-1',
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [
        {
          amountCents: 15_000,
          description: 'Adult entry',
          id: 'fee-adult',
        },
        {
          amountCents: 25_000,
          description: 'Premium entry after edit',
          id: 'fee-premium',
        },
      ],
      maxParticipants: null,
      paymentDeadlineAt: new Date('2099-06-01T13:00:00.000Z'),
      paymentsEnabled: true,
    });
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

    expect(mocks.eventPaymentUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        amountCents: 20_000,
        selectedFeeDescription: 'Premium entry at registration',
        selectedFeeId: 'fee-premium',
      }),
      update: {},
      where: { registrationId: 'registration-1' },
    });
  });

  it('does not create a payment when the selected registration fee is free', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue({
      eventEntryFee: {
        amountCents: 0,
        description: 'Volunteer comp',
        id: 'fee-free',
      },
      eventId: 'event-1',
      id: 'registration-1',
      status: EventRegistrationStatus.pending,
      userId: 'user-1',
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [
        {
          amountCents: 15_000,
          description: 'Adult entry',
          id: 'fee-adult',
        },
      ],
      maxParticipants: null,
      paymentDeadlineAt: new Date('2099-06-01T13:00:00.000Z'),
      paymentsEnabled: true,
    });
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

    expect(mocks.eventPaymentUpsert).not.toHaveBeenCalled();
    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalled();
  });

  it('does not mark a request sent when approval creates a payment without deadline', async () => {
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [
        {
          amountCents: 15_000,
          description: 'Adult entry',
          id: 'fee-1',
        },
      ],
      maxParticipants: 2,
      paymentDeadlineAt: null,
      paymentsEnabled: true,
    });
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

    expect(mocks.eventPaymentUpsert).toHaveBeenCalled();
    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('does not mark a request sent when approval creates a payment after deadline', async () => {
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [
        {
          amountCents: 15_000,
          description: 'Adult entry',
          id: 'fee-1',
        },
      ],
      maxParticipants: 2,
      paymentDeadlineAt: new Date('2020-06-01T13:00:00.000Z'),
      paymentsEnabled: true,
    });
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

    expect(mocks.eventPaymentUpsert).toHaveBeenCalled();
    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });
});

describe('admin event payment actions', () => {
  it('resends one unpaid payment request with a dedupe marker', async () => {
    const { resendAdminEventPaymentRequestAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      resendAdminEventPaymentRequestAction('en', 'intro-sail', 'payment-1')
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/registrations');

    expect(mocks.eventPaymentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'event-1',
          event: {
            paymentDeadlineAt: { gt: expect.any(Date) },
            paymentsEnabled: true,
          },
          id: 'payment-1',
        }),
      })
    );
    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: EventPaymentNotificationKind.request,
          paymentId: 'payment-1',
        }),
        where: expect.objectContaining({
          paymentId_kind_sentDateKey: expect.objectContaining({
            kind: EventPaymentNotificationKind.request,
            paymentId: 'payment-1',
          }),
        }),
      })
    );
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        kind: 'request',
        paymentId: 'payment-1',
      })
    );
  });

  it('does not fail resend when the email enqueue rejects', async () => {
    mocks.enqueueEventPaymentEmailJob.mockRejectedValue(
      new Error('Queue unavailable')
    );
    const { resendAdminEventPaymentRequestAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      resendAdminEventPaymentRequestAction('en', 'intro-sail', 'payment-1')
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/registrations');

    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        kind: 'request',
        paymentId: 'payment-1',
      })
    );
  });

  it('marks a payment handled with a required internal note', async () => {
    const formData = new FormData();
    formData.set('note', 'Paid by check at front desk');
    const { markAdminEventPaymentHandledAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      markAdminEventPaymentHandledAction(
        'en',
        'intro-sail',
        'payment-1',
        formData
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/registrations');

    expect(mocks.eventPaymentUpdateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        manualHandledByUserId: 'staff-1',
        manualHandledNote: 'Paid by check at front desk',
        status: PaymentStatus.handled,
      }),
      where: {
        eventId: 'event-1',
        id: 'payment-1',
        status: {
          in: [
            PaymentStatus.checkout_created,
            PaymentStatus.past_due,
            PaymentStatus.pending,
          ],
        },
      },
    });
    expect(mocks.eventPaymentFindFirst).not.toHaveBeenCalled();
  });

  it('rejects manual handled submissions without a note', async () => {
    const formData = new FormData();
    formData.set('note', '');
    const { markAdminEventPaymentHandledAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      markAdminEventPaymentHandledAction(
        'en',
        'intro-sail',
        'payment-1',
        formData
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail/registrations?error=validation_failed'
    );

    expect(mocks.eventPaymentUpdateMany).not.toHaveBeenCalled();
  });
});
