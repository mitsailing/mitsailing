import type { DefaultNodeTypes } from '@payloadcms/richtext-lexical';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { LinkJSXConverter, RichText } from '@payloadcms/richtext-lexical/react';
import type { JSXConvertersFunction } from '@payloadcms/richtext-lexical/react';
import Image from 'next/image';
import {
  CmsAnchor,
  internalDocToHref,
} from '@/components/mit-sailing/cms/cmsAnchor';
import { uploadImageFrame } from '@/payload/lexical/uploadImageFrame';

const jsxConverters: JSXConvertersFunction<DefaultNodeTypes> = ({
  defaultConverters,
}) => {
  const linkConverters = LinkJSXConverter({ internalDocToHref });
  return {
    ...defaultConverters,
    ...linkConverters,
    autolink: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children });
      return <CmsAnchor href={node.fields.url ?? '#'}>{children}</CmsAnchor>;
    },
    link: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children });
      let href = node.fields.url ?? '';
      if (node.fields.linkType === 'internal') {
        href = internalDocToHref({ linkNode: node });
      }
      const rel = node.fields.newTab ? 'noopener noreferrer' : undefined;
      const target = node.fields.newTab ? '_blank' : undefined;
      return (
        <CmsAnchor href={href} rel={rel} target={target}>
          {children}
        </CmsAnchor>
      );
    },
    upload: ({ node }) => {
      if (!node.value || typeof node.value !== 'object') {
        return null;
      }
      const upload = node.value;
      const { url } = upload;
      if (!url) {
        return null;
      }
      if (!upload.mimeType?.startsWith('image')) {
        return <CmsAnchor href={url}>{upload.filename}</CmsAnchor>;
      }
      const { width } = upload;
      const { height } = upload;
      if (!width || !height) {
        return null;
      }
      const alt =
        typeof node.fields?.alt === 'string' && node.fields.alt.length > 0
          ? node.fields.alt
          : (upload.alt ?? '');
      const frame = uploadImageFrame(node.fields);
      return (
        <span className={frame.className} style={frame.style}>
          <Image
            alt={alt}
            className="h-auto w-full"
            height={height}
            sizes={frame.sizes}
            src={url}
            style={{ height: 'auto', width: '100%' }}
            width={width}
          />
        </span>
      );
    },
  };
};

/**
 * Renders a Payload Lexical page body with app Link for internal paths.
 *
 * Upload defaults: image → `<img>`; PDF/other → filename link.
 *
 * @param props - Lexical editor state and optional className
 * @returns Rich text output for public pages
 */
export function PayloadLexicalRichText(props: {
  className?: string;
  data: SerializedEditorState;
}) {
  return (
    <RichText
      className={['flow-root', props.className].filter(Boolean).join(' ')}
      converters={jsxConverters}
      data={props.data}
    />
  );
}
