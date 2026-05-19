import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SailingClassAssociationActions from '@/libs/admin/sailing-classes/sailingClassAssociationActions';
import { Permission } from '@/libs/auth/permissions';

const {
  relatedEventCreate,
  relatedEventDeleteMany,
  prerequisiteCreate,
  prerequisiteDeleteMany,
  redirect,
  requirePermission,
  revalidatePath,
  unlockedBoatCreate,
  unlockedBoatDeleteMany,
} = vi.hoisted(() => ({
  relatedEventCreate: vi.fn(),
  relatedEventDeleteMany: vi.fn(),
  prerequisiteCreate: vi.fn(),
  prerequisiteDeleteMany: vi.fn(),
  redirect: vi.fn((_path: string): never => {
    throw new Error('NEXT_REDIRECT');
  }),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  unlockedBoatCreate: vi.fn(),
  unlockedBoatDeleteMany: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    sailingClassPrerequisite: {
      create: prerequisiteCreate,
      deleteMany: prerequisiteDeleteMany,
    },
    sailingClassRelatedEvent: {
      create: relatedEventCreate,
      deleteMany: relatedEventDeleteMany,
    },
    sailingClassUnlockedBoat: {
      create: unlockedBoatCreate,
      deleteMany: unlockedBoatDeleteMany,
    },
  },
}));

type AssociationAction = (
  locale: string,
  sailingClassId: string,
  formData: FormData
) => Promise<void>;

type AssociationActionName =
  | 'addSailingClassPrerequisiteAction'
  | 'addSailingClassRelatedEventAction'
  | 'addSailingClassUnlockedBoatAction'
  | 'removeSailingClassPrerequisiteAction'
  | 'removeSailingClassRelatedEventAction'
  | 'removeSailingClassUnlockedBoatAction';

function associationActionFromExports(
  actions: typeof SailingClassAssociationActions,
  exportName: AssociationActionName
): AssociationAction {
  return actions[exportName];
}

function formDataWithId(field: string, id: string): FormData {
  const formData = new FormData();
  formData.set(field, id);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'staff-1' },
  });
  relatedEventCreate.mockResolvedValue({ id: 'link-1' });
  relatedEventDeleteMany.mockResolvedValue({ count: 1 });
  prerequisiteCreate.mockResolvedValue({ id: 'link-1' });
  prerequisiteDeleteMany.mockResolvedValue({ count: 1 });
  unlockedBoatCreate.mockResolvedValue({ id: 'link-1' });
  unlockedBoatDeleteMany.mockResolvedValue({ count: 1 });
});

describe('sailing class association actions', () => {
  it.each([
    [
      'addSailingClassRelatedEventAction',
      'eventId',
      'event-1',
      relatedEventCreate,
    ],
    [
      'removeSailingClassRelatedEventAction',
      'eventId',
      'event-1',
      relatedEventDeleteMany,
    ],
    [
      'addSailingClassPrerequisiteAction',
      'prerequisiteClassId',
      'intro-keelboat',
      prerequisiteCreate,
    ],
    [
      'removeSailingClassPrerequisiteAction',
      'prerequisiteClassId',
      'intro-keelboat',
      prerequisiteDeleteMany,
    ],
    [
      'addSailingClassUnlockedBoatAction',
      'fleetBoatId',
      'tech-dinghy',
      unlockedBoatCreate,
    ],
    [
      'removeSailingClassUnlockedBoatAction',
      'fleetBoatId',
      'tech-dinghy',
      unlockedBoatDeleteMany,
    ],
  ] satisfies readonly [
    AssociationActionName,
    string,
    string,
    typeof relatedEventCreate,
  ][])(
    'requires sailing class management before %s mutates associations',
    async (exportName, field, id, mutation) => {
      const actions =
        await import('@/libs/admin/sailing-classes/sailingClassAssociationActions');
      const action = associationActionFromExports(actions, exportName);

      await expect(
        action('en', 'learn-to-sail', formDataWithId(field, id))
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(requirePermission).toHaveBeenCalledWith(
        Permission.SAILING_CLASSES_MANAGE,
        'en'
      );
      expect(mutation).toHaveBeenCalledOnce();
      expect(revalidatePath).toHaveBeenCalledWith('/classes');
    }
  );

  it('redirects invalid prerequisite self-links before writing', async () => {
    const { addSailingClassPrerequisiteAction } =
      await import('@/libs/admin/sailing-classes/sailingClassAssociationActions');

    await expect(
      addSailingClassPrerequisiteAction(
        'en',
        'learn-to-sail',
        formDataWithId('prerequisiteClassId', 'learn-to-sail')
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.SAILING_CLASSES_MANAGE,
      'en'
    );
    expect(prerequisiteCreate).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/admin/sailing_classes/learn-to-sail/prerequisites?error=validation_failed'
    );
  });
});
