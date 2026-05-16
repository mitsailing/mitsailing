import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';

vi.mock('server-only', () => ({}));

const {
  listCreate,
  listFindFirst,
  redirect,
  requireAdmin,
  revalidatePath,
  templateCreate,
  templateFindUnique,
} = vi.hoisted(() => ({
  listCreate: vi.fn(),
  listFindFirst: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireAdmin: vi.fn(),
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
  requireAdmin,
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

beforeEach(() => {
  listCreate.mockReset();
  listFindFirst.mockReset();
  redirect.mockClear();
  requireAdmin.mockReset();
  revalidatePath.mockClear();
  templateCreate.mockReset();
  templateFindUnique.mockReset();

  listFindFirst.mockResolvedValue(null);
  requireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
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
  });
});
