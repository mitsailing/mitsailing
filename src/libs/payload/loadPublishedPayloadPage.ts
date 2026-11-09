import 'server-only';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { cache } from 'react';
import { ensureLegalPagesContentSeedSafely } from '@/libs/mit-sailing/seedLegalPagesContent';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { isLexicalEditorState } from '@/libs/payload/lexicalHtml';
import { pageSlugVariantsFromSegments } from '@/libs/payload/pagePaths';

export type PublishedPayloadPage = {
  id: string;
  slug: string;
  title: string;
  body: SerializedEditorState;
};

const LEGAL_PAGE_SLUGS = new Set(['terms', 'privacy', 'accessibility']);

/**
 * Loads one published Payload page for a public catch-all path.
 *
 * @param segments - Path segments from `[...cmsPath]`
 * @returns Published page DTO or null when missing/unpublished
 */
async function loadPublishedPayloadPageUnchecked(
  segments: string[]
): Promise<PublishedPayloadPage | null> {
  if (segments.length === 0) {
    return null;
  }
  if (segments.length === 1 && LEGAL_PAGE_SLUGS.has(segments[0] ?? '')) {
    await ensureLegalPagesContentSeedSafely();
  }
  const slugVariants = pageSlugVariantsFromSegments(segments);
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft: false,
    limit: 1,
    overrideAccess: false,
    where: {
      and: [
        {
          or: slugVariants.map((slug) => ({
            slug: { equals: slug },
          })),
        },
        {
          _status: { equals: 'published' },
        },
      ],
    },
  });
  const [doc] = result.docs;
  if (!doc?.body || !isLexicalEditorState(doc.body)) {
    return null;
  }
  return {
    body: doc.body,
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
  };
}

export const loadPublishedPayloadPage = cache(
  loadPublishedPayloadPageUnchecked
);
