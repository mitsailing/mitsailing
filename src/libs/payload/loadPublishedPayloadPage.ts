import 'server-only';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { cache } from 'react';
import { ensureLegalPagesContentSeedSafely } from '@/libs/mit-sailing/seedLegalPagesContent';
import { cmsDraftPreviewEnabled } from '@/libs/payload/cmsDraftPreview';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { isLexicalEditorState } from '@/libs/payload/lexicalHtml';
import { pageSlugVariantsFromSegments } from '@/libs/payload/pagePaths';

export type PublishedPayloadPage = {
  id: string;
  slug: string;
  title: string;
  body: SerializedEditorState;
  layout: unknown;
};

const LEGAL_PAGE_SLUGS = new Set(['terms', 'privacy', 'accessibility']);

/**
 * Loads one Payload page for a public catch-all path.
 *
 * Draft mode loads the latest draft for a CMS session. Everyone else gets the published page.
 *
 * @param segments - Path segments from `[...cmsPath]`
 * @returns Page DTO or null when missing
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
  const slugWhere = {
    or: slugVariants.map((slug) => ({
      slug: { equals: slug },
    })),
  };
  const draft = await cmsDraftPreviewEnabled();
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft,
    limit: 1,
    overrideAccess: draft,
    where: draft
      ? slugWhere
      : {
          and: [slugWhere, { _status: { equals: 'published' } }],
        },
  });
  const [doc] = result.docs;
  if (!doc?.body || !isLexicalEditorState(doc.body)) {
    return null;
  }
  return {
    body: doc.body,
    id: String(doc.id),
    layout: doc.layout ?? null,
    slug: doc.slug,
    title: doc.title,
  };
}

export const loadPublishedPayloadPage = cache(
  loadPublishedPayloadPageUnchecked
);
