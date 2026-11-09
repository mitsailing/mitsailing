import 'server-only';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { cache } from 'react';
import { ensureMitnaContentSeedSafely } from '@/libs/mit-sailing/seedMitnaContent';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { isLexicalEditorState } from '@/libs/payload/lexicalHtml';

export type MitnaPayloadPage = {
  id: string;
  slug: string;
  title: string;
  body: SerializedEditorState;
};

async function loadMitnaPageBySlugUnchecked(
  slug: string
): Promise<MitnaPayloadPage | null> {
  await ensureMitnaContentSeedSafely();
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'pages',
    depth: 0,
    draft: false,
    limit: 1,
    overrideAccess: false,
    where: {
      and: [
        {
          or: [{ slug: { equals: slug } }, { slug: { equals: `/${slug}` } }],
        },
        { _status: { equals: 'published' } },
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

/**
 * Loads one published MITNA Payload page by slug.
 */
export const loadMitnaPageBySlug = cache(loadMitnaPageBySlugUnchecked);
