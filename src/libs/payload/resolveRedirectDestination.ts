import 'server-only';
import { safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { publicPathFromPageSlug } from '@/libs/payload/pagePaths';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redirectCandidateFromDoc(doc: unknown): string | null | undefined {
  if (!isRecord(doc) || !isRecord(doc.to)) {
    return undefined;
  }
  const { to } = doc;
  if (to.type === 'custom' && typeof to.url === 'string') {
    return to.url;
  }
  if (to.type === 'reference' && isRecord(to.reference)) {
    const { value } = to.reference;
    if (typeof value === 'object' && value !== null && 'slug' in value) {
      const { slug } = value;
      if (typeof slug === 'string') {
        return publicPathFromPageSlug(slug);
      }
    }
  }
  return undefined;
}

/**
 * Resolves a Payload redirects destination for an incoming public path.
 *
 * @param fromPath - Request pathname (leading slash)
 * @returns Safe destination href, or null when no redirect applies
 */
export async function resolveRedirectDestination(
  fromPath: string
): Promise<string | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'redirects',
    depth: 1,
    limit: 1,
    overrideAccess: true,
    where: {
      from: { equals: fromPath },
    },
  });
  const [doc] = result.docs;
  const candidate = redirectCandidateFromDoc(doc);
  const href = safeCmsHref(candidate);
  if (!href || href === fromPath) {
    return null;
  }
  return href;
}
