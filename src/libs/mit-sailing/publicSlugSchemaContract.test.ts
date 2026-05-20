import { describe, expect, expectTypeOf, it } from 'vitest';
import type { LegacyRedirect, PublicSlug } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';

describe('public slug and legacy redirect schema', () => {
  it('exposes generated public slug and legacy redirect models', () => {
    expect(Prisma.ModelName.PublicSlug).toBe('PublicSlug');
    expect(Prisma.ModelName.LegacyRedirect).toBe('LegacyRedirect');

    expect(Object.values(Prisma.PublicSlugScalarFieldEnum)).toEqual(
      expect.arrayContaining([
        'slug',
        'sluggableType',
        'sluggableId',
        'scope',
        'source',
      ])
    );
    expect(Object.values(Prisma.LegacyRedirectScalarFieldEnum)).toEqual(
      expect.arrayContaining(['sourcePath', 'targetPath', 'source'])
    );
  });

  it('keeps generated model field types usable by application code', () => {
    expectTypeOf<
      Pick<PublicSlug, 'slug' | 'sluggableType' | 'sluggableId' | 'scope'>
    >().toEqualTypeOf<{
      slug: string;
      sluggableType: string;
      sluggableId: string;
      scope: string;
    }>();
    expectTypeOf<
      Pick<LegacyRedirect, 'sourcePath' | 'targetPath'>
    >().toEqualTypeOf<{
      sourcePath: string;
      targetPath: string;
    }>();
  });
});
