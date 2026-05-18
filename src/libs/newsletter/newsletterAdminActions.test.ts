import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { Permission } from '@/libs/auth/permissions';

vi.mock('server-only', () => ({}));

const {
  createNewsletterBroadcast,
  env,
  listCreate,
  listFindFirst,
  redirect,
  requirePermission,
  revalidatePath,
  templateCreate,
  templateFindUnique,
} = vi.hoisted(() => ({
  createNewsletterBroadcast: vi.fn(),
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
  listCreate: vi.fn(),
  listFindFirst: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  templateCreate: vi.fn(),
  templateFindUnique: vi.fn(),
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

vi.mock('@/libs/Env', () => ({
  Env: env,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    newsletterList: {
      create: listCreate,
      findFirst: listFindFirst,
    },
    newsletterTemplate: {
      create: templateCreate,
      findUnique: templateFindUnique,
    },
  },
}));

vi.mock('@/libs/newsletter/newsletterBroadcasts', () => ({
  createNewsletterBroadcast,
}));

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    clientVersion: 'test',
    code: 'P2002',
  });
}

function listFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'General updates');
  formData.set('slug', 'general-updates');
  return formData;
}

function templateFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'Weekly template');
  formData.set('slug', 'weekly-template');
  return formData;
}

function broadcastFormData(): FormData {
  const formData = new FormData();
  formData.set('body', 'The pavilion is open for spring sailing.');
  formData.set('intent', 'queue');
  formData.set('listId', 'general_id');
  formData.set('previewText', 'News from the pavilion');
  formData.set('subject', 'Spring sailing');
  formData.set('templateId', 'template_1');
  return formData;
}

beforeEach(() => {
  createNewsletterBroadcast.mockReset();
  listCreate.mockReset();
  listFindFirst.mockReset();
  redirect.mockClear();
  requirePermission.mockReset();
  revalidatePath.mockClear();
  templateCreate.mockReset();
  templateFindUnique.mockReset();

  listFindFirst.mockResolvedValue(null);
  createNewsletterBroadcast.mockResolvedValue({
    broadcastId: 'broadcast_1',
    ok: true,
    queued: true,
  });
  env.REDIS_URL = 'redis://localhost:6379';
  requirePermission.mockResolvedValue({ user: { id: 'admin-1' } });
  templateFindUnique.mockResolvedValue(null);
});

describe('createNewsletterListAction', () => {
  it('redirects duplicate list races from unique constraint failures', async () => {
    listCreate.mockRejectedValue(uniqueConstraintError());
    const { createNewsletterListAction } =
      await import('@/libs/newsletter/newsletterAdminActions');

    await expect(
      createNewsletterListAction('en', listFormData())
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/newsletter-lists/new?status=duplicate_list'
    );
    expect(requirePermission).toHaveBeenCalledWith(
      Permission.NEWSLETTER_MANAGE,
      'en'
    );
  });
});

describe('createNewsletterTemplateAction', () => {
  it('redirects duplicate template races from unique constraint failures', async () => {
    templateCreate.mockRejectedValue(uniqueConstraintError());
    const { createNewsletterTemplateAction } =
      await import('@/libs/newsletter/newsletterAdminActions');

    await expect(
      createNewsletterTemplateAction('en', templateFormData())
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/newsletter-templates/new?status=duplicate_template'
    );
    expect(requirePermission).toHaveBeenCalledWith(
      Permission.NEWSLETTER_MANAGE,
      'en'
    );
  });
});

describe('createNewsletterBroadcastAction', () => {
  it('redirects enqueue failures from queued broadcast creation', async () => {
    createNewsletterBroadcast.mockResolvedValueOnce({
      error: 'enqueue_failed',
      ok: false,
    });
    const { createNewsletterBroadcastAction } =
      await import('@/libs/newsletter/newsletterAdminActions');

    await expect(
      createNewsletterBroadcastAction('en', broadcastFormData())
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/newsletter-broadcasts/new?status=enqueue_failed'
    );

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.NEWSLETTER_MANAGE,
      'en'
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
