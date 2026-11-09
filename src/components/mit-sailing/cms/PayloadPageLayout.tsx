import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import Image from 'next/image';
import {
  CmsAnchor,
  cmsBlockLinkProps,
} from '@/components/mit-sailing/cms/cmsAnchor';
import type { CmsBlockLink } from '@/components/mit-sailing/cms/cmsAnchor';
import { PayloadLexicalRichText } from '@/components/mit-sailing/cms/PayloadLexicalRichText';

const richTextClassName =
  'cms-rich-text prose prose-mit max-w-none text-mit-text';

const columnClassName = {
  full: 'min-w-0 md:col-span-6',
  half: 'min-w-0 md:col-span-3',
  oneThird: 'min-w-0 md:col-span-2',
  twoThirds: 'min-w-0 md:col-span-4',
} as const;

type ColumnSize = keyof typeof columnClassName;

type MediaAsset = {
  alt: string;
  height: number;
  id: string;
  url: string;
  width: number;
};

type LayoutLink = {
  href: string;
  label: string;
  newTab: boolean;
};

type MediaContentBlock = {
  alignment: 'contentMedia' | 'mediaContent';
  blockType: 'mediaContent';
  id: string;
  link: LayoutLink | null;
  mediaWidth: 'fit' | 'stretch';
  richText: SerializedEditorState | null;
  images: MediaAsset[];
};

type ContentColumn = {
  id: string;
  richText: SerializedEditorState;
  size: ColumnSize;
};

type ContentBlock = {
  blockType: 'content';
  columns: ContentColumn[];
  id: string;
};

type MediaLayoutBlock = {
  blockType: 'media';
  id: string;
  media: MediaAsset;
};

type CtaBlock = {
  blockType: 'cta';
  id: string;
  link: LayoutLink | null;
  richText: SerializedEditorState | null;
};

export type PayloadPageBlock =
  | ContentBlock
  | CtaBlock
  | MediaContentBlock
  | MediaLayoutBlock;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEditorState(value: unknown): value is SerializedEditorState {
  return isRecord(value) && 'root' in value;
}

function positiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function mediaAsset(value: unknown, id: string): MediaAsset | null {
  if (!isRecord(value)) {
    return null;
  }
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const width = positiveNumber(value.width);
  const height = positiveNumber(value.height);
  if (url.length === 0 || width === null || height === null) {
    return null;
  }
  return {
    alt: typeof value.alt === 'string' ? value.alt : '',
    height,
    id,
    url,
    width,
  };
}

function mediaAssets(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const assets: MediaAsset[] = [];
  for (const [index, row] of value.entries()) {
    const image = isRecord(row) && 'image' in row ? row.image : row;
    const rowId =
      isRecord(row) && typeof row.id === 'string' ? row.id : `image-${index}`;
    const asset = mediaAsset(image, rowId);
    if (asset) {
      assets.push(asset);
    }
  }
  return assets;
}

function layoutLink(value: unknown, enabled: boolean): LayoutLink | null {
  if (!enabled || !isRecord(value)) {
    return null;
  }
  const link = cmsBlockLinkProps(value as CmsBlockLink);
  if (!link) {
    return null;
  }
  return link;
}

function columnSize(value: unknown): ColumnSize {
  if (
    value === 'oneThird' ||
    value === 'half' ||
    value === 'twoThirds' ||
    value === 'full'
  ) {
    return value;
  }
  return 'oneThird';
}

function contentColumns(value: unknown): ContentColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const columns: ContentColumn[] = [];
  for (const [index, row] of value.entries()) {
    if (!isRecord(row) || !isEditorState(row.richText)) {
      continue;
    }
    columns.push({
      id: typeof row.id === 'string' ? row.id : `column-${index}`,
      richText: row.richText,
      size: columnSize(row.size),
    });
  }
  return columns;
}

function blockId(value: Record<string, unknown>, index: number): string {
  return typeof value.id === 'string' ? value.id : `block-${index}`;
}

/**
 * Narrows a Payload `layout` value to the blocks the public page can render.
 *
 * @param value - Raw blocks field from a page document
 * @returns Known blocks in editor order
 */
export function payloadPageBlocks(value: unknown): PayloadPageBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const blocks: PayloadPageBlock[] = [];
  for (const [index, row] of value.entries()) {
    if (!isRecord(row) || typeof row.blockType !== 'string') {
      continue;
    }
    const id = blockId(row, index);
    switch (row.blockType) {
      case 'mediaContent': {
        blocks.push({
          alignment:
            row.alignment === 'contentMedia' ? 'contentMedia' : 'mediaContent',
          blockType: 'mediaContent',
          id,
          images: mediaAssets(row.images),
          link: layoutLink(row.link, Boolean(row.enableLink)),
          mediaWidth: row.mediaWidth === 'fit' ? 'fit' : 'stretch',
          richText: isEditorState(row.richText) ? row.richText : null,
        });
        break;
      }
      case 'content': {
        blocks.push({
          blockType: 'content',
          columns: contentColumns(row.columns),
          id,
        });
        break;
      }
      case 'media': {
        const media = mediaAsset(row.media, id);
        if (!media) {
          break;
        }
        blocks.push({
          blockType: 'media',
          id,
          media,
        });
        break;
      }
      case 'cta': {
        blocks.push({
          blockType: 'cta',
          id,
          link: layoutLink(row.link, true),
          richText: isEditorState(row.richText) ? row.richText : null,
        });
        break;
      }
      default: {
        break;
      }
    }
  }
  return blocks;
}

function LayoutLinkView(props: { link: LayoutLink }) {
  return (
    <CmsAnchor
      className="mt-4 inline-block underline"
      href={props.link.href}
      rel={props.link.newTab ? 'noopener noreferrer' : undefined}
      target={props.link.newTab ? '_blank' : undefined}
    >
      {props.link.label}
    </CmsAnchor>
  );
}

function LayoutRichText(props: { data: SerializedEditorState | null }) {
  if (!props.data) {
    return null;
  }
  return (
    <PayloadLexicalRichText className={richTextClassName} data={props.data} />
  );
}

function MediaImages(props: {
  images: MediaAsset[];
  width: 'fit' | 'stretch';
}) {
  if (props.images.length === 0) {
    return null;
  }
  const stretch = props.width === 'stretch';
  return (
    <div className="flex flex-col gap-4">
      {props.images.map((image) => (
        <Image
          alt={image.alt}
          className={stretch ? 'h-auto w-full' : 'h-auto max-w-full'}
          height={image.height}
          key={image.id}
          sizes={
            stretch ? '(min-width: 768px) 32rem, 100vw' : `${image.width}px`
          }
          src={image.url}
          style={
            stretch
              ? { height: 'auto', width: '100%' }
              : { height: 'auto', maxWidth: '100%', width: image.width }
          }
          width={image.width}
        />
      ))}
    </div>
  );
}

function MediaContentView(props: { block: MediaContentBlock }) {
  const imageFirst = props.block.alignment === 'mediaContent';
  const media = (
    <div className="min-w-0" data-testid="media-content-media">
      <MediaImages images={props.block.images} width={props.block.mediaWidth} />
    </div>
  );
  const text = (
    <div className="min-w-0" data-testid="media-content-text">
      <LayoutRichText data={props.block.richText} />
      {props.block.link ? <LayoutLinkView link={props.block.link} /> : null}
    </div>
  );
  return (
    <div
      className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-center"
      data-testid="media-content"
    >
      {imageFirst ? media : text}
      {imageFirst ? text : media}
    </div>
  );
}

function ContentView(props: { block: ContentBlock }) {
  if (props.block.columns.length === 0) {
    return null;
  }
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-6"
      data-testid="content-columns"
    >
      {props.block.columns.map((column) => (
        <div className={columnClassName[column.size]} key={column.id}>
          <LayoutRichText data={column.richText} />
        </div>
      ))}
    </div>
  );
}

function MediaView(props: { block: MediaLayoutBlock }) {
  return (
    <Image
      alt={props.block.media.alt}
      className="h-auto w-full"
      height={props.block.media.height}
      sizes="(min-width: 768px) 64rem, 100vw"
      src={props.block.media.url}
      style={{ height: 'auto', width: '100%' }}
      width={props.block.media.width}
    />
  );
}

function CtaView(props: { block: CtaBlock }) {
  return (
    <div data-testid="cta">
      <LayoutRichText data={props.block.richText} />
      {props.block.link ? <LayoutLinkView link={props.block.link} /> : null}
    </div>
  );
}

function PayloadPageBlockView(props: { block: PayloadPageBlock }) {
  switch (props.block.blockType) {
    case 'mediaContent': {
      return <MediaContentView block={props.block} />;
    }
    case 'content': {
      return <ContentView block={props.block} />;
    }
    case 'media': {
      return <MediaView block={props.block} />;
    }
    case 'cta': {
      return <CtaView block={props.block} />;
    }
    default: {
      return null;
    }
  }
}

/**
 * Renders optional page layout blocks under the page title.
 *
 * @param props - Parsed layout blocks
 * @returns Block stack, or null when the page has no layout
 */
export function PayloadPageLayout(props: { blocks: PayloadPageBlock[] }) {
  if (props.blocks.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-12" data-testid="page-layout">
      {props.blocks.map((block) => (
        <PayloadPageBlockView block={block} key={block.id} />
      ))}
    </div>
  );
}
