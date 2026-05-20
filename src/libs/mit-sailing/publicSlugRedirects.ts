import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { prisma } from '@/libs/DB';
import type { PublicSluggableType } from '@/libs/mit-sailing/publicSlugHistory';
import { getI18nPath } from '@/utils/Helpers';

type PublicSlugScope = 'classes' | 'cms' | 'events' | 'fleet';

type ResolvePublicSlugRedirectOptions = {
  locale: string;
  scope: PublicSlugScope;
  slug: string;
};

function isPublicSluggableType(value: string): value is PublicSluggableType {
  return (
    value === 'CmsPage' ||
    value === 'Event' ||
    value === 'FleetBoat' ||
    value === 'SailingClass'
  );
}

function targetPathForSlug(options: {
  locale: string;
  scope: PublicSlugScope;
  slug: string;
}): string {
  if (options.scope === 'cms') {
    return getI18nPath(options.slug, options.locale);
  }

  if (options.scope === 'events') {
    return getI18nPath(`/events/${options.slug}`, options.locale);
  }

  if (options.scope === 'classes') {
    return getI18nPath(`/classes/${options.slug}`, options.locale);
  }

  return getI18nPath(`/fleet/${options.slug}`, options.locale);
}

async function canonicalSlugForTarget(options: {
  sluggableId: string;
  sluggableType: PublicSluggableType;
}): Promise<{ scope: PublicSlugScope; slug: string } | null> {
  if (options.sluggableType === 'CmsPage') {
    const page = await prisma.cmsPage.findUnique({
      select: { path: true },
      where: { id: options.sluggableId, isPublished: true },
    });

    return page ? { scope: 'cms', slug: page.path } : null;
  }

  if (options.sluggableType === 'Event') {
    const event = await prisma.event.findUnique({
      select: { slug: true },
      where: { id: options.sluggableId, isPublished: true },
    });

    return event ? { scope: 'events', slug: event.slug } : null;
  }

  if (options.sluggableType === 'SailingClass') {
    const sailingClass = await prisma.sailingClass.findUnique({
      select: { slug: true },
      where: { id: options.sluggableId, isVisible: true },
    });

    return sailingClass ? { scope: 'classes', slug: sailingClass.slug } : null;
  }

  const boat = await prisma.fleetBoat.findUnique({
    select: { slug: true },
    where: { id: options.sluggableId },
  });

  return boat ? { scope: 'fleet', slug: boat.slug } : null;
}

/**
 * Resolves an old public slug to its current canonical public path.
 *
 * @param options - Locale, public scope, and requested slug to resolve
 * @returns A redirect path, or null when no redirect should happen
 */
export async function resolvePublicSlugRedirect(
  options: ResolvePublicSlugRedirectOptions
): Promise<string | null> {
  const row = await prisma.publicSlug.findFirst({
    select: {
      sluggableId: true,
      sluggableType: true,
    },
    where: {
      scope: options.scope,
      slug: options.slug,
    },
  });

  if (!row || !isPublicSluggableType(row.sluggableType)) {
    return null;
  }

  const canonical = await canonicalSlugForTarget({
    sluggableId: row.sluggableId,
    sluggableType: row.sluggableType,
  });

  if (
    !canonical ||
    (canonical.scope === options.scope && canonical.slug === options.slug)
  ) {
    return null;
  }

  return targetPathForSlug({
    locale: options.locale,
    scope: canonical.scope,
    slug: canonical.slug,
  });
}

/**
 * Redirects a missed public slug to its canonical alias target or returns 404.
 *
 * @param options - Locale, public scope, requested slug, and optional path suffix
 */
export async function redirectPublicSlugAliasOrNotFound(
  options: ResolvePublicSlugRedirectOptions & { redirectSuffix?: string }
): Promise<never> {
  const redirectPath = await resolvePublicSlugRedirect(options);
  if (redirectPath) {
    permanentRedirect(`${redirectPath}${options.redirectSuffix ?? ''}`);
  }
  notFound();
}
