import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { PayloadLexicalRichText } from '@/components/mit-sailing/cms/PayloadLexicalRichText';
import {
  PayloadPageLayout,
  payloadPageBlocks,
} from '@/components/mit-sailing/cms/PayloadPageLayout';
import { RefreshPayloadPreview } from '@/components/mit-sailing/cms/RefreshPayloadPreview';
import { appOrigin } from '@/libs/payload/appOrigin';
import { cmsDraftPreviewEnabled } from '@/libs/payload/cmsDraftPreview';
import { loadPublishedPayloadPage } from '@/libs/payload/loadPublishedPayloadPage';

type CmsCatchAllPageProps = {
  params: Promise<{ locale: string; cmsPath: string[] }>;
};

export async function generateMetadata(
  props: CmsCatchAllPageProps
): Promise<Metadata> {
  const { cmsPath } = await props.params;
  const page = await loadPublishedPayloadPage(cmsPath);
  if (!page) {
    return {};
  }
  return {
    openGraph: {
      title: page.title,
      type: 'website',
    },
    title: page.title,
    twitter: {
      card: 'summary_large_image',
      title: page.title,
    },
  };
}

export default async function CmsCatchAllPage(props: CmsCatchAllPageProps) {
  const { locale, cmsPath } = await props.params;
  setRequestLocale(locale);
  const [page, draft] = await Promise.all([
    loadPublishedPayloadPage(cmsPath),
    cmsDraftPreviewEnabled(),
  ]);
  if (!page) {
    notFound();
  }
  const blocks = payloadPageBlocks(page.layout);
  return (
    <>
      <RefreshPayloadPreview draft={draft} serverURL={appOrigin()} />
      <PublicAdminEditLink
        className="mx-auto mb-0 w-full max-w-5xl px-6 pt-4"
        href={`/cms/collections/pages/${page.id}`}
      />
      <article className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="mb-6 font-mit-serif text-3xl font-semibold text-mit-text md:text-4xl">
          {page.title}
        </h1>
        {blocks.length > 0 ? (
          <PayloadPageLayout blocks={blocks} />
        ) : (
          <PayloadLexicalRichText
            className="cms-rich-text prose prose-mit max-w-none text-mit-text"
            data={page.body}
          />
        )}
      </article>
    </>
  );
}
